from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.db.models import Task
from backend.schemas import TaskOut

router = APIRouter(prefix="/api/v1", tags=["tasks"])


@router.get("/tasks", response_model=list[TaskOut])
def get_tasks(
    recurrence: Optional[str] = None,
    team_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Task).filter(Task.is_active == True)
    if recurrence:
        query = query.filter(Task.recurrence == recurrence)
    if team_id:
        query = query.filter(Task.team_id == team_id)
    return query.order_by(Task.created_at).all()
