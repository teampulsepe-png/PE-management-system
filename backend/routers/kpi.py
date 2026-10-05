import uuid as _uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from backend.db.session import get_db
from backend.db.models import KpiMetric, KpiEvaluation, KpiEvaluationEntry
from backend.dependencies import get_current_member, CurrentMember
from backend.schemas import (
    KpiMetricOut, KpiEvaluationOut, KpiMetricUpdate,
    KpiEvaluationEntryOut, KpiEvaluationEntryCreate,
)

router = APIRouter(prefix="/api/v1", tags=["kpi"])

# ── helpers ──────────────────────────────────────────────────────────────────

def _load_eval(evaluation_id: str, db: Session) -> KpiEvaluation:
    ev = (
        db.query(KpiEvaluation)
        .options(joinedload(KpiEvaluation.entries))
        .filter(KpiEvaluation.id == evaluation_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    return ev


def _sync_actual(ev: KpiEvaluation, db: Session) -> None:
    count = (
        db.query(func.count(KpiEvaluationEntry.id))
        .filter(KpiEvaluationEntry.kpi_evaluation_id == ev.id)
        .scalar()
    )
    ev.actual = count if count > 0 else None
    ev.completed_at = datetime.now(timezone.utc) if count > 0 else None


# ── read ──────────────────────────────────────────────────────────────────────

@router.get("/kpi/categories", response_model=list[str])
def get_kpi_categories(db: Session = Depends(get_db)):
    rows = db.query(KpiMetric.category).distinct().order_by(KpiMetric.category).all()
    return [r[0] for r in rows]


@router.get("/kpi", response_model=list[KpiMetricOut])
def get_kpi_metrics(
    year: Optional[int] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_member: CurrentMember = Depends(get_current_member),
):
    query = db.query(KpiMetric).options(
        joinedload(KpiMetric.evaluations).joinedload(KpiEvaluation.entries),
        joinedload(KpiMetric.kpi_owner_member),
        joinedload(KpiMetric.responsible_member),
    )
    if year is not None:
        query = query.filter(KpiMetric.year == year)
    if category:
        query = query.filter(KpiMetric.category == category)
    # admin and head see all; lead/user see only metrics they own or are responsible for
    if current_member.role not in ('head', 'admin'):
        query = query.filter(
            (KpiMetric.responsible_party_id == current_member.id) |
            (KpiMetric.kpi_owner_id == current_member.id)
        )
    return query.order_by(KpiMetric.category, KpiMetric.metric_name).all()


# ── evaluation entries ────────────────────────────────────────────────────────

@router.post("/kpi/evaluations/{evaluation_id}/entries", response_model=KpiEvaluationOut)
def add_kpi_evaluation_entry(
    evaluation_id: str,
    body: KpiEvaluationEntryCreate,
    db: Session = Depends(get_db),
):
    ev = _load_eval(evaluation_id, db)
    entry = KpiEvaluationEntry(
        id=str(_uuid.uuid4()),
        kpi_evaluation_id=evaluation_id,
        done_at=body.done_at,
    )
    db.add(entry)
    db.flush()
    _sync_actual(ev, db)
    db.commit()
    db.refresh(ev)
    return ev


@router.delete("/kpi/evaluations/entries/{entry_id}", status_code=204)
def delete_kpi_evaluation_entry(
    entry_id: str,
    db: Session = Depends(get_db),
):
    entry = db.query(KpiEvaluationEntry).filter(KpiEvaluationEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    ev_id = entry.kpi_evaluation_id
    db.delete(entry)
    db.flush()
    ev = _load_eval(ev_id, db)
    _sync_actual(ev, db)
    db.commit()


# ── metric update ─────────────────────────────────────────────────────────────

@router.patch("/kpi/{metric_id}", response_model=KpiMetricOut)
def update_kpi_metric(
    metric_id: str,
    body: KpiMetricUpdate,
    db: Session = Depends(get_db),
):
    metric = (
        db.query(KpiMetric)
        .options(
            joinedload(KpiMetric.evaluations).joinedload(KpiEvaluation.entries),
            joinedload(KpiMetric.kpi_owner_member),
            joinedload(KpiMetric.responsible_member),
        )
        .filter(KpiMetric.id == metric_id)
        .first()
    )
    if not metric:
        raise HTTPException(status_code=404, detail="KPI metric not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(metric, field, value)
    db.commit()
    db.refresh(metric)
    return metric
