from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import InvitationStatus, MemberRole


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    slug: str | None = Field(default=None, min_length=2, max_length=100)


class OrganizationOut(BaseModel):
    id: UUID
    name: str
    slug: str
    is_personal: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberOut(BaseModel):
    user_id: UUID
    email: EmailStr
    full_name: str
    role: MemberRole
    created_at: datetime


class InvitationCreate(BaseModel):
    email: EmailStr
    role: MemberRole = MemberRole.recruiter


class InvitationOut(BaseModel):
    id: UUID
    email: EmailStr
    role: MemberRole
    status: InvitationStatus
    expires_at: datetime
    # Dev-only raw token when email console backend is used
    invite_token: str | None = None


class AcceptInvitationRequest(BaseModel):
    token: str
