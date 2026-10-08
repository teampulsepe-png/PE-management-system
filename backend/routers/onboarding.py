from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from backend.db.session import get_db
from backend.db.models import MemberRequest, Role, Team, TeamMember
from backend.dependencies import CurrentMember, get_current_member, require_admin
from backend.schemas import MemberRequestApprove, MemberRequestCreate, MemberRequestOut, MemberRequestReject
from backend.push_service import send_to_emails_sync

router = APIRouter(prefix="/api/v1/onboarding", tags=["onboarding"])


@router.get("/teams")
def list_teams_public(db: Session = Depends(get_db)):
    teams = db.query(Team).order_by(Team.name).all()
    return [{"id": t.id, "name": t.name} for t in teams]


def _load(request_id: str, db: Session) -> MemberRequest:
    r = (
        db.query(MemberRequest)
        .options(joinedload(MemberRequest.requested_team), joinedload(MemberRequest.reviewed_by))
        .filter(MemberRequest.id == request_id)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    return r


@router.get("/request/me", response_model=MemberRequestOut | None)
def get_my_request(current: CurrentMember = Depends(get_current_member), db: Session = Depends(get_db)):
    r = (
        db.query(MemberRequest)
        .options(joinedload(MemberRequest.requested_team), joinedload(MemberRequest.reviewed_by))
        .filter(MemberRequest.email == current.email)
        .order_by(MemberRequest.created_at.desc())
        .first()
    )
    if not r:
        return None
    return MemberRequestOut.from_orm_obj(r)


@router.post("/request", response_model=MemberRequestOut, status_code=201)
def submit_request(
    body: MemberRequestCreate,
    background_tasks: BackgroundTasks,
    current: CurrentMember = Depends(get_current_member),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(MemberRequest)
        .filter(MemberRequest.email == current.email, MemberRequest.status == "pending")
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="A pending request already exists for this email")

    team = db.query(Team).filter(Team.id == body.requested_team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    r = MemberRequest(
        email=current.email,
        name=body.name.strip(),
        requested_team_id=body.requested_team_id,
        note=body.note.strip() if body.note else None,
    )
    db.add(r)
    db.commit()
    db.refresh(r)

    # Notify all admins
    admin_emails = [
        m.email for m in db.query(TeamMember).join(TeamMember.role).filter(Role.name == "admin").all()
        if m.email
    ]
    if admin_emails:
        background_tasks.add_task(
            send_to_emails_sync,
            admin_emails,
            "New access request",
            f"{body.name} ({current.email}) is requesting access to the system.",
            "/settings",
        )

    return MemberRequestOut.from_orm_obj(_load(r.id, db))


@router.get("/requests", response_model=list[MemberRequestOut])
def list_requests(
    status: str = "pending",
    current: CurrentMember = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(MemberRequest)
        .options(joinedload(MemberRequest.requested_team), joinedload(MemberRequest.reviewed_by))
        .filter(MemberRequest.status == status)
        .order_by(MemberRequest.created_at.asc())
        .all()
    )
    return [MemberRequestOut.from_orm_obj(r) for r in rows]


@router.get("/requests/pending-count")
def pending_count(current: CurrentMember = Depends(require_admin), db: Session = Depends(get_db)):
    count = db.query(MemberRequest).filter(MemberRequest.status == "pending").count()
    return {"count": count}


@router.post("/requests/{request_id}/approve", response_model=MemberRequestOut)
def approve_request(
    request_id: str,
    body: MemberRequestApprove,
    current: CurrentMember = Depends(require_admin),
    db: Session = Depends(get_db),
):
    r = _load(request_id, db)
    if r.status != "pending":
        raise HTTPException(status_code=409, detail="Request is not pending")

    role = db.query(Role).filter(Role.name == body.role_name).first()
    if not role:
        raise HTTPException(status_code=404, detail=f"Role '{body.role_name}' not found")

    team_id = r.requested_team_id if body.role_name != "admin" else None

    member = TeamMember(
        name=r.name,
        email=r.email,
        role_id=role.id,
        team_id=team_id,
    )
    db.add(member)

    r.status = "approved"
    r.reviewed_by_id = current.id
    r.reviewed_at = datetime.now(timezone.utc)
    db.commit()

    return MemberRequestOut.from_orm_obj(_load(request_id, db))


@router.post("/requests/{request_id}/reject", response_model=MemberRequestOut)
def reject_request(
    request_id: str,
    body: MemberRequestReject,
    current: CurrentMember = Depends(require_admin),
    db: Session = Depends(get_db),
):
    r = _load(request_id, db)
    if r.status != "pending":
        raise HTTPException(status_code=409, detail="Request is not pending")

    r.status = "rejected"
    r.rejection_reason = body.reason
    r.reviewed_by_id = current.id
    r.reviewed_at = datetime.now(timezone.utc)
    db.commit()

    return MemberRequestOut.from_orm_obj(_load(request_id, db))
