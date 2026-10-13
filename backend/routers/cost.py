import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.db.models import CostEntry
from backend.schemas import (
    CostEntryOut, CostEntryCreate, CostEntryUpdate,
    CostSummaryOut, CostMonthTotal, CostHistoryPoint,
)
from backend.services.databricks_service import run_cost_notebook, DatabricksError

router = APIRouter(prefix="/api/v1", tags=["cost"])

# ── helpers ───────────────────────────────────────────────────────────────────

def _now_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _subtract_months(month: str, n: int) -> str:
    year, m = int(month[:4]), int(month[5:])
    m -= n
    while m <= 0:
        m += 12
        year -= 1
    return f"{year}-{m:02d}"


def _month_range(end: str, n: int) -> list[str]:
    return [_subtract_months(end, n - 1 - i) for i in range(n)]


# ── summary ───────────────────────────────────────────────────────────────────

@router.get("/cost/summary", response_model=CostSummaryOut)
def get_cost_summary(months: int = 6, db: Session = Depends(get_db)):
    current = _now_month()
    previous = _subtract_months(current, 1)
    window = _month_range(current, months)

    rows = (
        db.query(CostEntry)
        .filter(CostEntry.month.in_(window + [previous]))
        .order_by(CostEntry.month, CostEntry.category, CostEntry.service_name)
        .all()
    )

    by_month: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for r in rows:
        by_month[r.month][r.category] += r.amount_cents

    def totals(m: str) -> CostMonthTotal:
        d = by_month.get(m, {})
        return CostMonthTotal(database=d.get("database", 0), compute=d.get("compute", 0), agent=d.get("agent", 0))

    return CostSummaryOut(
        current_month=current,
        current=totals(current),
        previous=totals(previous),
        history=[
            CostHistoryPoint(
                month=m,
                database=by_month[m].get("database", 0),
                compute=by_month[m].get("compute", 0),
                agent=by_month[m].get("agent", 0),
            )
            for m in window
        ],
        entries=[r for r in rows if r.month == current],
    )


# ── entries CRUD ──────────────────────────────────────────────────────────────

@router.get("/cost/entries", response_model=list[CostEntryOut])
def list_cost_entries(month: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(CostEntry)
    if month:
        q = q.filter(CostEntry.month == month)
    return q.order_by(CostEntry.month.desc(), CostEntry.category, CostEntry.service_name).all()


@router.post("/cost/entries", response_model=CostEntryOut, status_code=201)
def create_cost_entry(body: CostEntryCreate, db: Session = Depends(get_db)):
    entry = CostEntry(
        id=str(uuid.uuid4()),
        category=body.category,
        service_name=body.service_name,
        service_description=body.service_description,
        month=body.month,
        amount_cents=body.amount_cents,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/cost/entries/{entry_id}", response_model=CostEntryOut)
def update_cost_entry(entry_id: str, body: CostEntryUpdate, db: Session = Depends(get_db)):
    entry = db.query(CostEntry).filter(CostEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Cost entry not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/cost/entries/{entry_id}", status_code=204)
def delete_cost_entry(entry_id: str, db: Session = Depends(get_db)):
    entry = db.query(CostEntry).filter(CostEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Cost entry not found")
    db.delete(entry)
    db.commit()


# ── Databricks sync ───────────────────────────────────────────────────────────

_DATABRICKS_SERVICE_NAMES = ("App Compute", "Lakebase PostgreSQL")


@router.post("/cost/sync-databricks", response_model=CostSummaryOut)
def sync_from_databricks(months: int = 6, db: Session = Depends(get_db)):
    """
    Run the cost-calculation notebook in Databricks, which queries
    system.billing.usage for month-to-date actuals, then upsert the two
    managed entries for the current month and return an updated summary.
    """
    try:
        result = run_cost_notebook()
    except DatabricksError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    app_cents: int = result.get("app_compute_cents")
    lb_cents:  int = result.get("lakebase_cents")

    if app_cents is None or lb_cents is None:
        raise HTTPException(
            status_code=502,
            detail=(
                "Notebook output missing required keys. "
                "Expected: app_compute_cents, lakebase_cents"
            ),
        )

    current = _now_month()

    # Delete the two managed entries so we can replace them cleanly
    db.query(CostEntry).filter(
        CostEntry.month == current,
        CostEntry.service_name.in_(_DATABRICKS_SERVICE_NAMES),
    ).delete(synchronize_session=False)

    db.add_all([
        CostEntry(
            id=str(uuid.uuid4()),
            category="compute",
            service_name="App Compute",
            service_description="Databricks serverless · month-to-date actual",
            month=current,
            amount_cents=int(app_cents),
        ),
        CostEntry(
            id=str(uuid.uuid4()),
            category="database",
            service_name="Lakebase PostgreSQL",
            service_description="Databricks Lakebase · compute + storage · month-to-date actual",
            month=current,
            amount_cents=int(lb_cents),
        ),
    ])
    db.commit()

    return get_cost_summary(months=months, db=db)
