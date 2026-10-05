import uuid as _uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from backend.db.session import get_db
from backend.db.models import Department, AiTool, AiSubscription, AiSubscriptionAddon
from backend.schemas import (
    DepartmentOut, AiToolOut,
    AiSubscriptionOut, AiSubscriptionCreate, AiSubscriptionUpdate,
    AiSubscriptionAddonCreate,
)

router = APIRouter(prefix="/api/v1", tags=["subscriptions"])


def _load_sub(sub_id: str, db: Session) -> AiSubscription:
    sub = (
        db.query(AiSubscription)
        .options(
            joinedload(AiSubscription.department),
            joinedload(AiSubscription.tool),
            joinedload(AiSubscription.addons),
        )
        .filter(AiSubscription.id == sub_id)
        .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return sub


# ── lookups ───────────────────────────────────────────────────────────────────

@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    return db.query(Department).order_by(Department.name).all()


@router.get("/ai-tools", response_model=list[AiToolOut])
def list_ai_tools(db: Session = Depends(get_db)):
    return db.query(AiTool).order_by(AiTool.name, AiTool.tier).all()


# ── subscriptions ─────────────────────────────────────────────────────────────

@router.get("/ai-subscriptions", response_model=list[AiSubscriptionOut])
def list_subscriptions(db: Session = Depends(get_db)):
    return (
        db.query(AiSubscription)
        .options(
            joinedload(AiSubscription.department),
            joinedload(AiSubscription.tool),
            joinedload(AiSubscription.addons),
        )
        .order_by(AiSubscription.created_at.desc())
        .all()
    )


@router.post("/ai-subscriptions", response_model=AiSubscriptionOut, status_code=201)
def create_subscription(body: AiSubscriptionCreate, db: Session = Depends(get_db)):
    sub = AiSubscription(
        id=str(_uuid.uuid4()),
        subscriber_name=body.subscriber_name,
        email=body.email,
        department_id=body.department_id,
        tool_id=body.tool_id,
        start_date=body.start_date,
        end_date=body.end_date,
        remarks=body.remarks,
    )
    db.add(sub)
    db.commit()
    return _load_sub(sub.id, db)


@router.patch("/ai-subscriptions/{sub_id}", response_model=AiSubscriptionOut)
def update_subscription(sub_id: str, body: AiSubscriptionUpdate, db: Session = Depends(get_db)):
    sub = _load_sub(sub_id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(sub, field, value)
    db.commit()
    return _load_sub(sub_id, db)


@router.delete("/ai-subscriptions/{sub_id}", status_code=204)
def delete_subscription(sub_id: str, db: Session = Depends(get_db)):
    sub = db.query(AiSubscription).filter(AiSubscription.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    db.delete(sub)
    db.commit()


# ── add-ons — specific route BEFORE parameterised ─────────────────────────────

@router.delete("/ai-subscriptions/addons/{addon_id}", status_code=204)
def delete_addon(addon_id: str, db: Session = Depends(get_db)):
    addon = db.query(AiSubscriptionAddon).filter(AiSubscriptionAddon.id == addon_id).first()
    if not addon:
        raise HTTPException(status_code=404, detail="Addon not found")
    db.delete(addon)
    db.commit()


@router.post("/ai-subscriptions/{sub_id}/addons", response_model=AiSubscriptionOut)
def add_addon(sub_id: str, body: AiSubscriptionAddonCreate, db: Session = Depends(get_db)):
    _load_sub(sub_id, db)  # 404 if missing
    import calendar
    from datetime import date
    start = date.fromisoformat(body.start_date)
    month = start.month % 12 + 1
    year  = start.year + (1 if start.month == 12 else 0)
    day   = min(start.day, calendar.monthrange(year, month)[1])
    end_date = date(year, month, day).isoformat()

    addon = AiSubscriptionAddon(
        id=str(_uuid.uuid4()),
        subscription_id=sub_id,
        credits=body.credits,
        start_date=body.start_date,
        end_date=end_date,
        remarks=body.remarks,
    )
    db.add(addon)
    db.commit()
    return _load_sub(sub_id, db)
