from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class PermissionOut(BaseModel):
    id: UUID
    code: str
    name: str
    group: str
    description: str | None

    model_config = {"from_attributes": True}


class PermissionCreate(BaseModel):
    code: str = Field(min_length=3, max_length=120)
    name: str = Field(min_length=1, max_length=200)
    group: str = Field(default="general", max_length=80)
    description: str | None = None


class PermissionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    group: str | None = Field(default=None, max_length=80)
    description: str | None = None


class RoleOut(BaseModel):
    id: UUID
    slug: str
    name: str
    description: str | None
    organization_id: UUID | None
    is_system: bool
    is_active: bool
    permissions: list[str]
    created_at: datetime


class RoleCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    organization_id: UUID | None = None
    is_system: bool = False
    permission_codes: list[str] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    is_active: bool | None = None
    permission_codes: list[str] | None = None


class MemberRoleAssign(BaseModel):
    role_id: UUID | None = None
    role_slug: str | None = None


class InviteByRole(BaseModel):
    email: EmailStr
    role_id: UUID | None = None
    role_slug: str = "recruiter"
