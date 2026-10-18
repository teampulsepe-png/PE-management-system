import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db.session import SessionLocal
from backend.dependencies import get_current_member, CurrentMember
from backend.agent.runner import run_chat, run_execute, PendingWrite
from backend.agent.policy_engine import PolicyEngine

router = APIRouter(prefix="/api/v1/databricks-agent", tags=["databricks-agent"])

_policy_engine = PolicyEngine()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── request / response models ─────────────────────────────────────────────────

class PendingWriteSchema(BaseModel):
    tool_use_id: str
    name: str
    params: dict[str, Any]


class ChatRequest(BaseModel):
    message: str
    conversation_history: list[dict] = []


class ChatResponse(BaseModel):
    reply: str
    pending_writes: list[PendingWriteSchema]
    conversation_history: list[dict]


class ExecuteRequest(BaseModel):
    confirmed_writes: list[PendingWriteSchema]
    conversation_history: list[dict]


class ExecuteResponse(BaseModel):
    summary: str
    results: list[dict]


# ── access gate ───────────────────────────────────────────────────────────────

def _require_pe(member: CurrentMember = Depends(get_current_member)) -> CurrentMember:
    if member.team_id != "pe" and not member.has_admin_access:
        raise HTTPException(
            status_code=403,
            detail="The Databricks agent is only available to PE team members.",
        )
    return member


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
def chat(
    body: ChatRequest,
    member: CurrentMember = Depends(_require_pe),
) -> ChatResponse:
    """
    Phase 1: Process a user message.
    Read tools execute silently. Write tools are returned as pending_writes
    for the user to confirm via /execute.
    """
    result = run_chat(
        user_message=body.message,
        conversation_history=body.conversation_history,
        policy_engine=_policy_engine,
        caller_name=member.name,
        caller_groups=[],  # SCIM group lookup could be added here if needed
    )
    return ChatResponse(
        reply=result.reply,
        pending_writes=[
            PendingWriteSchema(
                tool_use_id=pw.tool_use_id,
                name=pw.name,
                params=pw.params,
            )
            for pw in result.pending_writes
        ],
        conversation_history=result.conversation_history,
    )


@router.post("/execute", response_model=ExecuteResponse)
def execute(
    body: ExecuteRequest,
    member: CurrentMember = Depends(_require_pe),
    db: Session = Depends(get_db),
) -> ExecuteResponse:
    """
    Phase 2: Execute confirmed write operations and return Claude's summary.
    Writes an audit log entry to the database.
    """
    result = run_execute(
        confirmed_writes=[w.model_dump() for w in body.confirmed_writes],
        conversation_history=body.conversation_history,
        policy_engine=_policy_engine,
        caller_name=member.name,
    )

    _write_audit_log(db, member, body.confirmed_writes, result.results)

    return ExecuteResponse(summary=result.summary, results=result.results)


# ── audit log ─────────────────────────────────────────────────────────────────

def _write_audit_log(
    db: Session,
    member: CurrentMember,
    confirmed_writes: list[PendingWriteSchema],
    results: list[dict],
) -> None:
    """Append an audit row to the existing activity_log table if it exists."""
    import json
    try:
        from backend.db.models import ActivityLog  # type: ignore[attr-defined]
        row = ActivityLog(
            id=str(uuid.uuid4()),
            member_id=member.id,
            action="databricks_agent_execute",
            metadata=json.dumps({
                "tools": [w.name for w in confirmed_writes],
                "results": results,
            }),
            created_at=datetime.now(timezone.utc),
        )
        db.add(row)
        db.commit()
    except Exception:
        # Audit log is best-effort — never block execution on a log failure
        pass
