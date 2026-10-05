import uuid as _uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from backend.db.session import get_db
from backend.db.models import Project, ProjectItem, UserAccessLog, TeamMember
from backend.schemas import (
    ProjectOut, ProjectCreate, ProjectUpdate,
    ProjectItemUpdate, UserAccessLogOut, UserAccessLogCreate,
)

router = APIRouter(prefix="/api/v1", tags=["projects"])

ITEM_TEMPLATE = [
    {"phase": "initiation", "item_key": "usecase_code",        "sort_order": 0},
    {"phase": "initiation", "item_key": "master_data",          "sort_order": 1},
    {"phase": "initiation", "item_key": "repo_creation",        "sort_order": 2},
    {"phase": "initiation", "item_key": "databricks_cluster",   "sort_order": 3},
    {"phase": "initiation", "item_key": "user_group_name",      "sort_order": 4},
    {"phase": "governance", "item_key": "budget_set",           "sort_order": 5},
    {"phase": "governance", "item_key": "dpia_validation",      "sort_order": 6},
    {"phase": "governance", "item_key": "dpia_link",            "sort_order": 7},
    {"phase": "governance", "item_key": "raid_log",             "sort_order": 8},
]


def _load_project(project_id: str, db: Session) -> Project:
    project = (
        db.query(Project)
        .options(
            joinedload(Project.owner),
            joinedload(Project.items).joinedload(ProjectItem.owner),
            joinedload(Project.access_logs).joinedload(UserAccessLog.member),
            joinedload(Project.access_logs).joinedload(UserAccessLog.actioned_by),
        )
        .filter(Project.id == project_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/projects", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return (
        db.query(Project)
        .options(
            joinedload(Project.owner),
            joinedload(Project.items).joinedload(ProjectItem.owner),
            joinedload(Project.access_logs).joinedload(UserAccessLog.member),
            joinedload(Project.access_logs).joinedload(UserAccessLog.actioned_by),
        )
        .order_by(Project.created_at.desc())
        .all()
    )


@router.post("/projects", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(
        id=str(_uuid.uuid4()),
        name=body.name,
        description=body.description,
        owner_id=body.owner_id,
    )
    db.add(project)
    db.flush()

    for tmpl in ITEM_TEMPLATE:
        db.add(ProjectItem(
            id=str(_uuid.uuid4()),
            project_id=project.id,
            **tmpl,
        ))

    db.commit()
    return _load_project(project.id, db)


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)):
    return _load_project(project_id, db)


@router.patch("/projects/{project_id}", response_model=ProjectOut)
def update_project(project_id: str, body: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    return _load_project(project_id, db)


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()


@router.patch("/projects/{project_id}/items/{item_id}", response_model=ProjectOut)
def update_item(project_id: str, item_id: str, body: ProjectItemUpdate, db: Session = Depends(get_db)):
    item = (
        db.query(ProjectItem)
        .filter(ProjectItem.id == item_id, ProjectItem.project_id == project_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    if body.status == "done" and not item.completed_at:
        from datetime import date
        item.completed_at = date.today().isoformat()
    elif body.status and body.status != "done":
        item.completed_at = None
    db.commit()
    return _load_project(project_id, db)


@router.post("/projects/{project_id}/access-logs", response_model=UserAccessLogOut, status_code=201)
def add_access_log(project_id: str, body: UserAccessLogCreate, db: Session = Depends(get_db)):
    _load_project(project_id, db)  # 404 guard
    log = UserAccessLog(
        id=str(_uuid.uuid4()),
        project_id=project_id,
        member_id=body.member_id,
        action=body.action,
        actioned_by_id=body.actioned_by_id,
        notes=body.notes,
        actioned_at=body.actioned_at,
    )
    db.add(log)
    db.commit()
    log = (
        db.query(UserAccessLog)
        .options(
            joinedload(UserAccessLog.member),
            joinedload(UserAccessLog.actioned_by),
        )
        .filter(UserAccessLog.id == log.id)
        .first()
    )
    return log


@router.delete("/projects/{project_id}/access-logs/{log_id}", status_code=204)
def delete_access_log(project_id: str, log_id: str, db: Session = Depends(get_db)):
    log = (
        db.query(UserAccessLog)
        .filter(UserAccessLog.id == log_id, UserAccessLog.project_id == project_id)
        .first()
    )
    if not log:
        raise HTTPException(status_code=404, detail="Access log not found")
    db.delete(log)
    db.commit()
