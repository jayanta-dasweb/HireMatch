"""Seed permission groups, permission catalog + system roles (idempotent)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Permission, PermissionGroup, Role, RolePermission

GROUPS = [
    ("organization", "Organization", "Org basics"),
    ("members", "Members", "People in a workspace"),
    ("roles", "Roles", "Org role management"),
    ("settings", "Settings", "Workspace settings"),
    ("general", "General", "Uncategorized"),
]

PERMISSIONS = [
    ("org.view", "View organization", "organization", "View org basics"),
    ("org.members.view", "View members", "members", "List organization members"),
    ("org.members.invite", "Invite members", "members", "Send invitations"),
    ("org.members.manage", "Manage members", "members", "Change member roles / remove"),
    ("org.roles.manage", "Manage roles", "roles", "Create org roles and assign permissions"),
    ("org.settings.manage", "Manage settings", "settings", "Update organization settings"),
]

SYSTEM_ROLE_PERMS: dict[str, list[str]] = {
    "candidate": ["org.view", "org.members.view"],
    "recruiter": ["org.view", "org.members.view"],
    "agency_manager": ["org.view", "org.members.view", "org.members.invite"],
    "org_admin": [
        "org.view",
        "org.members.view",
        "org.members.invite",
        "org.members.manage",
        "org.roles.manage",
        "org.settings.manage",
    ],
}

SYSTEM_ROLE_META = {
    "candidate": ("Candidate", "Personal / candidate access"),
    "recruiter": ("Recruiter", "Recruiter workspace access"),
    "agency_manager": ("Agency manager", "Can invite members"),
    "org_admin": ("Organization admin", "Full organization control"),
}


def seed_rbac_defaults(db: Session) -> None:
    group_by_slug: dict[str, PermissionGroup] = {}
    for slug, name, description in GROUPS:
        existing = db.scalar(select(PermissionGroup).where(PermissionGroup.slug == slug))
        if existing:
            existing.name = name
            existing.description = description
            existing.is_active = True
            group_by_slug[slug] = existing
        else:
            row = PermissionGroup(slug=slug, name=name, description=description, is_active=True)
            db.add(row)
            db.flush()
            group_by_slug[slug] = row

    perm_by_code: dict[str, Permission] = {}
    for code, name, group_slug, description in PERMISSIONS:
        grp = group_by_slug.get(group_slug) or group_by_slug["general"]
        existing = db.scalar(select(Permission).where(Permission.code == code))
        if existing:
            existing.name = name
            existing.group = grp.slug
            existing.group_id = grp.id
            existing.description = description
            perm_by_code[code] = existing
        else:
            row = Permission(
                code=code,
                name=name,
                group=grp.slug,
                group_id=grp.id,
                description=description,
                is_active=True,
            )
            db.add(row)
            db.flush()
            perm_by_code[code] = row

    for slug, codes in SYSTEM_ROLE_PERMS.items():
        name, description = SYSTEM_ROLE_META[slug]
        role = db.scalar(
            select(Role).where(Role.slug == slug, Role.organization_id.is_(None), Role.is_system.is_(True))
        )
        if not role:
            role = Role(
                slug=slug,
                name=name,
                description=description,
                organization_id=None,
                is_system=True,
                is_active=True,
            )
            db.add(role)
            db.flush()
        else:
            role.name = name
            role.description = description
            role.is_active = True

        wanted = {perm_by_code[c].id for c in codes if c in perm_by_code}
        existing_links = list(
            db.scalars(select(RolePermission).where(RolePermission.role_id == role.id)).all()
        )
        existing_ids = {link.permission_id for link in existing_links}
        for link in existing_links:
            if link.permission_id not in wanted:
                db.delete(link)
        for pid in wanted - existing_ids:
            db.add(RolePermission(role_id=role.id, permission_id=pid))

    db.commit()
