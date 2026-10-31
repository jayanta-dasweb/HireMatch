"""Spatie-style RBAC: permissions, roles, checks, CRUD."""

import json
import math
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.errors import bad_request, conflict, forbidden, not_found
from app.models import (
    AuditEvent,
    MemberRole,
    OrganizationMember,
    Permission,
    Role,
    RolePermission,
    User,
)
from app.services.audit import record_audit
from app.services.rbac_seed import seed_rbac_defaults


def ensure_rbac_seeded(db: Session) -> None:
    count = db.scalar(select(Permission.id).limit(1))
    if count is None:
        seed_rbac_defaults(db)


def _actor_out(db: Session, user_id: UUID | None) -> dict | None:
    if not user_id:
        return None
    user = db.scalar(select(User).options(joinedload(User.profile)).where(User.id == user_id))
    if not user:
        return {"id": user_id, "email": None, "full_name": None}
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.profile.full_name if user.profile else None,
    }


def _page_meta(total: int, page: int, page_size: int) -> dict:
    pages = max(1, math.ceil(total / page_size)) if page_size else 1
    return {"total": total, "page": page, "page_size": page_size, "pages": pages}


def get_system_role(db: Session, slug: str) -> Role:
    ensure_rbac_seeded(db)
    role = db.scalar(
        select(Role).where(Role.slug == slug, Role.organization_id.is_(None), Role.is_system.is_(True))
    )
    if not role:
        raise bad_request(f"System role '{slug}' is not configured")
    return role


def resolve_assignable_role(db: Session, *, organization_id: UUID, role_id: UUID | None = None, role_slug: str | None = None) -> Role:
    ensure_rbac_seeded(db)
    role: Role | None = None
    if role_id:
        role = db.get(Role, role_id)
    elif role_slug:
        role = db.scalar(
            select(Role).where(
                Role.slug == role_slug,
                Role.is_active.is_(True),
                or_(Role.organization_id.is_(None), Role.organization_id == organization_id),
            )
        )
    if not role or not role.is_active:
        raise bad_request("Role not found or inactive")
    if role.organization_id is not None and role.organization_id != organization_id:
        raise bad_request("Role does not belong to this organization")
    if role.slug == "platform_admin" or (role.is_system and role.slug == "platform_admin"):
        raise bad_request("Cannot assign platform_admin as an organization role")
    return role


def legacy_member_role(role: Role) -> MemberRole:
    try:
        return MemberRole(role.slug)
    except ValueError:
        return MemberRole.recruiter


def permission_codes_for_role(db: Session, role_id: UUID) -> set[str]:
    rows = db.scalars(
        select(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .where(RolePermission.role_id == role_id, Permission.is_active.is_(True))
    ).all()
    return set(rows)


def user_permissions(db: Session, *, user: User, organization_id: UUID) -> set[str]:
    if user.is_platform_admin:
        return {
            p.code for p in db.scalars(select(Permission).where(Permission.is_active.is_(True))).all()
        } or {
            "org.view",
            "org.members.view",
            "org.members.invite",
            "org.members.manage",
            "org.roles.manage",
            "org.settings.manage",
        }

    membership = db.scalar(
        select(OrganizationMember)
        .options(joinedload(OrganizationMember.rbac_role))
        .where(
            OrganizationMember.user_id == user.id,
            OrganizationMember.organization_id == organization_id,
        )
    )
    if not membership:
        return set()
    if membership.role_id:
        return permission_codes_for_role(db, membership.role_id)
    # Fallback for legacy rows without role_id
    role = get_system_role(db, membership.role.value)
    return permission_codes_for_role(db, role.id)


def require_permission(db: Session, *, user: User, organization_id: UUID, code: str) -> OrganizationMember:
    from app.models import Organization
    from app.services.organizations import get_membership

    membership = get_membership(db, user_id=user.id, organization_id=organization_id)
    if user.is_platform_admin:
        if membership:
            return membership
        org = db.get(Organization, organization_id)
        if not org:
            raise not_found("Organization not found")
        # Ephemeral membership for gate-only platform actions (not persisted).
        return OrganizationMember(
            organization_id=organization_id,
            user_id=user.id,
            role=MemberRole.org_admin,
        )
    if not membership:
        raise not_found("Organization not found")
    perms = user_permissions(db, user=user, organization_id=organization_id)
    if code not in perms:
        raise forbidden("Insufficient permissions")
    return membership


def permission_to_dict(db: Session, row: Permission) -> dict:
    return {
        "id": row.id,
        "code": row.code,
        "name": row.name,
        "group": row.group,
        "description": row.description,
        "is_active": row.is_active,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "created_by": _actor_out(db, row.created_by_user_id),
        "updated_by": _actor_out(db, row.updated_by_user_id),
    }


def list_permissions(
    db: Session,
    *,
    q: str | None = None,
    group: str | None = None,
    is_active: bool | None = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[Permission], dict]:
    ensure_rbac_seeded(db)
    page = max(1, page)
    page_size = min(100, max(1, page_size))
    stmt = select(Permission)
    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Permission.code).like(like),
                func.lower(Permission.name).like(like),
            )
        )
    if group:
        stmt = stmt.where(Permission.group == group)
    if is_active is not None:
        stmt = stmt.where(Permission.is_active.is_(is_active))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = list(
        db.scalars(
            stmt.order_by(Permission.group, Permission.code).offset((page - 1) * page_size).limit(page_size)
        ).all()
    )
    return rows, _page_meta(total, page, page_size)


def list_permission_groups(db: Session) -> list[str]:
    ensure_rbac_seeded(db)
    return list(db.scalars(select(Permission.group).distinct().order_by(Permission.group)).all())


def create_permission(
    db: Session,
    *,
    actor_id: UUID,
    code: str,
    name: str,
    group: str = "general",
    description: str | None = None,
    is_active: bool = True,
) -> Permission:
    code = code.strip().lower()
    if db.scalar(select(Permission).where(Permission.code == code)):
        raise conflict("Permission code already exists")
    row = Permission(
        code=code,
        name=name.strip(),
        group=group.strip() or "general",
        description=description,
        is_active=is_active,
        created_by_user_id=actor_id,
        updated_by_user_id=actor_id,
    )
    db.add(row)
    record_audit(
        db,
        action="rbac.permission_created",
        actor_user_id=actor_id,
        resource_type="permission",
        resource_id=code,
        metadata={"name": name, "is_active": is_active},
    )
    db.commit()
    db.refresh(row)
    return row


def update_permission(
    db: Session,
    *,
    actor_id: UUID,
    permission_id: UUID,
    name: str | None = None,
    group: str | None = None,
    description: str | None = None,
    is_active: bool | None = None,
) -> Permission:
    row = db.get(Permission, permission_id)
    if not row:
        raise not_found("Permission not found")
    changes: dict = {}
    if name is not None:
        row.name = name.strip()
        changes["name"] = row.name
    if group is not None:
        row.group = group.strip() or "general"
        changes["group"] = row.group
    if description is not None:
        row.description = description
        changes["description"] = description
    if is_active is not None and is_active != row.is_active:
        row.is_active = is_active
        changes["is_active"] = is_active
    row.updated_by_user_id = actor_id
    record_audit(
        db,
        action="rbac.permission_updated",
        actor_user_id=actor_id,
        resource_type="permission",
        resource_id=str(row.id),
        metadata=changes or {"touched": True},
    )
    db.commit()
    db.refresh(row)
    return row


def list_roles(
    db: Session,
    *,
    organization_id: UUID | None = None,
    include_system: bool = True,
    q: str | None = None,
    is_active: bool | None = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[Role], dict]:
    ensure_rbac_seeded(db)
    page = max(1, page)
    page_size = min(100, max(1, page_size))
    stmt = select(Role).options(joinedload(Role.permission_links).joinedload(RolePermission.permission))
    if organization_id is None:
        stmt = stmt.where(Role.organization_id.is_(None))
    else:
        clauses = [Role.organization_id == organization_id]
        if include_system:
            clauses.append(Role.organization_id.is_(None))
        stmt = stmt.where(or_(*clauses))
    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(or_(func.lower(Role.slug).like(like), func.lower(Role.name).like(like)))
    if is_active is not None:
        stmt = stmt.where(Role.is_active.is_(is_active))

    # count without joinedload
    count_stmt = select(func.count()).select_from(Role)
    if organization_id is None:
        count_stmt = count_stmt.where(Role.organization_id.is_(None))
    else:
        clauses = [Role.organization_id == organization_id]
        if include_system:
            clauses.append(Role.organization_id.is_(None))
        count_stmt = count_stmt.where(or_(*clauses))
    if q:
        like = f"%{q.strip().lower()}%"
        count_stmt = count_stmt.where(or_(func.lower(Role.slug).like(like), func.lower(Role.name).like(like)))
    if is_active is not None:
        count_stmt = count_stmt.where(Role.is_active.is_(is_active))
    total = db.scalar(count_stmt) or 0

    rows = list(
        db.scalars(
            stmt.order_by(Role.is_system.desc(), Role.name)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .unique()
        .all()
    )
    return rows, _page_meta(total, page, page_size)


def role_to_dict(db: Session, role: Role) -> dict:
    codes = sorted(
        {
            link.permission.code
            for link in (role.permission_links or [])
            if link.permission is not None and link.permission.is_active
        }
    )
    return {
        "id": role.id,
        "slug": role.slug,
        "name": role.name,
        "description": role.description,
        "organization_id": role.organization_id,
        "is_system": role.is_system,
        "is_active": role.is_active,
        "permissions": codes,
        "created_at": role.created_at,
        "updated_at": role.updated_at,
        "created_by": _actor_out(db, role.created_by_user_id),
        "updated_by": _actor_out(db, role.updated_by_user_id),
    }


def create_role(
    db: Session,
    *,
    actor_id: UUID,
    slug: str,
    name: str,
    description: str | None = None,
    organization_id: UUID | None = None,
    is_system: bool = False,
    permission_codes: list[str] | None = None,
) -> Role:
    ensure_rbac_seeded(db)
    slug = slug.strip().lower().replace(" ", "_")
    if slug == "platform_admin":
        raise bad_request("Reserved role slug")
    if is_system and organization_id is not None:
        raise bad_request("System roles cannot belong to an organization")
    if not is_system and organization_id is None:
        # platform-created global custom role treated as system=false global
        pass

    existing = db.scalar(
        select(Role).where(
            Role.slug == slug,
            Role.organization_id == organization_id if organization_id else Role.organization_id.is_(None),
        )
    )
    if existing:
        raise conflict("Role slug already exists in this scope")

    role = Role(
        slug=slug,
        name=name.strip(),
        description=description,
        organization_id=organization_id,
        is_system=is_system,
        is_active=True,
        created_by_user_id=actor_id,
        updated_by_user_id=actor_id,
    )
    db.add(role)
    db.flush()
    if permission_codes:
        _sync_role_permissions(db, role=role, permission_codes=permission_codes)
    record_audit(
        db,
        action="rbac.role_created",
        actor_user_id=actor_id,
        organization_id=organization_id,
        resource_type="role",
        resource_id=str(role.id),
        metadata={"slug": slug},
    )
    db.commit()
    return db.scalar(
        select(Role)
        .options(joinedload(Role.permission_links).joinedload(RolePermission.permission))
        .where(Role.id == role.id)
    )


def update_role(
    db: Session,
    *,
    actor_id: UUID,
    role_id: UUID,
    name: str | None = None,
    description: str | None = None,
    is_active: bool | None = None,
    permission_codes: list[str] | None = None,
    allow_system_edit: bool = False,
) -> Role:
    role = db.scalar(
        select(Role)
        .options(joinedload(Role.permission_links).joinedload(RolePermission.permission))
        .where(Role.id == role_id)
    )
    if not role:
        raise not_found("Role not found")
    if role.is_system and not allow_system_edit:
        raise forbidden("System roles can only be edited by platform admin")
    if name is not None:
        role.name = name.strip()
    if description is not None:
        role.description = description
    changes: dict = {}
    if is_active is not None and is_active != role.is_active:
        role.is_active = is_active
        changes["is_active"] = is_active
    if permission_codes is not None:
        if role.is_system and not allow_system_edit:
            raise forbidden("System role permissions require platform admin")
        _sync_role_permissions(db, role=role, permission_codes=permission_codes)
        changes["permissions"] = permission_codes
    if name is not None:
        changes["name"] = role.name
    role.updated_by_user_id = actor_id
    record_audit(
        db,
        action="rbac.role_updated",
        actor_user_id=actor_id,
        organization_id=role.organization_id,
        resource_type="role",
        resource_id=str(role.id),
        metadata=changes or {"touched": True},
    )
    db.commit()
    return db.scalar(
        select(Role)
        .options(joinedload(Role.permission_links).joinedload(RolePermission.permission))
        .where(Role.id == role_id)
    )


def list_rbac_audit(
    db: Session,
    *,
    q: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[dict], dict]:
    page = max(1, page)
    page_size = min(100, max(1, page_size))
    stmt = select(AuditEvent).where(AuditEvent.action.like("rbac.%"))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                AuditEvent.action.ilike(like),
                AuditEvent.resource_id.ilike(like),
                AuditEvent.resource_type.ilike(like),
            )
        )
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = list(
        db.scalars(stmt.order_by(AuditEvent.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    )
    items = []
    for r in rows:
        meta = None
        if r.metadata_json:
            try:
                meta = json.loads(r.metadata_json)
            except json.JSONDecodeError:
                meta = {"raw": r.metadata_json}
        items.append(
            {
                "id": r.id,
                "action": r.action,
                "resource_type": r.resource_type,
                "resource_id": r.resource_id,
                "actor": _actor_out(db, r.actor_user_id),
                "created_at": r.created_at,
                "metadata": meta,
            }
        )
    return items, _page_meta(total, page, page_size)


def _sync_role_permissions(db: Session, *, role: Role, permission_codes: list[str]) -> None:
    codes = {c.strip().lower() for c in permission_codes}
    perms = list(db.scalars(select(Permission).where(Permission.code.in_(codes))).all()) if codes else []
    found = {p.code for p in perms}
    missing = codes - found
    if missing:
        raise bad_request(f"Unknown permissions: {', '.join(sorted(missing))}")
    wanted = {p.id for p in perms}
    existing = list(db.scalars(select(RolePermission).where(RolePermission.role_id == role.id)).all())
    existing_ids = {e.permission_id for e in existing}
    for link in existing:
        if link.permission_id not in wanted:
            db.delete(link)
    for pid in wanted - existing_ids:
        db.add(RolePermission(role_id=role.id, permission_id=pid))


def assign_member_role(
    db: Session,
    *,
    actor: User,
    organization_id: UUID,
    user_id: UUID,
    role_id: UUID | None = None,
    role_slug: str | None = None,
) -> OrganizationMember:
    require_permission(db, user=actor, organization_id=organization_id, code="org.members.manage")
    membership = db.scalar(
        select(OrganizationMember)
        .options(joinedload(OrganizationMember.user).joinedload(User.profile), joinedload(OrganizationMember.rbac_role))
        .where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user_id,
        )
    )
    if not membership:
        raise not_found("Member not found")
    role = resolve_assignable_role(db, organization_id=organization_id, role_id=role_id, role_slug=role_slug)
    membership.role_id = role.id
    membership.role = legacy_member_role(role)
    record_audit(
        db,
        action="rbac.member_role_assigned",
        actor_user_id=actor.id,
        organization_id=organization_id,
        resource_type="user",
        resource_id=str(user_id),
        metadata={"role_slug": role.slug, "role_id": str(role.id)},
    )
    db.commit()
    db.refresh(membership)
    return membership


def backfill_membership_roles(db: Session) -> None:
    """Attach role_id from legacy enum for any null rows."""
    from app.models import OrganizationInvitation

    ensure_rbac_seeded(db)
    members = db.scalars(select(OrganizationMember).where(OrganizationMember.role_id.is_(None))).all()
    for m in members:
        try:
            role = get_system_role(db, m.role.value)
        except Exception:
            role = get_system_role(db, "candidate")
        m.role_id = role.id
    invites = db.scalars(select(OrganizationInvitation).where(OrganizationInvitation.role_id.is_(None))).all()
    for inv in invites:
        try:
            role = get_system_role(db, inv.role.value)
        except Exception:
            role = get_system_role(db, "recruiter")
        inv.role_id = role.id
    db.commit()
