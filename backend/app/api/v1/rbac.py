from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_platform_admin
from app.db.session import get_db
from app.models import User
from app.schemas.organization import MemberOut
from app.schemas.rbac import (
    MemberRoleAssign,
    PermissionCreate,
    PermissionOut,
    PermissionPage,
    PermissionUpdate,
    RbacAuditPage,
    RoleCreate,
    RoleOut,
    RolePage,
    RoleUpdate,
)
from app.services import organizations as orgs
from app.services import rbac as rbac_svc

router = APIRouter(prefix="/rbac", tags=["rbac"])


@router.get("/permissions", response_model=PermissionPage)
def list_permissions(
    q: str | None = Query(default=None),
    group: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows, meta = rbac_svc.list_permissions(
        db, q=q, group=group, is_active=is_active, page=page, page_size=page_size
    )
    return PermissionPage(items=[PermissionOut(**rbac_svc.permission_to_dict(db, r)) for r in rows], meta=meta)


@router.get("/permission-groups", response_model=list[str])
def permission_groups(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return rbac_svc.list_permission_groups(db)


@router.post("/permissions", response_model=PermissionOut, status_code=status.HTTP_201_CREATED)
def create_permission(
    payload: PermissionCreate,
    admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    row = rbac_svc.create_permission(
        db,
        actor_id=admin.id,
        code=payload.code,
        name=payload.name,
        group=payload.group,
        description=payload.description,
        is_active=payload.is_active,
    )
    return PermissionOut(**rbac_svc.permission_to_dict(db, row))


@router.patch("/permissions/{permission_id}", response_model=PermissionOut)
def update_permission(
    permission_id: UUID,
    payload: PermissionUpdate,
    admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    row = rbac_svc.update_permission(
        db,
        actor_id=admin.id,
        permission_id=permission_id,
        name=payload.name,
        group=payload.group,
        description=payload.description,
        is_active=payload.is_active,
    )
    return PermissionOut(**rbac_svc.permission_to_dict(db, row))


@router.get("/roles", response_model=RolePage)
def list_roles(
    organization_id: UUID | None = Query(default=None),
    include_system: bool = Query(default=True),
    q: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if organization_id is None:
        rows, meta = rbac_svc.list_roles(
            db,
            organization_id=None,
            include_system=True,
            q=q,
            is_active=is_active if user.is_platform_admin else True,
            page=page,
            page_size=page_size,
        )
        if not user.is_platform_admin:
            rows = [r for r in rows if r.is_system and r.is_active]
            meta = {
                "total": len(rows),
                "page": 1,
                "page_size": page_size,
                "pages": 1,
            }
        return RolePage(items=[RoleOut(**rbac_svc.role_to_dict(db, r)) for r in rows], meta=meta)

    rbac_svc.require_permission(db, user=user, organization_id=organization_id, code="org.view")
    rows, meta = rbac_svc.list_roles(
        db,
        organization_id=organization_id,
        include_system=include_system,
        q=q,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )
    return RolePage(items=[RoleOut(**rbac_svc.role_to_dict(db, r)) for r in rows], meta=meta)


@router.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RoleCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.is_system or payload.organization_id is None:
        if not user.is_platform_admin:
            from app.core.errors import forbidden

            raise forbidden("Platform admin required to create system roles")
        role = rbac_svc.create_role(
            db,
            actor_id=user.id,
            slug=payload.slug,
            name=payload.name,
            description=payload.description,
            organization_id=None,
            is_system=True,
            permission_codes=payload.permission_codes,
        )
    else:
        rbac_svc.require_permission(
            db, user=user, organization_id=payload.organization_id, code="org.roles.manage"
        )
        role = rbac_svc.create_role(
            db,
            actor_id=user.id,
            slug=payload.slug,
            name=payload.name,
            description=payload.description,
            organization_id=payload.organization_id,
            is_system=False,
            permission_codes=payload.permission_codes,
        )
    return RoleOut(**rbac_svc.role_to_dict(db, role))


@router.patch("/roles/{role_id}", response_model=RoleOut)
def update_role(
    role_id: UUID,
    payload: RoleUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models import Role

    existing = db.get(Role, role_id)
    if not existing:
        from app.core.errors import not_found

        raise not_found("Role not found")

    allow_system = False
    if existing.is_system or existing.organization_id is None:
        if not user.is_platform_admin:
            from app.core.errors import forbidden

            raise forbidden("Platform admin required to edit system roles")
        allow_system = True
    else:
        rbac_svc.require_permission(
            db, user=user, organization_id=existing.organization_id, code="org.roles.manage"
        )

    role = rbac_svc.update_role(
        db,
        actor_id=user.id,
        role_id=role_id,
        name=payload.name,
        description=payload.description,
        is_active=payload.is_active,
        permission_codes=payload.permission_codes,
        allow_system_edit=allow_system,
    )
    return RoleOut(**rbac_svc.role_to_dict(db, role))


@router.get("/audit", response_model=RbacAuditPage)
def rbac_audit(
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    _: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    items, meta = rbac_svc.list_rbac_audit(db, q=q, page=page, page_size=page_size)
    return RbacAuditPage(items=items, meta=meta)


@router.patch("/organizations/{org_id}/members/{user_id}/role", response_model=MemberOut)
def assign_member_role(
    org_id: UUID,
    user_id: UUID,
    payload: MemberRoleAssign,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    membership = rbac_svc.assign_member_role(
        db,
        actor=user,
        organization_id=org_id,
        user_id=user_id,
        role_id=payload.role_id,
        role_slug=payload.role_slug,
    )
    match = next(m for m in orgs.list_members(db, organization_id=org_id) if m.user_id == membership.user_id)
    return MemberOut(**orgs.member_to_dict(match))
