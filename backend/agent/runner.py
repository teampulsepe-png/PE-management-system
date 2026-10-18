"""
Provider selector for the agentic loop.

Set LLM_PROVIDER in .env:
  LLM_PROVIDER=anthropic   (default) — uses Anthropic SDK directly
  LLM_PROVIDER=databricks  — uses Databricks AI Gateway via OpenAI-compatible API
"""

from __future__ import annotations

import os

# Dataclasses are always sourced from the canonical Anthropic loop so that
# the rest of the codebase has a single import path regardless of provider.
from backend.agent.loop import ChatResult, ExecuteResult, PendingWrite  # noqa: F401

_PROVIDER = os.getenv("LLM_PROVIDER", "anthropic").lower().strip()

if _PROVIDER == "databricks":
    from backend.agent.loop_databricks import run_chat, run_execute
else:
    from backend.agent.loop import run_chat, run_execute  # type: ignore[assignment]

__all__ = ["run_chat", "run_execute", "PendingWrite", "ChatResult", "ExecuteResult"]
