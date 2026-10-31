from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.core.security import generate_raw_token, hash_token
from app.models import (
    InvitationStatus,
    MemberRole,
    Organization,
    OrganizationInvitation,
    OrganizationMember,
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
    User,
)
from app.services.audit import record_audit
from app.services.email import send_email
from app.services.slugs import slugify, unique_org_slug


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_membership(db: Session, *, user_id: UUID, organization_id: UUID) -> OrganizationMember | None:
    return db.scalar(
        select(OrganizationMember).where(
            OrganizationMember.user_id == user_id,
            OrganizationMember.organization_id == organization_id,
        )
    )


def require_membership(db: Session, *, user_id: UUID, organization_id: UUID) -> OrganizationMember:
    membership = get_membership(db, user_id=user_id, organization_id=organization_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return membership


def require_org_manager(db: Session, *, user: User, organization_id: UUID) -> OrganizationMember:
    membership = require_membership(db, user_id=user.id, organization_id=organization_id)
    if membership.role not in {MemberRole.org_admin, MemberRole.agency_manager}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return membership


def create_organization(db: Session, *, user: User, name: str, slug: str | None) -> Organization:
    desired = slugify(slug or name)
    final_slug = unique_org_slug(db, desired)
    org = Organization(name=name, slug=final_slug, is_personal=False)
    db.add(org)
    db.flush()
    db.add(
        OrganizationMember(
            organization_id=org.id,
            user_id=user.id,
            role=MemberRole.org_admin,
        )
    )
    free_plan = db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == "free"))
    if free_plan:
        db.add(
            Subscription(
                organization_id=org.id,
                plan_id=free_plan.id,
                status=SubscriptionStatus.trial,
            )
        )
    record_audit(
        db,
        action="organization.created",
        actor_user_id=user.id,
        organization_id=org.id,
        resource_type="organization",
        resource_id=str(org.id),
    )
    db.commit()
    db.refresh(org)
    return org


def list_user_organizations(db: Session, *, user_id: UUID) -> list[Organization]:
    return list(
        db.scalars(
            select(Organization)
            .join(OrganizationMember)
            .where(OrganizationMember.user_id == user_id)
            .order_by(Organization.created_at.asc())
        ).all()
    )


def list_members(db: Session, *, organization_id: UUID) -> list[OrganizationMember]:
    return list(
        db.scalars(
            select(OrganizationMember)
            .options(joinedload(OrganizationMember.user).joinedload(User.profile))
            .where(OrganizationMember.organization_id == organization_id)
        ).unique().all()
    )


def create_invitation(
    db: Session,
    *,
    user: User,
    organization_id: UUID,
    email: str,
    role: MemberRole,
) -> tuple[OrganizationInvitation, str]:
    require_org_manager(db, user=user, organization_id=organization_id)
    if role == MemberRole.platform_admin:
        raise HTTPException(status_code=400, detail="Cannot invite platform_admin via organization invite")

    org = db.get(Organization, organization_id)
    if not org or not org.is_active:
        raise HTTPException(status_code=404, detail="Organization not found")

    raw = generate_raw_token()
    invite = OrganizationInvitation(
        organization_id=organization_id,
        email=email.lower(),
        role=role,
        token_hash=hash_token(raw),
        status=InvitationStatus.pending,
        invited_by_user_id=user.id,
        expires_at=_utcnow() + timedelta(days=7),
    )
    db.add(invite)
    settings = get_settings()
    link = f"{settings.frontend_url}/accept-invite?token={raw}&org={organization_id}"
    send_email(
        to=email.lower(),
        subject=f"Invitation to join {org.name} on HireMatch AI",
        body=f"You have been invited to join {org.name} as {role.value}.\n\nAccept: {link}",
    )
    record_audit(
        db,
        action="organization.invitation_created",
        actor_user_id=user.id,
        organization_id=organization_id,
        metadata={"email": email.lower(), "role": role.value},
    )
    db.commit()
    db.refresh(invite)
    return invite, raw


def accept_invitation(db: Session, *, user: User, organization_id: UUID, token: str) -> OrganizationMember:
    invite = db.scalar(
        select(OrganizationInvitation).where(
            OrganizationInvitation.organization_id == organization_id,
            OrganizationInvitation.token_hash == hash_token(token),
        )
    )
    if (
        not invite
        or invite.status != InvitationStatus.pending
        or invite.expires_at < _utcnow()
    ):
        raise HTTPException(status_code=400, detail="Invalid or expired invitation")

    if invite.email.lower() != user.email.lower():
        raise HTTPException(status_code=403, detail="Invitation email does not match your account")

    existing = get_membership(db, user_id=user.id, organization_id=organization_id)
    if existing:
        invite.status = InvitationStatus.accepted
        invite.accepted_at = _utcnow()
        db.commit()
        return existing

    membership = OrganizationMember(
        organization_id=organization_id,
        user_id=user.id,
        role=invite.role,
    )
    db.add(membership)
    invite.status = InvitationStatus.accepted
    invite.accepted_at = _utcnow()
    record_audit(
        db,
        action="organization.invitation_accepted",
        actor_user_id=user.id,
        organization_id=organization_id,
    )
    db.commit()
    db.refresh(membership)
    return membership
