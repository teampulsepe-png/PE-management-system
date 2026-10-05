from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.db.models import TeamMember
from backend.schemas import TeamMemberOut

router = APIRouter(prefix="/api/v1", tags=["members"])


@router.get("/members", response_model=list[TeamMemberOut])
def get_all_members(db: Session = Depends(get_db)):
    return (
        db.query(TeamMember)
        .filter(TeamMember.team_id.isnot(None))
        .order_by(TeamMember.name)
        .all()
    )


@router.get("/teams/{team_id}/members", response_model=list[TeamMemberOut])
def get_team_members(team_id: str, db: Session = Depends(get_db)):
    return (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id)
        .order_by(TeamMember.name)
        .all()
    )
