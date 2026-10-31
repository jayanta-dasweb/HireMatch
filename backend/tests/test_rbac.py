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
    org_admin = next(r for r in roles.json() if r["slug"] == "org_admin")
    assert "org.roles.manage" in org_admin["permissions"]

    updated = client.patch(
        f"/api/v1/rbac/roles/{org_admin['id']}",
        headers=headers,
        json={"permission_codes": org_admin["permissions"]},
    )
    assert updated.status_code == 200
