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
from app.services import organizations as org_service

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.post("", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
def create_organization(
    payload: OrganizationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return org_service.create_organization(db, user=user, name=payload.name, slug=payload.slug)


@router.get("", response_model=list[OrganizationOut])
def list_organizations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return org_service.list_user_organizations(db, user_id=user.id)


@router.get("/{org_id}", response_model=OrganizationOut)
def get_organization(
    org_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_service.require_membership(db, user_id=user.id, organization_id=org_id)
    return db.get(Organization, org_id)


@router.get("/{org_id}/members", response_model=list[MemberOut])
def list_members(
    org_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_service.require_membership(db, user_id=user.id, organization_id=org_id)
    members = org_service.list_members(db, organization_id=org_id)
    return [
        MemberOut(
            user_id=m.user_id,
            email=m.user.email,
            full_name=m.user.profile.full_name if m.user.profile else "",
            role=m.role,
            created_at=m.created_at,
        )
        for m in members
    ]


@router.post("/{org_id}/invitations", response_model=InvitationOut, status_code=status.HTTP_201_CREATED)
def invite_member(
    org_id: UUID,
    payload: InvitationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    invite, raw = org_service.create_invitation(
        db,
        user=user,
        organization_id=org_id,
        email=payload.email,
        role=payload.role,
    )
    out = InvitationOut(
        id=invite.id,
        email=invite.email,
        role=invite.role,
        status=invite.status,
        expires_at=invite.expires_at,
        invite_token=raw if get_settings().email_backend == "console" else None,
    )
    return out


@router.post("/{org_id}/invitations/accept", response_model=MemberOut)
def accept_invitation(
    org_id: UUID,
    payload: AcceptInvitationRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = org_service.accept_invitation(
        db, user=user, organization_id=org_id, token=payload.token
    )
    # Reload with relations
    members = org_service.list_members(db, organization_id=org_id)
    match = next(m for m in members if m.user_id == membership.user_id)
    return MemberOut(
        user_id=match.user_id,
        email=match.user.email,
        full_name=match.user.profile.full_name if match.user.profile else "",
        role=match.role,
        created_at=match.created_at,
    )
