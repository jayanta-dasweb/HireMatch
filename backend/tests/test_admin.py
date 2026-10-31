import uuid

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import MemberRole, User, UserProfile
from app.services.workspace import create_workspace
from tests.conftest import TestingSessionLocal


def _make_platform_admin(email: str) -> User:
    db: Session = TestingSessionLocal()
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
        db.refresh(user)
        return user
    finally:
        db.close()


def _login(client, email: str, password: str = "AdminPass1!") -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def test_admin_create_user_and_grant_admin(client):
    admin_email = f"padmin-{uuid.uuid4().hex[:8]}@example.com"
    _make_platform_admin(admin_email)
    token = _login(client, admin_email)
    headers = {"Authorization": f"Bearer {token}"}

    created_email = f"created-{uuid.uuid4().hex[:8]}@example.com"
    create = client.post(
        "/api/v1/admin/users",
        headers=headers,
        json={
            "email": created_email,
            "full_name": "Created User",
            "password": "SecurePass1!",
            "is_platform_admin": False,
            "is_email_verified": True,
        },
    )
    assert create.status_code == 201, create.text
    body = create.json()
    assert body["email"] == created_email
    assert body["is_platform_admin"] is False
    user_id = body["id"]

    grant = client.patch(
        f"/api/v1/admin/users/{user_id}",
        headers=headers,
        json={"is_platform_admin": True},
    )
    assert grant.status_code == 200, grant.text
    assert grant.json()["is_platform_admin"] is True


def test_admin_cannot_self_demote(client):
    admin_email = f"padmin-{uuid.uuid4().hex[:8]}@example.com"
    admin = _make_platform_admin(admin_email)
    token = _login(client, admin_email)
    headers = {"Authorization": f"Bearer {token}"}

    demote = client.patch(
        f"/api/v1/admin/users/{admin.id}",
        headers=headers,
        json={"is_platform_admin": False},
    )
    assert demote.status_code == 400, demote.text
    assert "own platform admin" in demote.json()["detail"].lower()

    deactivate = client.patch(
        f"/api/v1/admin/users/{admin.id}/active",
        headers=headers,
        json={"is_active": False},
    )
    assert deactivate.status_code == 400, deactivate.text
