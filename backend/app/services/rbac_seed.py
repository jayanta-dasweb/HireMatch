"""Seed permission groups, granular CRUD catalog + system roles (idempotent)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Permission, PermissionGroup, Role, RolePermission

GROUPS = [
    ("organization", "Organization", "Org profile & workspace"),
    ("members", "Members", "People in a workspace"),
    ("roles", "Roles", "Org role management"),
    ("settings", "Settings", "Workspace settings"),
    ("jobs", "Jobs", "Job postings (Phase 2)"),
    ("resumes", "Resumes", "Resume library (Phase 2)"),
    ("general", "General", "Uncategorized"),
]

# Fine-grained codes — UI and API gate on view / create / edit / delete.
PERMISSIONS = [
    # Organization
    ("org.view", "View organization", "organization", "See org name and workspace basics"),
    ("org.edit", "Edit organization", "organization", "Update org profile / branding"),
    # Members
    ("org.members.view", "View members", "members", "List organization members"),
    ("org.members.create", "Invite members", "members", "Send invitations (create membership)"),
    ("org.members.edit", "Edit members", "members", "Change a member's role"),
    ("org.members.delete", "Remove members", "members", "Remove someone from the organization"),
    # Roles
    ("org.roles.view", "View roles", "roles", "See roles and permission matrix"),
    ("org.roles.create", "Create roles", "roles", "Create custom organization roles"),
    ("org.roles.edit", "Edit roles", "roles", "Change role name/permissions/active"),
    ("org.roles.delete", "Delete roles", "roles", "Deactivate or remove custom roles"),
    # Settings
    ("org.settings.view", "View settings", "settings", "See workspace settings"),
    ("org.settings.edit", "Edit settings", "settings", "Update workspace settings"),
    # Jobs (Phase 2 UI will hide/show from these)
    ("jobs.view", "View jobs", "jobs", "List and open job postings"),
    ("jobs.create", "Create jobs", "jobs", "Create job postings"),
    ("jobs.edit", "Edit jobs", "jobs", "Update job postings"),
    ("jobs.delete", "Delete jobs", "jobs", "Archive or delete jobs"),
    # Resumes (Phase 2)
    ("resumes.view", "View resumes", "resumes", "Browse resume library"),
    ("resumes.create", "Upload resumes", "resumes", "Add resumes"),
    ("resumes.edit", "Edit resumes", "resumes", "Update resume metadata"),
    ("resumes.delete", "Delete resumes", "resumes", "Remove resumes"),
]

# Legacy codes kept so old role matrices / special grants keep working.
LEGACY_PERMISSIONS = [
    ("org.members.invite", "Invite members (legacy)", "members", "Alias of org.members.create"),
    ("org.members.manage", "Manage members (legacy)", "members", "Alias of edit+delete members"),
    ("org.roles.manage", "Manage roles (legacy)", "roles", "Alias of roles create/edit/delete"),
    ("org.settings.manage", "Manage settings (legacy)", "settings", "Alias of org.settings.edit"),
]

# If someone still has a legacy code, treat these as also granted.
PERMISSION_EXPAND: dict[str, tuple[str, ...]] = {
    "org.members.invite": ("org.members.create",),
    "org.members.manage": ("org.members.edit", "org.members.delete"),
    "org.roles.manage": ("org.roles.view", "org.roles.create", "org.roles.edit", "org.roles.delete"),
    "org.settings.manage": ("org.settings.view", "org.settings.edit"),
}

SYSTEM_ROLE_PERMS: dict[str, list[str]] = {
    "candidate": [
        "org.view",
        "org.members.view",
        "jobs.view",
        "resumes.view",
        "resumes.create",
    ],
    "recruiter": [
        "org.view",
        "org.members.view",
        "jobs.view",
        "jobs.create",
        "jobs.edit",
        "resumes.view",
        "resumes.create",
        "resumes.edit",
    ],
    "agency_manager": [
        "org.view",
        "org.members.view",
        "org.members.create",
        "org.roles.view",
        "jobs.view",
        "jobs.create",
        "jobs.edit",
        "jobs.delete",
        "resumes.view",
        "resumes.create",
        "resumes.edit",
        "resumes.delete",
    ],
    "org_admin": [
        "org.view",
        "org.edit",
        "org.members.view",
        "org.members.create",
        "org.members.edit",
        "org.members.delete",
        "org.roles.view",
        "org.roles.create",
        "org.roles.edit",
        "org.roles.delete",
        "org.settings.view",
        "org.settings.edit",
        "jobs.view",
        "jobs.create",
        "jobs.edit",
        "jobs.delete",
        "resumes.view",
        "resumes.create",
        "resumes.edit",
        "resumes.delete",
    ],
}

SYSTEM_ROLE_META = {
    "candidate": ("Candidate", "Personal / candidate access"),
    "recruiter": ("Recruiter", "Jobs & resumes; view members"),
    "agency_manager": ("Agency manager", "Invite members; manage jobs/resumes"),
    "org_admin": ("Organization admin", "Full organization control"),
}


def expand_permission_codes(codes: set[str]) -> set[str]:
    """Expand legacy codes into granular CRUD codes for checks + UI."""
    out = set(codes)
    for code in list(codes):
        for extra in PERMISSION_EXPAND.get(code, ()):
            out.add(extra)
    return out


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
    for code, name, group_slug, description in [*PERMISSIONS, *LEGACY_PERMISSIONS]:
        grp = group_by_slug.get(group_slug) or group_by_slug["general"]
        existing = db.scalar(select(Permission).where(Permission.code == code))
        if existing:
            existing.name = name
            existing.group = grp.slug
            existing.group_id = grp.id
            existing.description = description
            existing.is_active = True
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
