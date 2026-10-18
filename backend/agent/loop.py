"""
Two-phase agentic loop for the Databricks agent.

Phase 1 (/chat):   Read tools execute silently. Write tools are queued as
                   pending_writes and returned to the frontend for confirmation.
Phase 2 (/execute): Confirmed write tools are executed; Claude summarises results.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any

import anthropic

from backend.agent.context import build_system_prompt
from backend.agent.policy_engine import PolicyEngine, PolicyViolation
from backend.agent.tool_definitions import ALL_TOOLS, WRITE_TOOL_NAMES

_MODEL = "claude-sonnet-4-6"
_MAX_TOKENS = 4096
_MAX_LOOP_TURNS = 12  # safety cap on read-tool iterations


# ── helpers ───────────────────────────────────────────────────────────────────

def _get_client() -> anthropic.Anthropic:
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set in .env")
    return anthropic.Anthropic(api_key=key)


def _blocks_to_dicts(content: list[Any]) -> list[dict]:
    """Serialize Anthropic content blocks to plain dicts for JSON transport."""
    result = []
    for block in content:
        if hasattr(block, "model_dump"):
            result.append(block.model_dump())
        elif hasattr(block, "__dict__"):
            result.append(block.__dict__)
        else:
            result.append(block)
    return result


def _execute_tool(name: str, params: dict) -> Any:
    """Dispatch a tool call to the correct handler module."""
    from backend.agent.tools import compute, permissions, users, warehouses

    all_handlers: dict[str, Any] = {
        **compute.HANDLERS,
        **permissions.HANDLERS,
        **users.HANDLERS,
        **warehouses.HANDLERS,
    }

    handler = all_handlers.get(name)
    if not handler:
        raise ValueError(f"No handler registered for tool: {name}")
    return handler(params)


def _resolve_principal_groups(principal: str) -> list[str]:
    """
    Returns the list of Databricks group names the given principal belongs to.
    If the principal is a group name (no @), returns it as a single-item list.
    Falls back to empty list on any error.
    """
    if "@" not in principal:
        return [principal]
    try:
        from backend.agent.tools.users import list_users, get_user
        result = list_users({"filter": f'emails.value eq "{principal}"'})
        if result.get("users"):
            user_detail = get_user({"user_id": result["users"][0]["id"]})
            return user_detail.get("groups", [])
    except Exception:
        pass
    return []


# ── result types ──────────────────────────────────────────────────────────────

@dataclass
class PendingWrite:
    tool_use_id: str
    name: str
    params: dict[str, Any]
    description: str = ""


@dataclass
class ChatResult:
    reply: str
    pending_writes: list[PendingWrite]
    conversation_history: list[dict]


@dataclass
class ExecuteResult:
    summary: str
    results: list[dict]


# ── phase 1: chat / plan ──────────────────────────────────────────────────────

def run_chat(
    user_message: str,
    conversation_history: list[dict],
    policy_engine: PolicyEngine,
    caller_name: str | None = None,
    caller_groups: list[str] | None = None,
) -> ChatResult:
    client = _get_client()
    system_prompt = build_system_prompt(policy_engine, caller_name, caller_groups or [])

    messages: list[dict] = list(conversation_history) + [
        {"role": "user", "content": user_message}
    ]

    pending_writes: list[PendingWrite] = []

    for _ in range(_MAX_LOOP_TURNS):
        response = client.messages.create(
            model=_MODEL,
            max_tokens=_MAX_TOKENS,
            system=system_prompt,
            tools=ALL_TOOLS,  # type: ignore[arg-type]
            messages=messages,
        )

        # Append Claude's turn to history
        messages.append({"role": "assistant", "content": _blocks_to_dicts(response.content)})

        # ── end_turn: Claude gave a final text response ───────────────────────
        if response.stop_reason == "end_turn":
            reply = " ".join(
                b.text for b in response.content if hasattr(b, "text") and b.text
            )
            return ChatResult(
                reply=reply,
                pending_writes=pending_writes,
                conversation_history=messages,
            )

        # ── tool_use: Claude wants to call tools ──────────────────────────────
        if response.stop_reason == "tool_use":
            tool_uses = [b for b in response.content if getattr(b, "type", None) == "tool_use"]
            tool_results: list[dict] = []
            new_pending: list[PendingWrite] = []

            for tu in tool_uses:
                name: str = tu.name
                params: dict = tu.input or {}

                # ── blocked — should not happen if Claude follows system prompt ─
                if policy_engine.is_blocked(name):
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tu.id,
                        "content": f"ERROR: '{name}' is a blocked operation and cannot be executed.",
                        "is_error": True,
                    })
                    continue

                # ── write tool — validate policy then queue for confirmation ───
                if name in WRITE_TOOL_NAMES:
                    violation: str | None = None

                    if name in ("grant_privilege", "revoke_privilege"):
                        try:
                            principal_groups = _resolve_principal_groups(
                                params.get("principal", "")
                            )
                            policy_engine.validate_permission_op(
                                resource=params.get("full_name", ""),
                                securable_type=params.get("securable_type", ""),
                                principal_groups=principal_groups,
                            )
                        except PolicyViolation as e:
                            violation = e.message

                    if violation:
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": tu.id,
                            "content": f"POLICY_VIOLATION: {violation}",
                            "is_error": True,
                        })
                    else:
                        new_pending.append(PendingWrite(
                            tool_use_id=tu.id,
                            name=name,
                            params=params,
                        ))
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": tu.id,
                            "content": json.dumps({
                                "status": "pending_confirmation",
                                "message": "This write operation has been queued. "
                                           "The user will confirm before execution.",
                            }),
                        })
                    continue

                # ── read tool — execute silently ───────────────────────────────
                try:
                    result = _execute_tool(name, params)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tu.id,
                        "content": json.dumps(result, default=str),
                    })
                except Exception as exc:
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tu.id,
                        "content": f"ERROR: {exc}",
                        "is_error": True,
                    })

            messages.append({"role": "user", "content": tool_results})
            pending_writes.extend(new_pending)

            # If write ops were queued, break and ask Claude to summarise the plan
            if new_pending:
                summary_response = client.messages.create(
                    model=_MODEL,
                    max_tokens=_MAX_TOKENS,
                    system=system_prompt,
                    tools=[],
                    messages=messages,
                )
                messages.append({
                    "role": "assistant",
                    "content": _blocks_to_dicts(summary_response.content),
                })
                reply = " ".join(
                    b.text
                    for b in summary_response.content
                    if hasattr(b, "text") and b.text
                )
                return ChatResult(
                    reply=reply,
                    pending_writes=pending_writes,
                    conversation_history=messages,
                )

            # All reads — loop continues
            continue

        # Unexpected stop reason — break cleanly
        break

    # Fallback if loop exhausted
    return ChatResult(
        reply="I've gathered the information but hit my iteration limit. Please try a more specific request.",
        pending_writes=pending_writes,
        conversation_history=messages,
    )


# ── phase 2: execute confirmed writes ────────────────────────────────────────

def run_execute(
    confirmed_writes: list[dict],
    conversation_history: list[dict],
    policy_engine: PolicyEngine,
    caller_name: str | None = None,
) -> ExecuteResult:
    client = _get_client()
    system_prompt = build_system_prompt(policy_engine, caller_name)

    results: list[dict] = []

    for write in confirmed_writes:
        name = write["name"]
        params = write["params"]
        try:
            result = _execute_tool(name, params)
            results.append({"tool": name, "params": params, "result": result, "success": True})
        except Exception as exc:
            results.append({"tool": name, "params": params, "error": str(exc), "success": False})

    # Ask Claude to summarise what was executed
    result_text = json.dumps(results, indent=2, default=str)
    summary_messages = list(conversation_history) + [{
        "role": "user",
        "content": (
            f"The confirmed operations were executed. Here are the results:\n\n"
            f"```json\n{result_text}\n```\n\n"
            "Please provide a concise summary of what was done, noting any failures."
        ),
    }]

    summary_response = client.messages.create(
        model=_MODEL,
        max_tokens=_MAX_TOKENS,
        system=system_prompt,
        messages=summary_messages,
    )

    summary = " ".join(
        b.text for b in summary_response.content if hasattr(b, "text") and b.text
    )

    return ExecuteResult(summary=summary, results=results)
