import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db.session import SessionLocal
from backend.dependencies import get_current_member, require_admin, CurrentMember
from backend.agent.runner import run_chat, run_execute, PendingWrite
from backend.agent.policy_engine import PolicyEngine
from backend.db.models import AgentConfig

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


class AgentStatusResponse(BaseModel):
    enabled: bool
    updated_by: str | None = None


# ── access gate ───────────────────────────────────────────────────────────────

def _require_pe(member: CurrentMember = Depends(get_current_member)) -> CurrentMember:
    if member.team_id != "pe" and not member.is_admin:
        raise HTTPException(
            status_code=403,
            detail="The Databricks agent is only available to PE team members.",
        )
    return member


# ── agent config helpers ──────────────────────────────────────────────────────

def _get_or_create_config(db: Session) -> AgentConfig:
    config = db.query(AgentConfig).first()
    if not config:
        config = AgentConfig(id=1, agent_enabled=True)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def _guard_enabled(db: Session) -> None:
    """Raises 503 if the agent has been disabled by an admin."""
    config = _get_or_create_config(db)
    if not config.agent_enabled:
        raise HTTPException(
            status_code=503,
            detail="The Databricks agent has been disabled by an admin.",
        )


# ── status / toggle endpoints ─────────────────────────────────────────────────

@router.get("/status", response_model=AgentStatusResponse)
def get_status(
    member: CurrentMember = Depends(_require_pe),
    db: Session = Depends(get_db),
) -> AgentStatusResponse:
    config = _get_or_create_config(db)
    return AgentStatusResponse(enabled=config.agent_enabled, updated_by=config.updated_by)


@router.post("/admin/toggle", response_model=AgentStatusResponse)
def toggle_agent(
    member: CurrentMember = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AgentStatusResponse:
    config = _get_or_create_config(db)
    config.agent_enabled = not config.agent_enabled
    config.updated_by = member.name or member.email
    db.commit()
    db.refresh(config)
    return AgentStatusResponse(enabled=config.agent_enabled, updated_by=config.updated_by)


# ── chat / execute endpoints ──────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
def chat(
    body: ChatRequest,
    member: CurrentMember = Depends(_require_pe),
    db: Session = Depends(get_db),
) -> ChatResponse:
    _guard_enabled(db)
    result = run_chat(
        user_message=body.message,
        conversation_history=body.conversation_history,
        policy_engine=_policy_engine,
        caller_name=member.name,
        caller_groups=[],
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
    _guard_enabled(db)
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
        pass
