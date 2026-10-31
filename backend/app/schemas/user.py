from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class MembershipOut(BaseModel):
    organization_id: UUID
    organization_name: str
    organization_slug: str
    role: str
    role_id: UUID | None = None
    is_personal: bool
    permissions: list[str] = []

    model_config = {"from_attributes": True}


class UserMeResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    headline: str | None
    locale: str
    is_email_verified: bool
    is_platform_admin: bool
    memberships: list[MembershipOut]
    created_at: datetime


class UserProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    headline: str | None = Field(default=None, max_length=300)
    locale: str | None = Field(default=None, max_length=16)
