import uuid

from app.core.security import hash_password
from app.models import MemberRole, User, UserProfile
from app.services.workspace import create_workspace
from tests.conftest import TestingSessionLocal


def _make_platform_admin(email: str) -> None:
    db = TestingSessionLocal()
    try:
        user = User(
            email=email,
            hashed_password=hash_password("AdminPass1!"),
            is_active=True,
            is_email_verified=True,
            is_platform_admin=True,
        )
        db.add(user)
        db.flush()
        db.add(UserProfile(user_id=user.id, full_name="Platform Admin"))
        create_workspace(
            db,
            name="Admin workspace",
            owner_user_id=user.id,
            owner_role=MemberRole.org_admin,
            is_personal=True,
            slug_seed="admin",
        )
        db.commit()
    finally:
        db.close()


def _login(client, email: str, password: str = "AdminPass1!") -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def test_rbac_permission_grant_and_platform_bypass(client, unique_email):
    admin_email = f"rbac-admin-{uuid.uuid4().hex[:8]}@example.com"
    _make_platform_admin(admin_email)
    admin_token = _login(client, admin_email)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Register a normal user
    client.post(
        "/api/v1/auth/register",
        json={"email": unique_email, "password": "SecurePass1!", "full_name": "Normal User"},
    )
    user_token = _login(client, unique_email, "SecurePass1!")
    user_headers = {"Authorization": f"Bearer {user_token}"}

    me = client.get("/api/v1/users/me", headers=user_headers)
    assert me.status_code == 200
    membership = me.json()["memberships"][0]
    assert "org.view" in membership["permissions"]
    assert "org.members.create" not in membership["permissions"]
    assert "org.members.invite" not in membership["permissions"]
    org_id = membership["organization_id"]

    # Candidate cannot invite
    denied = client.post(
        f"/api/v1/organizations/{org_id}/invitations",
        headers=user_headers,
        json={"email": "x@example.com", "role_slug": "recruiter"},
    )
    assert denied.status_code == 403

    # Platform admin bypasses org permission checks
    bypass = client.post(
        f"/api/v1/organizations/{org_id}/invitations",
        headers=admin_headers,
        json={"email": "y@example.com", "role_slug": "recruiter"},
    )
    assert bypass.status_code == 201, bypass.text


def test_system_role_matrix_platform_only(client):
    admin_email = f"rbac-admin-{uuid.uuid4().hex[:8]}@example.com"
    _make_platform_admin(admin_email)
    token = _login(client, admin_email)
    headers = {"Authorization": f"Bearer {token}"}

    roles = client.get("/api/v1/rbac/roles", headers=headers)
    assert roles.status_code == 200
    body = roles.json()
    items = body["items"] if isinstance(body, dict) else body
    org_admin = next(r for r in items if r["slug"] == "org_admin")
    assert "org.roles.create" in org_admin["permissions"]
    assert "org.roles.edit" in org_admin["permissions"]
    assert "org.members.delete" in org_admin["permissions"]
    assert "jobs.create" in org_admin["permissions"]
    assert "is_active" in org_admin
    assert "updated_at" in org_admin

    updated = client.patch(
        f"/api/v1/rbac/roles/{org_admin['id']}",
        headers=headers,
        json={"permission_codes": org_admin["permissions"]},
    )
    assert updated.status_code == 200

    audit = client.get("/api/v1/rbac/audit", headers=headers)
    assert audit.status_code == 200
    assert "items" in audit.json()


def test_admin_assign_role_and_special_permissions(client, unique_email):
    admin_email = f"rbac-admin-{uuid.uuid4().hex[:8]}@example.com"
    _make_platform_admin(admin_email)
    admin_token = _login(client, admin_email)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    client.post(
        "/api/v1/auth/register",
        json={"email": unique_email, "password": "SecurePass1!", "full_name": "Member User"},
    )
    user_token = _login(client, unique_email, "SecurePass1!")
    user_headers = {"Authorization": f"Bearer {user_token}"}

    me = client.get("/api/v1/users/me", headers=user_headers)
    assert me.status_code == 200
    membership = me.json()["memberships"][0]
    org_id = membership["organization_id"]
    user_id = me.json()["id"]
    assert "org.members.create" not in membership["permissions"]

    roles = client.get("/api/v1/rbac/roles?include_system=true", headers=admin_headers)
    assert roles.status_code == 200
    recruiter = next(r for r in roles.json()["items"] if r["slug"] == "recruiter")

    assigned = client.patch(
        f"/api/v1/admin/users/{user_id}/organizations/{org_id}/role",
        headers=admin_headers,
        json={"role_id": recruiter["id"]},
    )
    assert assigned.status_code == 200, assigned.text
    mem = next(m for m in assigned.json()["memberships"] if m["organization_id"] == org_id)
    assert mem["role"] == "recruiter"
    assert mem["role_id"] == recruiter["id"]

    # Special permission on top of role (granular create)
    special = client.put(
        f"/api/v1/admin/users/{user_id}/organizations/{org_id}/special-permissions",
        headers=admin_headers,
        json={"permission_codes": ["org.members.create"]},
    )
    assert special.status_code == 200, special.text
    mem = next(m for m in special.json()["memberships"] if m["organization_id"] == org_id)
    assert "org.members.create" in mem["special_permissions"]
    assert "org.members.create" in mem["effective_permissions"]

    me2 = client.get("/api/v1/users/me", headers=user_headers)
    assert me2.status_code == 200
    m2 = next(x for x in me2.json()["memberships"] if x["organization_id"] == org_id)
    assert "org.members.create" in m2["permissions"]

    invite = client.post(
        f"/api/v1/organizations/{org_id}/invitations",
        headers=user_headers,
        json={"email": f"invitee-{uuid.uuid4().hex[:6]}@example.com", "role_slug": "candidate"},
    )
    assert invite.status_code == 201, invite.text
