"""
Two-phase agentic loop — Databricks AI Gateway provider (OpenAI-compatible).

Requires:
  DATABRICKS_HOST=https://<workspace>.azuredatabricks.net
  DATABRICKS_TOKEN=dapi...
  DATABRICKS_ENDPOINT_NAME=<model-serving-endpoint-name>

All three dataclass return types are imported from loop.py so the rest of the
codebase has a single canonical definition regardless of which provider is active.
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

_MAX_TOKENS = 4096
_MAX_LOOP_TURNS = 12


# ── helpers ───────────────────────────────────────────────────────────────────

def _get_client() -> tuple[OpenAI, str]:
    """Return (OpenAI-compatible client, endpoint/model name) for Databricks."""
    host = os.getenv("DATABRICKS_HOST", "").rstrip("/")
    token = os.getenv("DATABRICKS_TOKEN")
    endpoint = os.getenv("DATABRICKS_ENDPOINT_NAME")
    if not host or not token:
        raise RuntimeError("DATABRICKS_HOST and DATABRICKS_TOKEN must be set in .env")
    if not endpoint:
        raise RuntimeError("DATABRICKS_ENDPOINT_NAME must be set in .env")
    client = OpenAI(
        base_url=f"{host}/serving-endpoints",
        api_key=token,
    )
    return client, endpoint


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
    client, model = _get_client()
    system_prompt = build_system_prompt(policy_engine, caller_name, caller_groups or [])
    openai_tools = _to_openai_tools(ALL_TOOLS)

    # conversation_history stores user/assistant/tool messages only (no system msg)
    messages: list[dict] = list(conversation_history) + [
        {"role": "user", "content": user_message}
    ]
    pending_writes: list[PendingWrite] = []

    for _ in range(_MAX_LOOP_TURNS):
        api_messages = [{"role": "system", "content": system_prompt}] + messages

        response = client.chat.completions.create(
            model=model,
            max_tokens=_MAX_TOKENS,
            messages=api_messages,
            tools=openai_tools,
            tool_choice="auto",
        )

        choice = response.choices[0]
        msg = choice.message

        # Append assistant turn to history
        assistant_entry: dict[str, Any] = {"role": "assistant", "content": msg.content}
        if msg.tool_calls:
            assistant_entry["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in msg.tool_calls
            ]
        messages.append(assistant_entry)

        # ── stop: final text response ──────────────────────────────────────────
        if choice.finish_reason == "stop":
            return ChatResult(
                reply=msg.content or "",
                pending_writes=pending_writes,
                conversation_history=messages,
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
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": f"ERROR: '{name}' is a blocked operation and cannot be executed.",
                    })
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
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "content": f"POLICY_VIOLATION: {violation}",
                        })
                    else:
                        new_pending.append(
                            PendingWrite(tool_use_id=tc.id, name=name, params=params)
                        )
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "content": json.dumps({
                                "status": "pending_confirmation",
                                "message": "This write operation has been queued. "
                                           "The user will confirm before execution.",
                            }),
                        })
                    continue

                # ── read tool: execute silently ────────────────────────────────
                try:
                    result = _execute_tool(name, params)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps(result, default=str),
                    })
                except Exception as exc:
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": f"ERROR: {exc}",
                    })

            pending_writes.extend(new_pending)

            # Write ops were queued — ask model to summarise the plan
            if new_pending:
                api_messages = [{"role": "system", "content": system_prompt}] + messages
                summary_response = client.chat.completions.create(
                    model=model,
                    max_tokens=_MAX_TOKENS,
                    messages=api_messages,
                )
                summary_msg = summary_response.choices[0].message
                messages.append({"role": "assistant", "content": summary_msg.content})
                return ChatResult(
                    reply=summary_msg.content or "",
                    pending_writes=pending_writes,
                    conversation_history=messages,
                )

            continue  # all reads — continue loop

        break  # unexpected finish_reason

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
    client, model = _get_client()
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
        model=model,
        max_tokens=_MAX_TOKENS,
        messages=summary_messages,
    )
    summary = response.choices[0].message.content or ""
    return ExecuteResult(summary=summary, results=results)
