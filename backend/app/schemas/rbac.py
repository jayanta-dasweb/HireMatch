from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class ActorOut(BaseModel):
    id: UUID | None = None
    email: str | None = None
    full_name: str | None = None


class PageMeta(BaseModel):
    total: int
    page: int
    page_size: int
    pages: int


class PermissionGroupOut(BaseModel):
    id: UUID
    slug: str
    name: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: ActorOut | None = None
    updated_by: ActorOut | None = None


class PermissionGroupCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    is_active: bool = True


class PermissionGroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    is_active: bool | None = None


class PermissionGroupPage(BaseModel):
    items: list[PermissionGroupOut]
    meta: PageMeta


class PermissionOut(BaseModel):
    id: UUID
    code: str
    name: str
    group: str
    group_id: UUID | None = None
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: ActorOut | None = None
    updated_by: ActorOut | None = None

    model_config = {"from_attributes": True}


class PermissionCreate(BaseModel):
    code: str = Field(min_length=3, max_length=120)
    name: str = Field(min_length=1, max_length=200)
    group: str = Field(default="general", max_length=80)
    group_id: UUID | None = None
    description: str | None = None
    is_active: bool = True


class PermissionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    group: str | None = Field(default=None, max_length=80)
    group_id: UUID | None = None
    description: str | None = None
    is_active: bool | None = None


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
    updated_at: datetime
    created_by: ActorOut | None = None
    updated_by: ActorOut | None = None


class RoleCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    organization_id: UUID | None = None
    is_system: bool = False
    is_active: bool = True
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


class PermissionPage(BaseModel):
    items: list[PermissionOut]
    meta: PageMeta


class RolePage(BaseModel):
    items: list[RoleOut]
    meta: PageMeta


class RbacAuditOut(BaseModel):
    id: UUID
    action: str
    resource_type: str | None
    resource_id: str | None
    actor: ActorOut | None = None
    created_at: datetime
    metadata: dict | None = None


class RbacAuditPage(BaseModel):
    items: list[RbacAuditOut]
    meta: PageMeta
