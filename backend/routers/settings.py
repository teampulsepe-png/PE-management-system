import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from backend.db.session import get_db
from backend.db.models import Team, TeamMember, Role, HeadTeamAssignment, TeamFeatureFlag
from backend.dependencies import require_admin, get_current_member, CurrentMember
from backend.schemas import (
    TeamOut, TeamCreate, TeamUpdate,
    MemberDetailOut, MemberCreate, MemberUpdate,
    TeamWithMembersOut, RoleOut,
    TeamPermissionsOut, TeamPermissionUpdate,
)

TEAM_FEATURES = [
    'tasks', 'kpi', 'workload', 'pipelines',
    'ai_subscriptions', 'project_lifecycle', 'tracker', 'cost',
    'liveops', 'devops', 'agent',
]

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

VALID_ROLES = {"user", "lead", "head", "admin"}


# ── helpers ───────────────────────────────────────────────────────────────────

def _load_member(member_id: str, db: Session) -> TeamMember:
    member = (
        db.query(TeamMember)
        .options(
            joinedload(TeamMember.role),
            joinedload(TeamMember.head_assignments).joinedload(HeadTeamAssignment.team),
        )
        .filter(TeamMember.id == member_id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


def _enrich_member(member: TeamMember, db: Session) -> MemberDetailOut:
    """Build MemberDetailOut, resolving team_name separately."""
    team_name = None
    if member.team_id:
        team = db.query(Team).filter(Team.id == member.team_id).first()
        team_name = team.name if team else None

    role_name = member.role.name if member.role else None
    head_team_ids = [a.team_id for a in member.head_assignments]
    head_team_names = [a.team.name for a in member.head_assignments if a.team]

    return MemberDetailOut(
        id=member.id,
        name=member.name,
        email=member.email,
        team_id=member.team_id,
        team_name=team_name,
        role_id=member.role_id,
        role_name=role_name,
        head_team_ids=head_team_ids,
        head_team_names=head_team_names,
        has_admin_access=bool(member.has_admin_access),
    )


def _set_head_assignments(member: TeamMember, head_team_ids: list[str], db: Session) -> None:
    """Replace all head team assignments for a member."""
    db.query(HeadTeamAssignment).filter(HeadTeamAssignment.member_id == member.id).delete()
    for team_id in head_team_ids:
        team = db.query(Team).filter(Team.id == team_id).first()
        if not team:
            raise HTTPException(status_code=404, detail=f"Team '{team_id}' not found")
        db.add(HeadTeamAssignment(
            id=str(uuid.uuid4()),
            member_id=member.id,
            team_id=team_id,
        ))


# ── roles ─────────────────────────────────────────────────────────────────────

@router.get("/roles", response_model=list[RoleOut])
def list_roles(
    db: Session = Depends(get_db),
    _: CurrentMember = Depends(get_current_member),
):
    return db.query(Role).order_by(Role.name).all()


# ── teams ─────────────────────────────────────────────────────────────────────

@router.get("/teams", response_model=list[TeamWithMembersOut])
def list_teams(
    db: Session = Depends(get_db),
    _: CurrentMember = Depends(require_admin),
):
    teams = db.query(Team).order_by(Team.name).all()
    result = []
    for team in teams:
        members = (
            db.query(TeamMember)
            .options(
                joinedload(TeamMember.role),
                joinedload(TeamMember.head_assignments).joinedload(HeadTeamAssignment.team),
            )
            .filter(TeamMember.team_id == team.id)
            .order_by(TeamMember.name)
            .all()
        )
        enriched = [_enrich_member(m, db) for m in members]
        result.append(TeamWithMembersOut(
            id=team.id,
            name=team.name,
            member_count=len(enriched),
            members=enriched,
        ))
    return result


@router.post("/teams", response_model=TeamOut, status_code=201)
def create_team(
    body: TeamCreate,
    db: Session = Depends(get_db),
    _: CurrentMember = Depends(require_admin),
):
    existing = db.query(Team).filter(Team.name == body.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="A team with this name already exists")
    team = Team(id=str(uuid.uuid4()), name=body.name)
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


@router.patch("/teams/{team_id}", response_model=TeamOut)
def update_team(
    team_id: str,
    body: TeamUpdate,
    db: Session = Depends(get_db),
    _: CurrentMember = Depends(require_admin),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    conflict = db.query(Team).filter(Team.name == body.name, Team.id != team_id).first()
    if conflict:
        raise HTTPException(status_code=409, detail="A team with this name already exists")
    team.name = body.name
    db.commit()
    db.refresh(team)
    return team


@router.delete("/teams/{team_id}", status_code=204)
def delete_team(
    team_id: str,
    db: Session = Depends(get_db),
    _: CurrentMember = Depends(require_admin),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    member_count = db.query(TeamMember).filter(TeamMember.team_id == team_id).count()
    if member_count > 0:
        raise HTTPException(status_code=409, detail="Cannot delete a team that still has members")
    db.delete(team)
    db.commit()


# ── members ───────────────────────────────────────────────────────────────────

@router.get("/members", response_model=list[MemberDetailOut])
def list_members(
    db: Session = Depends(get_db),
    _: CurrentMember = Depends(require_admin),
):
    members = (
        db.query(TeamMember)
        .options(
            joinedload(TeamMember.role),
            joinedload(TeamMember.head_assignments).joinedload(HeadTeamAssignment.team),
        )
        .order_by(TeamMember.name)
        .all()
    )
    return [_enrich_member(m, db) for m in members]


@router.post("/members", response_model=MemberDetailOut, status_code=201)
def create_member(
    body: MemberCreate,
    db: Session = Depends(get_db),
    _: CurrentMember = Depends(require_admin),
):
    if body.role_name not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")

    if body.role_name != 'admin' and not body.team_id:
        raise HTTPException(status_code=400, detail="team_id is required for non-admin members")

    if body.team_id:
        team = db.query(Team).filter(Team.id == body.team_id).first()
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")

    role = db.query(Role).filter(Role.name == body.role_name).first()
    if not role:
        raise HTTPException(status_code=404, detail=f"Role '{body.role_name}' not found in database")

    # Admins have no team
    team_id = None if body.role_name == 'admin' else body.team_id

    member = TeamMember(
        id=str(uuid.uuid4()),
        name=body.name,
        email=body.email,
        team_id=team_id,
        role_id=role.id,
    )
    db.add(member)
    db.flush()

    if body.role_name == 'head' and body.head_team_ids:
        _set_head_assignments(member, body.head_team_ids, db)

    db.commit()
    return _enrich_member(_load_member(member.id, db), db)


@router.patch("/members/{member_id}", response_model=MemberDetailOut)
def update_member(
    member_id: str,
    body: MemberUpdate,
    db: Session = Depends(get_db),
    _: CurrentMember = Depends(require_admin),
):
    member = _load_member(member_id, db)

    if body.name is not None:
        member.name = body.name
    if body.email is not None:
        member.email = body.email

    if body.role_name is not None:
        if body.role_name not in VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")
        role = db.query(Role).filter(Role.name == body.role_name).first()
        if not role:
            raise HTTPException(status_code=404, detail=f"Role '{body.role_name}' not found")
        member.role_id = role.id

        # Admin members have no team
        if body.role_name == 'admin':
            member.team_id = None
            db.query(HeadTeamAssignment).filter(HeadTeamAssignment.member_id == member_id).delete()

    if body.unassign_team:
        effective_role = body.role_name or (member.role.name if member.role else None)
        if effective_role == 'admin':
            raise HTTPException(status_code=400, detail="Admin members do not have team assignments")
        member.team_id = None

    if body.team_id is not None:
        effective_role = body.role_name or (member.role.name if member.role else None)
        if effective_role == 'admin':
            raise HTTPException(status_code=400, detail="Admin members cannot be assigned to a team")
        team = db.query(Team).filter(Team.id == body.team_id).first()
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")
        member.team_id = body.team_id

    if body.head_team_ids is not None:
        effective_role = body.role_name or (member.role.name if member.role else None)
        if effective_role != 'head':
            raise HTTPException(status_code=400, detail="head_team_ids can only be set for members with the 'head' role")
        _set_head_assignments(member, body.head_team_ids, db)

    if body.has_admin_access is not None:
        if member.role and member.role.name == 'admin':
            raise HTTPException(status_code=400, detail="Admin role members always have full access; toggle is not applicable")
        member.has_admin_access = body.has_admin_access

    db.commit()
    return _enrich_member(_load_member(member_id, db), db)


@router.delete("/members/{member_id}", status_code=204)
def delete_member(
    member_id: str,
    db: Session = Depends(get_db),
    current: CurrentMember = Depends(require_admin),
):
    if member_id == current.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    member = db.query(TeamMember).filter(TeamMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()


# ── team permissions ───────────────────────────────────────────────────────────

def _get_permissions_dict(team_id: str, db: Session) -> dict:
    flags = db.query(TeamFeatureFlag).filter(TeamFeatureFlag.team_id == team_id).all()
    stored = {f.feature: f.enabled for f in flags}
    return {feat: stored.get(feat, True) for feat in TEAM_FEATURES}


@router.get("/teams/{team_id}/permissions", response_model=TeamPermissionsOut)
def get_team_permissions(
    team_id: str,
    db: Session = Depends(get_db),
    _: CurrentMember = Depends(get_current_member),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    perms = _get_permissions_dict(team_id, db)
    return TeamPermissionsOut(team_id=team_id, **perms)


@router.patch("/teams/{team_id}/permissions", response_model=TeamPermissionsOut)
def update_team_permission(
    team_id: str,
    body: TeamPermissionUpdate,
    db: Session = Depends(get_db),
    _: CurrentMember = Depends(require_admin),
):
    if body.feature not in TEAM_FEATURES:
        raise HTTPException(status_code=400, detail=f"Invalid feature. Must be one of: {', '.join(TEAM_FEATURES)}")
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    flag = db.query(TeamFeatureFlag).filter(
        TeamFeatureFlag.team_id == team_id,
        TeamFeatureFlag.feature == body.feature,
    ).first()
    if flag:
        flag.enabled = body.enabled
    else:
        db.add(TeamFeatureFlag(
            id=str(uuid.uuid4()),
            team_id=team_id,
            feature=body.feature,
            enabled=body.enabled,
        ))
    db.commit()
    perms = _get_permissions_dict(team_id, db)
    return TeamPermissionsOut(team_id=team_id, **perms)
