import json
import re
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.db.models import TaskOccurrence, TaskComment, Task, TeamMember, Notification
from backend.schemas import OccurrenceOut, OccurrenceUpdate, CommentOut, CommentCreate
from backend import sse, push_service

router = APIRouter(prefix="/api/v1", tags=["occurrences"])

_MENTION_RE = re.compile(r'@\[([^\]]+)\]\(([^)]+)\)')


def _extract_mentions(body: str) -> list[tuple[str, str]]:
    """Returns [(display_name, member_id), ...] for every @[Name](id) in the text."""
    return _MENTION_RE.findall(body)


@router.get("/occurrences", response_model=list[OccurrenceOut])
def get_occurrences_for_period(
    period: str,
    task_ids: str,
    db: Session = Depends(get_db),
):
    """
    Fetch occurrences for a list of tasks in a given period.
    task_ids is a comma-separated string: "1,2,3,4"
    Any task that has no occurrence yet gets one created as 'pending'.
    """
    ids = [t.strip() for t in task_ids.split(",") if t.strip()]

    existing = (
        db.query(TaskOccurrence)
        .filter(TaskOccurrence.task_id.in_(ids), TaskOccurrence.period == period)
        .all()
    )

    existing_task_ids = {o.task_id for o in existing}

    new_occurrences = []
    for task_id in ids:
        if task_id not in existing_task_ids:
            occ = TaskOccurrence(
                id=str(uuid.uuid4()),
                task_id=task_id,
                period=period,
                status="pending",
            )
            db.add(occ)
            new_occurrences.append(occ)

    if new_occurrences:
        db.commit()
        for o in new_occurrences:
            db.refresh(o)

    return existing + new_occurrences


@router.get("/tasks/{task_id}/occurrences", response_model=list[OccurrenceOut])
def get_task_history(task_id: str, db: Session = Depends(get_db)):
    """All occurrence records for a task — used by the history grid."""
    return (
        db.query(TaskOccurrence)
        .filter(TaskOccurrence.task_id == task_id)
        .order_by(TaskOccurrence.period)
        .all()
    )


@router.patch("/occurrences/{occurrence_id}", response_model=OccurrenceOut)
def update_occurrence(
    occurrence_id: str,
    body: OccurrenceUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    occ = db.query(TaskOccurrence).filter(TaskOccurrence.id == occurrence_id).first()
    if not occ:
        raise HTTPException(status_code=404, detail="Occurrence not found")

    prev_status = occ.status
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(occ, field, value)
    occ.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(occ)

    if body.status == "done" and prev_status != "done":
        task = db.query(Task).filter(Task.id == occ.task_id).first()
        if task:
            members = (
                db.query(TeamMember)
                .filter(TeamMember.team_id == task.team_id, TeamMember.email.isnot(None))
                .all()
            )
            emails = [m.email for m in members if m.email]
            completed_by = occ.completed_by or "Someone"
            background_tasks.add_task(
                push_service.send_to_emails_sync,
                emails,
                f"✅ {task.title}",
                f"Marked done by {completed_by}",
                "/tasks",
            )

    return occ


@router.get("/occurrences/{occurrence_id}/comments", response_model=list[CommentOut])
def get_comments(occurrence_id: str, db: Session = Depends(get_db)):
    return (
        db.query(TaskComment)
        .filter(TaskComment.occurrence_id == occurrence_id)
        .order_by(TaskComment.created_at)
        .all()
    )


@router.post("/occurrences/{occurrence_id}/comments", response_model=CommentOut, status_code=201)
def add_comment(
    occurrence_id: str,
    body: CommentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    comment = TaskComment(
        id=str(uuid.uuid4()),
        occurrence_id=occurrence_id,
        author=body.author,
        body=body.body,
    )
    db.add(comment)
    db.flush()

    # Parse @mentions → create notification rows, collect SSE payloads
    sse_pushes: list[tuple[str, str]] = []
    mention_emails: list[str] = []
    occ = db.query(TaskOccurrence).filter(TaskOccurrence.id == occurrence_id).first()
    if occ:
        task = db.query(Task).filter(Task.id == occ.task_id).first()
        for display_name, member_id in _extract_mentions(body.body):
            if display_name == body.author:
                continue
            member = db.query(TeamMember).filter(TeamMember.id == member_id).first()
            if not member:
                continue
            if member.email:
                mention_emails.append(member.email)
            notif_id = str(uuid.uuid4())
            notif_time = datetime.now(timezone.utc)
            db.add(Notification(
                id=notif_id,
                recipient_member_id=member_id,
                type="mention",
                task_id=occ.task_id,
                task_recurrence=task.recurrence if task else None,
                occurrence_id=occurrence_id,
                comment_id=comment.id,
                triggered_by_name=body.author,
                message=f"{body.author} mentioned you in a comment on {task.title if task else 'a task'}",
            ))
            sse_pushes.append((member_id, json.dumps({
                "id": notif_id,
                "type": "mention",
                "task_id": occ.task_id,
                "task_recurrence": task.recurrence if task else None,
                "occurrence_id": occurrence_id,
                "triggered_by_name": body.author,
                "message": f"{body.author} mentioned you in a comment on {task.title if task else 'a task'}",
                "is_read": False,
                "created_at": notif_time.isoformat(),
            })))

    db.commit()
    db.refresh(comment)

    # Push to any connected SSE clients after commit
    for member_id, payload in sse_pushes:
        sse.push(member_id, payload)

    if mention_emails and occ:
        background_tasks.add_task(
            push_service.send_to_emails_sync,
            mention_emails,
            f"💬 {task.title if task else 'Task'}",
            f"{body.author} mentioned you in a comment",
            "/tasks",
        )

    return comment
