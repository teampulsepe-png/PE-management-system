import os
from dataclasses import dataclass, field
from typing import Optional
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from backend.db.session import get_db
from backend.db.models import TeamMember, HeadTeamAssignment


@dataclass
class CurrentMember:
    email: str
    id: Optional[str]
    name: Optional[str]
    team_id: Optional[str]
    role: Optional[str]  # 'user', 'lead', 'head', 'admin', or None
    head_team_ids: list = field(default_factory=list)
    head_team_names: list = field(default_factory=list)
    has_admin_access: bool = False

    @property
    def is_admin(self) -> bool:
        return self.role == 'admin' or self.has_admin_access


def get_current_member(request: Request, db: Session = Depends(get_db)) -> CurrentMember:
    email = request.headers.get("X-Forwarded-Email") or os.getenv("LOCAL_USER_EMAIL")
    if not email:
        return CurrentMember(email="unknown", id=None, name=None, team_id=None, role=None)

    member = (
        db.query(TeamMember)
        .options(
            joinedload(TeamMember.role),
            joinedload(TeamMember.head_assignments).joinedload(HeadTeamAssignment.team),
        )
        .filter(TeamMember.email == email)
        .first()
    )

    if not member:
        return CurrentMember(email=email, id=None, name=None, team_id=None, role=None)

    head_assignments = getattr(member, 'head_assignments', [])

    return CurrentMember(
        email=email,
        id=member.id,
        name=member.name,
        team_id=member.team_id,
        role=member.role.name if member.role else None,
        head_team_ids=[a.team_id for a in head_assignments],
        head_team_names=[a.team.name for a in head_assignments if a.team],
        has_admin_access=bool(member.has_admin_access),
    )


def require_admin(current: CurrentMember = Depends(get_current_member)) -> CurrentMember:
    if not current.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current
