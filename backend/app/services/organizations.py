"""Organization membership, invites, and tenant checks."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.core.errors import bad_request, forbidden, not_found
from app.core.timeutil import utcnow
from app.models import (
    InvitationStatus,
    MemberRole,
    Organization,
    OrganizationInvitation,
    OrganizationMember,
    User,
)
from app.services import tokens as token_svc
from app.services.audit import record_audit
from app.services.email import send_email
from app.services.slugs import slugify
from app.services.workspace import create_workspace

MANAGER_ROLES = {MemberRole.org_admin, MemberRole.agency_manager}


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
        raise not_found("Organization not found")
    return membership


def require_org_manager(db: Session, *, user: User, organization_id: UUID) -> OrganizationMember:
    membership = require_membership(db, user_id=user.id, organization_id=organization_id)
    if membership.role not in MANAGER_ROLES:
        raise forbidden("Insufficient permissions")
    return membership


def create_organization(db: Session, *, user: User, name: str, slug: str | None) -> Organization:
    org = create_workspace(
        db,
        name=name,
        owner_user_id=user.id,
        owner_role=MemberRole.org_admin,
        is_personal=False,
        slug_seed=slugify(slug or name),
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
        )
        .unique()
        .all()
    )


def member_to_dict(m: OrganizationMember) -> dict:
    return {
        "user_id": m.user_id,
        "email": m.user.email,
        "full_name": m.user.profile.full_name if m.user.profile else "",
        "role": m.role,
        "created_at": m.created_at,
    }


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
        raise bad_request("Cannot invite platform_admin via organization invite")

    org = db.get(Organization, organization_id)
    if not org or not org.is_active:
        raise not_found("Organization not found")

    raw, hashed = token_svc.new_raw_token()
    invite = OrganizationInvitation(
        organization_id=organization_id,
        email=email.lower(),
        role=role,
        token_hash=hashed,
        status=InvitationStatus.pending,
        invited_by_user_id=user.id,
        expires_at=token_svc.make_expiry(days=7),
    )
    db.add(invite)

    link = f"{get_settings().frontend_url}/accept-invite?token={raw}&org={organization_id}"
    send_email(
        to=email.lower(),
        subject=f"Invitation to join {org.name} on HireMatch AI",
        body=f"You have been invited to join {org.name} as {role.value}.\n\nAccept: {link}\n",
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
    invite = token_svc.find_by_hash(db, OrganizationInvitation, token)
    if (
        not invite
        or invite.organization_id != organization_id
        or invite.status != InvitationStatus.pending
        or invite.expires_at < utcnow()
    ):
        raise bad_request("Invalid or expired invitation")

    if invite.email.lower() != user.email.lower():
        raise forbidden("Invitation email does not match your account")

    existing = get_membership(db, user_id=user.id, organization_id=organization_id)
    invite.status = InvitationStatus.accepted
    invite.accepted_at = utcnow()

    if existing:
        db.commit()
        return existing

    membership = OrganizationMember(
        organization_id=organization_id,
        user_id=user.id,
        role=invite.role,
    )
    db.add(membership)
    record_audit(
        db,
        action="organization.invitation_accepted",
        actor_user_id=user.id,
        organization_id=organization_id,
    )
    db.commit()
    db.refresh(membership)
    return membership
