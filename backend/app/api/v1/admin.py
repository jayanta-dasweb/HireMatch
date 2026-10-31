from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_platform_admin
from app.db.session import get_db
from app.models import User
from app.schemas.admin import (
    AdminPasswordReset,
    AdminUserCreate,
    AdminUserDetailOut,
    AdminUserOut,
    AdminUserUpdate,
    AuditLogOut,
    OrgActiveUpdate,
    UserActiveUpdate,
)
from app.schemas.organization import OrganizationOut
from app.services import admin as admin_svc

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/system-health")
def admin_system_health(
    _: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    return admin_svc.system_health(db)


@router.get("/organizations", response_model=list[OrganizationOut])
def admin_list_organizations(
    _: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    return admin_svc.list_organizations(db)


@router.patch("/organizations/{org_id}/active", response_model=OrganizationOut)
def admin_set_org_active(
    org_id: UUID,
    payload: OrgActiveUpdate,
    admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    return admin_svc.set_organization_active(
        db, actor_id=admin.id, org_id=org_id, is_active=payload.is_active
    )


@router.get("/users", response_model=list[AdminUserOut])
def admin_list_users(
    _: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    return admin_svc.list_users(db)


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
def admin_create_user(
    payload: AdminUserCreate,
    admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    return admin_svc.create_user(
        db,
        actor_id=admin.id,
        email=str(payload.email),
        full_name=payload.full_name,
        password=payload.password,
        is_platform_admin=payload.is_platform_admin,
        is_email_verified=payload.is_email_verified,
        is_active=payload.is_active,
    )


@router.get("/users/{user_id}", response_model=AdminUserDetailOut)
def admin_get_user(
    user_id: UUID,
    _: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    return admin_svc.get_user_detail(db, user_id)


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def admin_update_user(
    user_id: UUID,
    payload: AdminUserUpdate,
    admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    return admin_svc.update_user(
        db,
        actor_id=admin.id,
        user_id=user_id,
        full_name=payload.full_name,
        is_active=payload.is_active,
        is_email_verified=payload.is_email_verified,
        is_platform_admin=payload.is_platform_admin,
    )


@router.patch("/users/{user_id}/active", response_model=AdminUserOut)
def admin_set_user_active(
    user_id: UUID,
    payload: UserActiveUpdate,
    admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    return admin_svc.set_user_active(
        db, actor_id=admin.id, user_id=user_id, is_active=payload.is_active
    )


@router.post("/users/{user_id}/reset-password", response_model=AdminUserOut)
def admin_reset_password(
    user_id: UUID,
    payload: AdminPasswordReset,
    admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    return admin_svc.reset_user_password(
        db, actor_id=admin.id, user_id=user_id, new_password=payload.new_password
    )


@router.get("/audit-logs", response_model=list[AuditLogOut])
def admin_audit_logs(
    limit: int = Query(default=100, ge=1, le=200),
    _: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    return admin_svc.list_audit_logs(db, limit=limit)
