from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import InvitationStatus, MemberRole


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    slug: str | None = Field(default=None, min_length=2, max_length=100)
    legal_name: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    industry: str | None = Field(default=None, max_length=120)
    company_size: str | None = Field(default=None, max_length=40)
    website: str | None = Field(default=None, max_length=300)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(default=None, max_length=40)
    country: str | None = Field(default=None, max_length=100)
    city: str | None = Field(default=None, max_length=120)
    address_line: str | None = Field(default=None, max_length=300)


class OrganizationOut(BaseModel):
    id: UUID
    name: str
    slug: str
    is_personal: bool
    is_active: bool
    legal_name: str | None = None
    description: str | None = None
    industry: str | None = None
    company_size: str | None = None
    website: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    country: str | None = None
    city: str | None = None
    address_line: str | None = None
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
