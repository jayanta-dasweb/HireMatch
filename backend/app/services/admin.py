"""Platform admin ops — users, orgs, passwords, audit (master console)."""

from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, joinedload

from app.core.errors import bad_request, conflict, not_found
from app.core.security import hash_password
from app.models import (
    AuditEvent,
    MemberRole,
    Organization,
    RefreshToken,
    User,
    UserProfile,
)
from app.schemas.admin import (
    AdminMembershipOut,
    AdminUserDetailOut,
    AdminUserOut,
    AuditLogOut,
)
from app.services.audit import record_audit
from app.services import tokens as token_svc
from app.services.workspace import create_workspace


def _user_out(user: User) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        email=user.email,
        full_name=user.profile.full_name if user.profile else "",
        is_active=user.is_active,
        is_email_verified=user.is_email_verified,
        is_platform_admin=user.is_platform_admin,
        membership_count=len(user.memberships or []),
    )


def _load_user_simple(db: Session, user_id: UUID) -> User:
    user = db.scalar(
        select(User).options(joinedload(User.profile), joinedload(User.memberships)).where(User.id == user_id)
    )
    if not user:
        raise not_found("User not found")
    return user


def system_health(db: Session) -> dict:
    db.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "database": "up",
        "organization_count": db.scalar(select(func.count()).select_from(Organization)) or 0,
        "user_count": db.scalar(select(func.count()).select_from(User)) or 0,
        "active_user_count": db.scalar(select(func.count()).select_from(User).where(User.is_active.is_(True))) or 0,
        "background_workers": "not_configured_until_phase_2",
    }


def list_organizations(db: Session) -> list[Organization]:
    return list(db.scalars(select(Organization).order_by(Organization.created_at.desc()).limit(200)).all())


def list_users(db: Session) -> list[AdminUserOut]:
    users = (
        db.scalars(
            select(User)
            .options(joinedload(User.profile), joinedload(User.memberships))
            .order_by(User.created_at.desc())
        )
        .unique()
        .all()
    )
    return [_user_out(u) for u in users]


def get_user_detail(db: Session, user_id: UUID) -> AdminUserDetailOut:
    from app.models import OrganizationMember

    user = db.scalar(
        select(User)
        .options(
            joinedload(User.profile),
            joinedload(User.memberships).joinedload(OrganizationMember.organization),
        )
        .where(User.id == user_id)
    )
    if not user:
        raise not_found("User not found")

    memberships = [
        AdminMembershipOut(
            organization_id=m.organization_id,
            organization_name=m.organization.name if m.organization else "",
            organization_slug=m.organization.slug if m.organization else "",
            role=m.role.value if hasattr(m.role, "value") else str(m.role),
            is_personal=m.organization.is_personal if m.organization else False,
            is_active=m.organization.is_active if m.organization else False,
        )
        for m in user.memberships
    ]
    base = _user_out(user)
    return AdminUserDetailOut(**base.model_dump(), memberships=memberships)


def create_user(
    db: Session,
    *,
    actor_id: UUID,
    email: str,
    full_name: str,
    password: str,
    is_platform_admin: bool = False,
    is_email_verified: bool = True,
    is_active: bool = True,
) -> AdminUserOut:
    email = email.lower().strip()
    if db.scalar(select(User).where(User.email == email)):
        raise conflict("Email already registered")

    user = User(
        email=email,
        hashed_password=hash_password(password),
        is_active=is_active,
        is_email_verified=is_email_verified,
        is_platform_admin=is_platform_admin,
    )
    db.add(user)
    db.flush()
    db.add(UserProfile(user_id=user.id, full_name=full_name.strip()))

    create_workspace(
        db,
        name=f"{full_name.strip()}'s workspace",
        owner_user_id=user.id,
        owner_role=MemberRole.org_admin if is_platform_admin else MemberRole.candidate,
        is_personal=True,
        slug_seed=full_name,
    )

    record_audit(
        db,
        action="admin.user_created",
        actor_user_id=actor_id,
        resource_type="user",
        resource_id=str(user.id),
        metadata={
            "email": email,
            "is_platform_admin": is_platform_admin,
            "is_email_verified": is_email_verified,
        },
    )
    db.commit()
    return _user_out(_load_user_simple(db, user.id))


def update_user(
    db: Session,
    *,
    actor_id: UUID,
    user_id: UUID,
    full_name: str | None = None,
    is_active: bool | None = None,
    is_email_verified: bool | None = None,
    is_platform_admin: bool | None = None,
) -> AdminUserOut:
    user = _load_user_simple(db, user_id)
    changes: dict = {}

    if full_name is not None:
        if not user.profile:
            db.add(UserProfile(user_id=user.id, full_name=full_name.strip()))
        else:
            user.profile.full_name = full_name.strip()
        changes["full_name"] = full_name.strip()

    if is_active is not None and is_active != user.is_active:
        if user.id == actor_id and not is_active:
            raise bad_request("You cannot deactivate your own admin account")
        user.is_active = is_active
        changes["is_active"] = is_active

    if is_email_verified is not None and is_email_verified != user.is_email_verified:
        user.is_email_verified = is_email_verified
        changes["is_email_verified"] = is_email_verified

    if is_platform_admin is not None and is_platform_admin != user.is_platform_admin:
        if user.id == actor_id and not is_platform_admin:
            raise bad_request("You cannot remove your own platform admin access")
        user.is_platform_admin = is_platform_admin
        changes["is_platform_admin"] = is_platform_admin

    if not changes:
        return _user_out(user)

    record_audit(
        db,
        action="admin.user_updated",
        actor_user_id=actor_id,
        resource_type="user",
        resource_id=str(user.id),
        metadata=changes,
    )
    db.commit()
    return _user_out(_load_user_simple(db, user.id))


def set_user_active(db: Session, *, actor_id: UUID, user_id: UUID, is_active: bool) -> AdminUserOut:
    return update_user(db, actor_id=actor_id, user_id=user_id, is_active=is_active)


def reset_user_password(
    db: Session,
    *,
    actor_id: UUID,
    user_id: UUID,
    new_password: str,
) -> AdminUserOut:
    user = _load_user_simple(db, user_id)
    user.hashed_password = hash_password(new_password)
    token_svc.revoke_all_refresh(db, RefreshToken, user_id=user.id)
    record_audit(
        db,
        action="admin.user_password_reset",
        actor_user_id=actor_id,
        resource_type="user",
        resource_id=str(user.id),
    )
    db.commit()
    return _user_out(user)


def set_organization_active(
    db: Session,
    *,
    actor_id: UUID,
    org_id: UUID,
    is_active: bool,
) -> Organization:
    org = db.get(Organization, org_id)
    if not org:
        raise not_found("Organization not found")
    org.is_active = is_active
    record_audit(
        db,
        action="admin.org_active_updated",
        actor_user_id=actor_id,
        organization_id=org.id,
        resource_type="organization",
        resource_id=str(org.id),
        metadata={"is_active": is_active},
    )
    db.commit()
    db.refresh(org)
    return org


def list_audit_logs(db: Session, *, limit: int = 100) -> list[AuditLogOut]:
    limit = max(1, min(limit, 200))
    rows = db.scalars(select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(limit)).all()
    return [
        AuditLogOut(
            id=r.id,
            action=r.action,
            actor_user_id=r.actor_user_id,
            organization_id=r.organization_id,
            resource_type=r.resource_type,
            resource_id=r.resource_id,
            created_at=r.created_at,
        )
        for r in rows
    ]
