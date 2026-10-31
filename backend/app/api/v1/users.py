from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.user import MembershipOut, UserMeResponse, UserProfileUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserMeResponse)
def read_me(user: User = Depends(get_current_user)):
    memberships = [
        MembershipOut(
            organization_id=m.organization_id,
            organization_name=m.organization.name,
            organization_slug=m.organization.slug,
            role=m.role,
            is_personal=m.organization.is_personal,
        )
        for m in user.memberships
    ]
    return UserMeResponse(
        id=user.id,
        email=user.email,
        full_name=user.profile.full_name if user.profile else "",
        headline=user.profile.headline if user.profile else None,
        locale=user.profile.locale if user.profile else "en-IN",
        is_email_verified=user.is_email_verified,
        is_platform_admin=user.is_platform_admin,
        memberships=memberships,
        created_at=user.created_at,
    )


@router.patch("/me", response_model=UserMeResponse)
def update_me(
    payload: UserProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.profile is None:
        from app.models import UserProfile

        user.profile = UserProfile(user_id=user.id, full_name=payload.full_name or "User")
        db.add(user.profile)

    if payload.full_name is not None:
        user.profile.full_name = payload.full_name
    if payload.headline is not None:
        user.profile.headline = payload.headline
    if payload.locale is not None:
        user.profile.locale = payload.locale
    db.commit()
    db.refresh(user)
    return read_me(user)
