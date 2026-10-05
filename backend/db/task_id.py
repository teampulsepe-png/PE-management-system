from datetime import date
from sqlalchemy.orm import Session
from .models import TaskIdCounter

_REC_CODE = {
    'weekly':    'W',
    'monthly':   'M',
    'quarterly': 'Q',
    'annually':  'A',
}


def generate_task_id(db: Session, team_id: str, recurrence: str, year: int | None = None) -> str:
    """
    Generates the next structured task ID for the given team + recurrence + year.
    Format: {TEAM}-{REC}-{YEAR}-{SEQ:03d}   e.g. PE-W-2026-003

    Uses SELECT FOR UPDATE to prevent duplicate sequences under concurrent requests.
    Must be called inside an active transaction; caller is responsible for commit.
    """
    if year is None:
        year = date.today().year

    rec_code = _REC_CODE[recurrence]

    row = (
        db.query(TaskIdCounter)
        .filter_by(team_id=team_id, recurrence=recurrence, year=year)
        .with_for_update()
        .first()
    )

    if row is None:
        row = TaskIdCounter(team_id=team_id, recurrence=recurrence, year=year, counter=1)
        db.add(row)
    else:
        row.counter += 1

    db.flush()

    return f"{team_id.upper()}-{rec_code}-{year}-{str(row.counter).zfill(3)}"
