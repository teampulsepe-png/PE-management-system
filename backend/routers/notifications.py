import asyncio
import os
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.db.models import Notification, TeamMember
from backend.schemas import NotificationOut
from backend import sse

router = APIRouter(prefix="/api/v1", tags=["notifications"])


def _get_member(request: Request, db: Session) -> TeamMember | None:
    email = request.headers.get("X-Forwarded-Email") or os.getenv("LOCAL_USER_EMAIL")
    if not email:
        return None
    return db.query(TeamMember).filter(TeamMember.email == email).first()


@router.get("/notifications", response_model=list[NotificationOut])
def get_notifications(request: Request, db: Session = Depends(get_db)):
    member = _get_member(request, db)
    if not member:
        return []
    return (
        db.query(Notification)
        .filter(Notification.recipient_member_id == member.id)
        .order_by(Notification.created_at.desc())
        .limit(20)
        .all()
    )


@router.patch("/notifications/read")
def mark_all_read(request: Request, db: Session = Depends(get_db)):
    member = _get_member(request, db)
    if not member:
        return {"updated": 0}
    updated = (
        db.query(Notification)
        .filter(
            Notification.recipient_member_id == member.id,
            Notification.is_read == False,  # noqa: E712
        )
        .update({"is_read": True})
    )
    db.commit()
    return {"updated": updated}


@router.get("/notifications/stream")
async def notification_stream(request: Request, db: Session = Depends(get_db)):
    member = _get_member(request, db)

    async def empty_stream():
        """Keepalive-only stream for unauthenticated or unrecognised users."""
        while True:
            if await request.is_disconnected():
                break
            yield ": ping\n\n"
            await asyncio.sleep(25)

    if not member:
        return StreamingResponse(
            empty_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    queue: asyncio.Queue = asyncio.Queue()
    sse.register(member.id, queue)

    async def event_stream():
        try:
            yield "retry: 3000\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield f"data: {data}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            sse.unregister(member.id, queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
