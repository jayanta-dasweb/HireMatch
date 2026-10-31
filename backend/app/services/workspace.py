"""Shared org/workspace helpers used by auth + organizations (DRY)."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    MemberRole,
    Organization,
    OrganizationMember,
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
)
from app.services.slugs import unique_org_slug


def create_workspace(
    db: Session,
    *,
    name: str,
    owner_user_id: UUID,
    owner_role: MemberRole,
    is_personal: bool,
    slug_seed: str,
) -> Organization:
    """Create an organization, add the owner, and attach the free plan if present."""
    from app.services.rbac import get_system_role, legacy_member_role

    org = Organization(
        name=name,
        slug=unique_org_slug(db, slug_seed),
        is_personal=is_personal,
    )
    db.add(org)
    db.flush()

    rbac_role = get_system_role(db, owner_role.value)
    db.add(
        OrganizationMember(
            organization_id=org.id,
            user_id=owner_user_id,
            role=legacy_member_role(rbac_role),
            role_id=rbac_role.id,
        )
    )
    attach_free_plan(db, organization_id=org.id)
    return org


def attach_free_plan(db: Session, *, organization_id: UUID) -> None:
    plan = db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == "free"))
    if not plan:
        return
    db.add(
        Subscription(
            organization_id=organization_id,
            plan_id=plan.id,
            status=SubscriptionStatus.trial,
        )
    )
