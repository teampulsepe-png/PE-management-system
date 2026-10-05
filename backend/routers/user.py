from fastapi import APIRouter, Depends

from backend.db.session import get_db
from backend.dependencies import get_current_member, CurrentMember
from backend.schemas import UserOut

router = APIRouter(prefix="/api/v1", tags=["user"])


@router.get("/user", response_model=UserOut)
def get_current_user(current: CurrentMember = Depends(get_current_member)):
    return UserOut(
        email=current.email,
        name=current.name,
        team_id=current.team_id,
        member_id=current.id,
        role=current.role,
        head_team_ids=current.head_team_ids,
        head_team_names=current.head_team_names,
        has_admin_access=current.has_admin_access,
    )
