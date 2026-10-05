from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.db.models import TaskOccurrence, Task
from backend.schemas import ActivityItem

router = APIRouter(prefix="/api/v1", tags=["activity"])


@router.get("/activity", response_model=list[ActivityItem])
def get_recent_activity(limit: int = 10, db: Session = Depends(get_db)):
    rows = (
        db.query(TaskOccurrence, Task)
        .join(Task, TaskOccurrence.task_id == Task.id)
        .filter(TaskOccurrence.status == "done")
        .filter(TaskOccurrence.completed_at.isnot(None))
        .order_by(TaskOccurrence.completed_at.desc())
        .limit(limit)
        .all()
    )
    return [
        ActivityItem(
            task_title=task.title,
            task_team=task.team_id,
            completed_by=occ.completed_by,
            completed_at=occ.completed_at,
            period=occ.period,
        )
        for occ, task in rows
    ]
