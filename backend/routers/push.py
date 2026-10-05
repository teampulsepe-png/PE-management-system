import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.db.models import PushSubscription
from backend.dependencies import get_current_member, CurrentMember

router = APIRouter(prefix="/api/v1/push", tags=["push"])


class SubscribeBody(BaseModel):
    endpoint: str
    keys: dict  # {"p256dh": "...", "auth": "..."}


@router.post("/subscribe", status_code=204)
def subscribe(
    body: SubscribeBody,
    db: Session = Depends(get_db),
    member: CurrentMember = Depends(get_current_member),
) -> None:
    existing = db.query(PushSubscription).filter(PushSubscription.endpoint == body.endpoint).first()
    if existing:
        existing.user_email = member.email
        existing.p256dh = body.keys["p256dh"]
        existing.auth   = body.keys["auth"]
    else:
        db.add(PushSubscription(
            id         = str(uuid.uuid4()),
            user_email = member.email,
            endpoint   = body.endpoint,
            p256dh     = body.keys["p256dh"],
            auth       = body.keys["auth"],
        ))
    db.commit()


@router.delete("/subscribe", status_code=204)
def unsubscribe(endpoint: str, db: Session = Depends(get_db)) -> None:
    db.query(PushSubscription).filter(PushSubscription.endpoint == endpoint).delete()
    db.commit()
