import uuid as _uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from backend.db.session import get_db
from backend.db.models import SupervisorTask, SupervisorTaskAssignment, TeamMember
from backend.schemas import (
    SupervisorTaskOut,
    SupervisorTaskCreate,
    SupervisorTaskStatusUpdate,
    SupervisorTaskUpdate,
)

router = APIRouter(prefix="/api/v1", tags=["workload"])


def _load_task(db: Session, task_id: str) -> SupervisorTask:
    return (
        db.query(SupervisorTask)
        .options(
            joinedload(SupervisorTask.assignments)
            .joinedload(SupervisorTaskAssignment.member)
        )
        .filter(SupervisorTask.id == task_id)
        .first()
    )


def _load_tasks(db: Session) -> list[SupervisorTask]:
    return (
        db.query(SupervisorTask)
        .options(
            joinedload(SupervisorTask.assignments)
            .joinedload(SupervisorTaskAssignment.member)
        )
        .order_by(SupervisorTask.created_at.desc())
        .all()
    )


@router.get("/workload/tasks", response_model=list[SupervisorTaskOut])
def get_tasks(db: Session = Depends(get_db)):
    return _load_tasks(db)


@router.post("/workload/tasks", response_model=SupervisorTaskOut, status_code=201)
def create_task(body: SupervisorTaskCreate, db: Session = Depends(get_db)):
    if not body.assignee_ids or len(body.assignee_ids) > 2:
        raise HTTPException(status_code=400, detail="Assign 1 or 2 members")

    task = SupervisorTask(
        id=str(_uuid.uuid4()),
        title=body.title,
        description=body.description,
        size=body.size,
        status='pending',
        start_date=body.start_date,
        due_date=body.due_date,
        created_by=body.created_by,
    )
    db.add(task)
    db.flush()

    for member_id in body.assignee_ids:
        if not db.query(TeamMember).filter(TeamMember.id == member_id).first():
            raise HTTPException(status_code=404, detail=f"Member {member_id} not found")
        db.add(SupervisorTaskAssignment(
            id=str(_uuid.uuid4()),
            task_id=task.id,
            member_id=member_id,
        ))

    db.commit()
    return _load_task(db, task.id)


@router.patch("/workload/tasks/{task_id}/status", response_model=SupervisorTaskOut)
def update_task_status(task_id: str, body: SupervisorTaskStatusUpdate, db: Session = Depends(get_db)):
    task = db.query(SupervisorTask).filter(SupervisorTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = body.status
    db.commit()
    return _load_task(db, task_id)


@router.patch("/workload/tasks/{task_id}", response_model=SupervisorTaskOut)
def update_task(task_id: str, body: SupervisorTaskUpdate, db: Session = Depends(get_db)):
    task = db.query(SupervisorTask).filter(SupervisorTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if body.title is not None:
        task.title = body.title
    if body.description is not None:
        task.description = body.description
    if body.size is not None:
        task.size = body.size
    if body.due_date is not None:
        task.due_date = body.due_date
        if task.status not in ('completed',):
            task.status = 'extended'
    if body.status is not None:
        task.status = body.status

    if body.assignee_ids is not None:
        db.query(SupervisorTaskAssignment).filter(
            SupervisorTaskAssignment.task_id == task_id
        ).delete()
        for member_id in body.assignee_ids:
            db.add(SupervisorTaskAssignment(
                id=str(_uuid.uuid4()),
                task_id=task_id,
                member_id=member_id,
            ))

    db.commit()
    return _load_task(db, task_id)


@router.delete("/workload/tasks/{task_id}", status_code=204)
def delete_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(SupervisorTask).filter(SupervisorTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
