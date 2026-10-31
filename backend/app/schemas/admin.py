from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class AdminUserOut(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    is_active: bool
    is_email_verified: bool
    is_platform_admin: bool
    membership_count: int


class AdminMembershipOut(BaseModel):
    organization_id: UUID
    organization_name: str
    organization_slug: str
    role: str
    is_personal: bool
    is_active: bool


class AdminUserDetailOut(AdminUserOut):
    memberships: list[AdminMembershipOut]


class AdminUserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8, max_length=128)
    is_platform_admin: bool = False
    is_email_verified: bool = True
    is_active: bool = True


class AdminUserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    is_active: bool | None = None
    is_email_verified: bool | None = None
    is_platform_admin: bool | None = None


class AdminPasswordReset(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


class UserActiveUpdate(BaseModel):
    is_active: bool


class OrgActiveUpdate(BaseModel):
    is_active: bool


class AuditLogOut(BaseModel):
    id: UUID
    action: str
    actor_user_id: UUID | None
    organization_id: UUID | None
    resource_type: str | None
    resource_id: str | None
    created_at: datetime
