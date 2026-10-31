from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import User, UserProfile
from app.schemas.user import MembershipOut, UserMeResponse, UserProfileUpdate

router = APIRouter(prefix="/users", tags=["users"])


def _to_me(user: User) -> UserMeResponse:
    profile = user.profile
    return UserMeResponse(
        id=user.id,
        email=user.email,
        full_name=profile.full_name if profile else "",
        headline=profile.headline if profile else None,
        locale=profile.locale if profile else "en-IN",
        is_email_verified=user.is_email_verified,
        is_platform_admin=user.is_platform_admin,
        memberships=[
            MembershipOut(
                organization_id=m.organization_id,
                organization_name=m.organization.name,
                organization_slug=m.organization.slug,
                role=m.role,
                is_personal=m.organization.is_personal,
            )
            for m in user.memberships
        ],
        created_at=user.created_at,
    )


@router.get("/me", response_model=UserMeResponse)
def read_me(user: User = Depends(get_current_user)):
    return _to_me(user)


@router.patch("/me", response_model=UserMeResponse)
def update_me(
    payload: UserProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.profile is None:
        user.profile = UserProfile(user_id=user.id, full_name=payload.full_name or "User")
        db.add(user.profile)

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(user.profile, key, value)

    db.commit()
    db.refresh(user)
    return _to_me(user)
