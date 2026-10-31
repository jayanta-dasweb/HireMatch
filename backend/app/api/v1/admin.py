from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, joinedload

from app.core.deps import require_platform_admin
from app.db.session import get_db
from app.models import Organization, User
from app.schemas.organization import OrganizationOut
from app.services.audit import record_audit

router = APIRouter(prefix="/admin", tags=["admin"])


class AdminUserOut(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    is_active: bool
    is_email_verified: bool
    is_platform_admin: bool
    membership_count: int


class UserActiveUpdate(BaseModel):
    is_active: bool


@router.get("/system-health")
def admin_system_health(
    _: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    db.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "database": "up",
        "organization_count": db.scalar(select(func.count()).select_from(Organization)) or 0,
        "user_count": db.scalar(select(func.count()).select_from(User)) or 0,
        "active_user_count": db.scalar(select(func.count()).select_from(User).where(User.is_active.is_(True))) or 0,
        "background_workers": "not_configured_until_phase_2",
    }


@router.get("/organizations", response_model=list[OrganizationOut])
def admin_list_organizations(
    _: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    return list(db.scalars(select(Organization).order_by(Organization.created_at.desc()).limit(200)).all())


@router.get("/users", response_model=list[AdminUserOut])
def admin_list_users(
    _: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    users = db.scalars(
        select(User).options(joinedload(User.profile), joinedload(User.memberships)).order_by(User.created_at.desc())
    ).unique().all()
    return [
        AdminUserOut(
            id=u.id,
            email=u.email,
            full_name=u.profile.full_name if u.profile else "",
            is_active=u.is_active,
            is_email_verified=u.is_email_verified,
            is_platform_admin=u.is_platform_admin,
            membership_count=len(u.memberships),
        )
        for u in users
    ]


@router.patch("/users/{user_id}/active", response_model=AdminUserOut)
def admin_set_user_active(
    user_id: UUID,
    payload: UserActiveUpdate,
    admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    user = db.scalar(
        select(User).options(joinedload(User.profile), joinedload(User.memberships)).where(User.id == user_id)
    )
    if not user:
        from app.core.errors import not_found

        raise not_found("User not found")
    if user.id == admin.id and not payload.is_active:
        from app.core.errors import bad_request

        raise bad_request("You cannot deactivate your own admin account")

    user.is_active = payload.is_active
    record_audit(
        db,
        action="admin.user_active_updated",
        actor_user_id=admin.id,
        resource_type="user",
        resource_id=str(user.id),
        metadata={"is_active": payload.is_active},
    )
    db.commit()
    db.refresh(user)
    return AdminUserOut(
        id=user.id,
        email=user.email,
        full_name=user.profile.full_name if user.profile else "",
        is_active=user.is_active,
        is_email_verified=user.is_email_verified,
        is_platform_admin=user.is_platform_admin,
        membership_count=len(user.memberships),
    )
