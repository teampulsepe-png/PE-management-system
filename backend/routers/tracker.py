import uuid as _uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from backend.db.session import get_db
from backend.db.models import TrackerArea, TrackerGroup, TrackerTask, TrackerSubtask
from backend.schemas import (
    TrackerAreaOut, TrackerAreaCreate,
    TrackerGroupCreate,
    TrackerTaskCreate, TrackerTaskUpdate,
    TrackerSubtaskCreate, TrackerSubtaskUpdate,
)

router = APIRouter(prefix="/api/v1", tags=["tracker"])


def _load_areas(db: Session) -> list[TrackerArea]:
    return (
        db.query(TrackerArea)
        .options(
            joinedload(TrackerArea.groups)
            .joinedload(TrackerGroup.tasks)
            .joinedload(TrackerTask.subtasks)
        )
        .order_by(TrackerArea.sort_order, TrackerArea.created_at)
        .all()
    )


@router.get("/tracker", response_model=list[TrackerAreaOut])
def get_tracker(db: Session = Depends(get_db)):
    return _load_areas(db)


# ── Areas ──────────────────────────────────────────────────────────────────────

@router.post("/tracker/areas", response_model=list[TrackerAreaOut], status_code=201)
def create_area(body: TrackerAreaCreate, db: Session = Depends(get_db)):
    sort_order = db.query(TrackerArea).count()
    area = TrackerArea(id=str(_uuid.uuid4()), name=body.name, sort_order=sort_order)
    db.add(area)
    db.commit()
    return _load_areas(db)


@router.delete("/tracker/areas/{area_id}", status_code=204)
def delete_area(area_id: str, db: Session = Depends(get_db)):
    area = db.query(TrackerArea).filter(TrackerArea.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")
    db.delete(area)
    db.commit()


# ── Groups ─────────────────────────────────────────────────────────────────────

@router.post("/tracker/areas/{area_id}/groups", response_model=list[TrackerAreaOut], status_code=201)
def create_group(area_id: str, body: TrackerGroupCreate, db: Session = Depends(get_db)):
    if not db.query(TrackerArea).filter(TrackerArea.id == area_id).first():
        raise HTTPException(status_code=404, detail="Area not found")
    sort_order = db.query(TrackerGroup).filter(TrackerGroup.area_id == area_id).count()
    group = TrackerGroup(id=str(_uuid.uuid4()), area_id=area_id, name=body.name, sort_order=sort_order)
    db.add(group)
    db.commit()
    return _load_areas(db)


@router.delete("/tracker/groups/{group_id}", status_code=204)
def delete_group(group_id: str, db: Session = Depends(get_db)):
    group = db.query(TrackerGroup).filter(TrackerGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    db.delete(group)
    db.commit()


# ── Tasks ──────────────────────────────────────────────────────────────────────

@router.post("/tracker/groups/{group_id}/tasks", response_model=list[TrackerAreaOut], status_code=201)
def create_task(group_id: str, body: TrackerTaskCreate, db: Session = Depends(get_db)):
    if not db.query(TrackerGroup).filter(TrackerGroup.id == group_id).first():
        raise HTTPException(status_code=404, detail="Group not found")
    sort_order = db.query(TrackerTask).filter(TrackerTask.group_id == group_id).count()
    task = TrackerTask(
        id=str(_uuid.uuid4()),
        group_id=group_id,
        title=body.title,
        owner=body.owner,
        planned_end_date=body.planned_end_date,
        sort_order=sort_order,
    )
    db.add(task)
    db.commit()
    return _load_areas(db)


@router.patch("/tracker/tasks/{task_id}", response_model=list[TrackerAreaOut])
def update_task(task_id: str, body: TrackerTaskUpdate, db: Session = Depends(get_db)):
    task = db.query(TrackerTask).filter(TrackerTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.commit()
    return _load_areas(db)


@router.delete("/tracker/tasks/{task_id}", status_code=204)
def delete_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(TrackerTask).filter(TrackerTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()


# ── Subtasks ───────────────────────────────────────────────────────────────────

@router.post("/tracker/tasks/{task_id}/subtasks", response_model=list[TrackerAreaOut], status_code=201)
def create_subtask(task_id: str, body: TrackerSubtaskCreate, db: Session = Depends(get_db)):
    if not db.query(TrackerTask).filter(TrackerTask.id == task_id).first():
        raise HTTPException(status_code=404, detail="Task not found")
    sort_order = db.query(TrackerSubtask).filter(TrackerSubtask.task_id == task_id).count()
    subtask = TrackerSubtask(
        id=str(_uuid.uuid4()),
        task_id=task_id,
        title=body.title,
        date=body.date,
        remarks=body.remarks,
        sort_order=sort_order,
    )
    db.add(subtask)
    db.commit()
    return _load_areas(db)


@router.patch("/tracker/subtasks/{subtask_id}", response_model=list[TrackerAreaOut])
def update_subtask(subtask_id: str, body: TrackerSubtaskUpdate, db: Session = Depends(get_db)):
    subtask = db.query(TrackerSubtask).filter(TrackerSubtask.id == subtask_id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(subtask, field, value)
    db.commit()
    return _load_areas(db)


@router.delete("/tracker/subtasks/{subtask_id}", status_code=204)
def delete_subtask(subtask_id: str, db: Session = Depends(get_db)):
    subtask = db.query(TrackerSubtask).filter(TrackerSubtask.id == subtask_id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")
    db.delete(subtask)
    db.commit()
