"""
Two-phase agentic loop — Databricks AI Gateway provider (OpenAI-compatible).

Uses the OpenAI SDK pointed at the Databricks AI Gateway chat/completions endpoint:
  POST {DATABRICKS_HOST}/ai-gateway/mlflow/v1/chat/completions
  Authorization: Bearer {DATABRICKS_AI_GATEWAY_TOKEN}

Requires in .env:
  DATABRICKS_HOST=https://<workspace>.azuredatabricks.net/
  DATABRICKS_AI_GATEWAY_TOKEN=dapi...   (falls back to DATABRICKS_TOKEN)
"""

from __future__ import annotations

import json
import os
from typing import Any

from openai import OpenAI

from backend.agent.context import build_system_prompt
from backend.agent.loop import ChatResult, ExecuteResult, PendingWrite
from backend.agent.policy_engine import PolicyEngine, PolicyViolation
from backend.agent.tool_definitions import ALL_TOOLS, WRITE_TOOL_NAMES

_MODEL = "system.ai.claude-sonnet-4-5"
_MAX_TOKENS = 4096
_MAX_LOOP_TURNS = 12


# ── helpers ───────────────────────────────────────────────────────────────────

def _get_client() -> OpenAI:
    host = os.getenv("DATABRICKS_HOST", "").rstrip("/")
    token = (
        os.getenv("DATABRICKS_AI_GATEWAY_TOKEN")
        or os.getenv("DATABRICKS_TOKEN")
    )
    if not host or not token:
        raise RuntimeError(
            "DATABRICKS_HOST and DATABRICKS_AI_GATEWAY_TOKEN must be set in .env"
        )
    return OpenAI(
        base_url=f"{host}/ai-gateway/mlflow/v1",
        api_key=token,
    )


def _to_openai_tools(anthropic_tools: list[dict]) -> list[dict]:
    """Convert Anthropic input_schema format → OpenAI function-call format."""
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": t["input_schema"],
            },
        }
        for t in anthropic_tools
    ]


def _execute_tool(name: str, params: dict) -> Any:
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
    openai_tools = _to_openai_tools(ALL_TOOLS)

    # System message prepended; not stored in conversation_history to avoid duplication
    messages: list[dict] = (
        [{"role": "system", "content": system_prompt}]
        + list(conversation_history)
        + [{"role": "user", "content": user_message}]
    )
    # History we'll return — excludes the prepended system message
    history: list[dict] = list(conversation_history) + [
        {"role": "user", "content": user_message}
    ]

    pending_writes: list[PendingWrite] = []

    for _ in range(_MAX_LOOP_TURNS):
        response = client.chat.completions.create(
            model=_MODEL,
            max_tokens=_MAX_TOKENS,
            messages=messages,
            tools=openai_tools,
            tool_choice="auto",
        )

        choice = response.choices[0]
        msg = choice.message

        # Build assistant entry for both the API messages list and stored history
        assistant_entry: dict[str, Any] = {"role": "assistant", "content": msg.content}
        if msg.tool_calls:
            assistant_entry["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                }
                for tc in msg.tool_calls
            ]
        messages.append(assistant_entry)
        history.append(assistant_entry)

        # ── stop: final text response ──────────────────────────────────────────
        if choice.finish_reason == "stop":
            return ChatResult(
                reply=msg.content or "",
                pending_writes=pending_writes,
                conversation_history=history,
            )

        # ── tool_calls: model wants to invoke tools ────────────────────────────
        if choice.finish_reason == "tool_calls":
            new_pending: list[PendingWrite] = []

            for tc in msg.tool_calls or []:
                name: str = tc.function.name
                try:
                    params: dict = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    params = {}

                # ── blocked ────────────────────────────────────────────────────
                if policy_engine.is_blocked(name):
                    tool_msg = {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": f"ERROR: '{name}' is a blocked operation and cannot be executed.",
                    }
                    messages.append(tool_msg)
                    history.append(tool_msg)
                    continue

                # ── write tool: validate policy then queue ─────────────────────
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
                        tool_msg = {
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "content": f"POLICY_VIOLATION: {violation}",
                        }
                    else:
                        new_pending.append(
                            PendingWrite(tool_use_id=tc.id, name=name, params=params)
                        )
                        tool_msg = {
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "content": json.dumps({
                                "status": "pending_confirmation",
                                "message": "This write operation has been queued. "
                                           "The user will confirm before execution.",
                            }),
                        }
                    messages.append(tool_msg)
                    history.append(tool_msg)
                    continue

                # ── read tool: execute silently ────────────────────────────────
                try:
                    result = _execute_tool(name, params)
                    tool_msg = {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps(result, default=str),
                    }
                except Exception as exc:
                    tool_msg = {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": f"ERROR: {exc}",
                    }
                messages.append(tool_msg)
                history.append(tool_msg)

            pending_writes.extend(new_pending)

            # Write ops queued — ask model to summarise the plan without tools
            if new_pending:
                summary_response = client.chat.completions.create(
                    model=_MODEL,
                    max_tokens=_MAX_TOKENS,
                    messages=messages,
                )
                summary_msg = summary_response.choices[0].message
                summary_entry = {"role": "assistant", "content": summary_msg.content}
                messages.append(summary_entry)
                history.append(summary_entry)
                return ChatResult(
                    reply=summary_msg.content or "",
                    pending_writes=pending_writes,
                    conversation_history=history,
                )

            continue  # all reads — loop continues

        break  # unexpected finish_reason

    return ChatResult(
        reply="I've gathered the information but hit my iteration limit. Please try a more specific request.",
        pending_writes=pending_writes,
        conversation_history=history,
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

    result_text = json.dumps(results, indent=2, default=str)
    summary_messages = (
        [{"role": "system", "content": system_prompt}]
        + list(conversation_history)
        + [
            {
                "role": "user",
                "content": (
                    "The confirmed operations were executed. Here are the results:\n\n"
                    f"```json\n{result_text}\n```\n\n"
                    "Please provide a concise summary of what was done, noting any failures."
                ),
            }
        ]
    )

    response = client.chat.completions.create(
        model=_MODEL,
        max_tokens=_MAX_TOKENS,
        messages=summary_messages,
    )
    summary = response.choices[0].message.content or ""
    return ExecuteResult(summary=summary, results=results)
