from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import Organization, User
from app.schemas.organization import (
    AcceptInvitationRequest,
    InvitationCreate,
    InvitationOut,
    MemberOut,
    OrganizationCreate,
    OrganizationOut,
)
from app.services import organizations as orgs

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.post("", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
def create_organization(
    payload: OrganizationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return orgs.create_organization(db, user=user, name=payload.name, slug=payload.slug)


@router.get("", response_model=list[OrganizationOut])
def list_organizations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return orgs.list_user_organizations(db, user_id=user.id)


@router.get("/{org_id}", response_model=OrganizationOut)
def get_organization(
    org_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    orgs.require_membership(db, user_id=user.id, organization_id=org_id)
    return db.get(Organization, org_id)


@router.get("/{org_id}/members", response_model=list[MemberOut])
def list_members(
    org_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    orgs.require_membership(db, user_id=user.id, organization_id=org_id)
    return [MemberOut(**orgs.member_to_dict(m)) for m in orgs.list_members(db, organization_id=org_id)]


@router.post("/{org_id}/invitations", response_model=InvitationOut, status_code=status.HTTP_201_CREATED)
def invite_member(
    org_id: UUID,
    payload: InvitationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    invite, raw = orgs.create_invitation(
        db,
        user=user,
        organization_id=org_id,
        email=payload.email,
        role=payload.role,
    )
    settings = get_settings()
    return InvitationOut(
        id=invite.id,
        email=invite.email,
        role=invite.role,
        status=invite.status,
        expires_at=invite.expires_at,
        invite_token=raw if settings.email_backend == "console" and not settings.is_production else None,
    )


@router.post("/{org_id}/invitations/accept", response_model=MemberOut)
def accept_invitation(
    org_id: UUID,
    payload: AcceptInvitationRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = orgs.accept_invitation(db, user=user, organization_id=org_id, token=payload.token)
    match = next(m for m in orgs.list_members(db, organization_id=org_id) if m.user_id == membership.user_id)
    return MemberOut(**orgs.member_to_dict(match))
