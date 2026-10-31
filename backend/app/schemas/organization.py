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
    role: str
    role_id: UUID | None = None
    created_at: datetime


class InvitationCreate(BaseModel):
    email: EmailStr
    role: MemberRole | None = None
    role_id: UUID | None = None
    role_slug: str | None = "recruiter"


class InvitationOut(BaseModel):
    id: UUID
    email: EmailStr
    role: str
    role_id: UUID | None = None
    status: InvitationStatus
    expires_at: datetime
    invite_token: str | None = None


class AcceptInvitationRequest(BaseModel):
    token: str
