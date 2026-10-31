"""Spatie-style RBAC: permissions, roles, checks, CRUD."""

from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.errors import bad_request, conflict, forbidden, not_found
from app.models import (
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
        .where(RolePermission.role_id == role_id)
    ).all()
    return set(rows)


def user_permissions(db: Session, *, user: User, organization_id: UUID) -> set[str]:
    if user.is_platform_admin:
        return {p.code for p in db.scalars(select(Permission)).all()} or {
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


def list_permissions(db: Session) -> list[Permission]:
    ensure_rbac_seeded(db)
    return list(db.scalars(select(Permission).order_by(Permission.group, Permission.code)).all())


def create_permission(
    db: Session,
    *,
    actor_id: UUID,
    code: str,
    name: str,
    group: str = "general",
    description: str | None = None,
) -> Permission:
    code = code.strip().lower()
    if db.scalar(select(Permission).where(Permission.code == code)):
        raise conflict("Permission code already exists")
    row = Permission(code=code, name=name.strip(), group=group.strip() or "general", description=description)
    db.add(row)
    record_audit(
        db,
        action="rbac.permission_created",
        actor_user_id=actor_id,
        resource_type="permission",
        resource_id=code,
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
) -> Permission:
    row = db.get(Permission, permission_id)
    if not row:
        raise not_found("Permission not found")
    if name is not None:
        row.name = name.strip()
    if group is not None:
        row.group = group.strip() or "general"
    if description is not None:
        row.description = description
    record_audit(
        db,
        action="rbac.permission_updated",
        actor_user_id=actor_id,
        resource_type="permission",
        resource_id=str(row.id),
    )
    db.commit()
    db.refresh(row)
    return row


def list_roles(db: Session, *, organization_id: UUID | None = None, include_system: bool = True) -> list[Role]:
    ensure_rbac_seeded(db)
    q = select(Role).options(joinedload(Role.permission_links).joinedload(RolePermission.permission))
    if organization_id is None:
        q = q.where(Role.organization_id.is_(None))
    else:
        clauses = [Role.organization_id == organization_id]
        if include_system:
            clauses.append(Role.organization_id.is_(None))
        q = q.where(or_(*clauses))
    return list(db.scalars(q.order_by(Role.is_system.desc(), Role.name)).unique().all())


def role_to_dict(role: Role) -> dict:
    codes = sorted(
        {
            link.permission.code
            for link in (role.permission_links or [])
            if link.permission is not None
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
    if is_active is not None:
        role.is_active = is_active
    if permission_codes is not None:
        if role.is_system and not allow_system_edit:
            raise forbidden("System role permissions require platform admin")
        _sync_role_permissions(db, role=role, permission_codes=permission_codes)
    record_audit(
        db,
        action="rbac.role_updated",
        actor_user_id=actor_id,
        organization_id=role.organization_id,
        resource_type="role",
        resource_id=str(role.id),
    )
    db.commit()
    return db.scalar(
        select(Role)
        .options(joinedload(Role.permission_links).joinedload(RolePermission.permission))
        .where(Role.id == role_id)
    )


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
