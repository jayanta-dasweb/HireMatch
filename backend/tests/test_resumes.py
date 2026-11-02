from pathlib import Path

from app.core.config import get_settings

FIXTURE_DOCX = Path(__file__).resolve().parent / "fixtures" / "sample_resume.docx"


def _register_and_login(client, email: str, name: str) -> dict:
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SecurePass1!", "full_name": name},
    )
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePass1!"})
    assert login.status_code == 200
    return login.json()


def _org_id(client, token: str) -> str:
    me = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    return me.json()["memberships"][0]["organization_id"]


def test_resume_upload_extract_and_list(client, unique_email):
    tokens = _register_and_login(client, unique_email, "Resume Owner")
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    org_id = _org_id(client, tokens["access_token"])

    with FIXTURE_DOCX.open("rb") as fh:
        uploaded = client.post(
            f"/api/v1/organizations/{org_id}/resumes",
            headers=headers,
            files={
                "file": (
                    "sample_resume.docx",
                    fh,
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
            },
            data={"title": "Alice CV"},
        )
    assert uploaded.status_code == 201, uploaded.text
    body = uploaded.json()
    assert body["title"] == "Alice CV"
    assert body["status"] == "ready"
    assert body["latest_version"] is not None
    assert "Alice Example" in (body["latest_version"]["extracted_text"] or "")
    assert "Python" in (body["latest_version"]["extracted_text"] or "")

    listed = client.get(f"/api/v1/organizations/{org_id}/resumes", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["id"] == body["id"]

    detail = client.get(f"/api/v1/organizations/{org_id}/resumes/{body['id']}", headers=headers)
    assert detail.status_code == 200
    assert len(detail.json()["versions"]) == 1

    download = client.get(
        f"/api/v1/organizations/{org_id}/resumes/{body['id']}/download",
        headers=headers,
    )
    assert download.status_code == 200
    assert len(download.content) > 100


def test_resume_cross_org_isolation(client, unique_email):
    email_a = unique_email
    email_b = unique_email.replace("@", "+b@")
    tokens_a = _register_and_login(client, email_a, "User A")
    tokens_b = _register_and_login(client, email_b, "User B")
    headers_a = {"Authorization": f"Bearer {tokens_a['access_token']}"}
    headers_b = {"Authorization": f"Bearer {tokens_b['access_token']}"}
    org_a = _org_id(client, tokens_a["access_token"])

    with FIXTURE_DOCX.open("rb") as fh:
        uploaded = client.post(
            f"/api/v1/organizations/{org_a}/resumes",
            headers=headers_a,
            files={
                "file": (
                    "sample_resume.docx",
                    fh,
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
            },
        )
    assert uploaded.status_code == 201, uploaded.text
    doc_id = uploaded.json()["id"]

    denied_list = client.get(f"/api/v1/organizations/{org_a}/resumes", headers=headers_b)
    assert denied_list.status_code in (403, 404)

    denied_get = client.get(
        f"/api/v1/organizations/{org_a}/resumes/{doc_id}",
        headers=headers_b,
    )
    assert denied_get.status_code in (403, 404)

    denied_dl = client.get(
        f"/api/v1/organizations/{org_a}/resumes/{doc_id}/download",
        headers=headers_b,
    )
    assert denied_dl.status_code in (403, 404)


def test_resume_create_permission_denied(client, unique_email):
    """Member with resumes.view but not resumes.create cannot upload."""
    owner_email = unique_email
    member_email = unique_email.replace("@", "+viewer@")
    tokens_owner = _register_and_login(client, owner_email, "Org Owner")
    tokens_member = _register_and_login(client, member_email, "Viewer Only")
    headers_owner = {"Authorization": f"Bearer {tokens_owner['access_token']}"}
    headers_member = {"Authorization": f"Bearer {tokens_member['access_token']}"}

    # Team org → owner is org_admin (personal workspace is candidate-only)
    created = client.post(
        "/api/v1/organizations",
        headers=headers_owner,
        json={"name": "Resume Co", "slug": f"resume-co-{unique_email[:8]}"},
    )
    assert created.status_code == 201, created.text
    org_id = created.json()["id"]
    member_id = client.get("/api/v1/users/me", headers=headers_member).json()["id"]
    role_slug = f"rv-{org_id[:8]}"

    role = client.post(
        "/api/v1/rbac/roles",
        headers=headers_owner,
        json={
            "slug": role_slug,
            "name": "Resume viewer",
            "description": "View only",
            "organization_id": org_id,
            "is_system": False,
            "permission_codes": ["org.view", "resumes.view"],
        },
    )
    assert role.status_code == 201, role.text
    role_id = role.json()["id"]

    invite = client.post(
        f"/api/v1/organizations/{org_id}/invitations",
        headers=headers_owner,
        json={"email": member_email, "role_slug": role_slug},
    )
    assert invite.status_code == 201, invite.text

    accept = client.post(
        f"/api/v1/organizations/{org_id}/invitations/accept",
        headers=headers_member,
        json={"token": invite.json()["invite_token"]},
    )
    assert accept.status_code in (200, 201), accept.text

    client.patch(
        f"/api/v1/rbac/organizations/{org_id}/members/{member_id}/role",
        headers=headers_owner,
        json={"role_id": role_id},
    )

    me = client.get("/api/v1/users/me", headers=headers_member).json()
    mem = next(m for m in me["memberships"] if m["organization_id"] == org_id)
    assert "resumes.view" in mem["permissions"]
    assert "resumes.create" not in mem["permissions"]

    with FIXTURE_DOCX.open("rb") as fh:
        denied = client.post(
            f"/api/v1/organizations/{org_id}/resumes",
            headers=headers_member,
            files={
                "file": (
                    "sample_resume.docx",
                    fh,
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
            },
        )
    assert denied.status_code == 403, denied.text


def test_resume_malware_reject_all(client, unique_email, monkeypatch):
    monkeypatch.setenv("RESUME_MALWARE_SCANNER", "reject_all")
    get_settings.cache_clear()
    # Celery app already imported — scanner reads settings per call
    tokens = _register_and_login(client, unique_email, "Scan User")
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    org_id = _org_id(client, tokens["access_token"])

    with FIXTURE_DOCX.open("rb") as fh:
        uploaded = client.post(
            f"/api/v1/organizations/{org_id}/resumes",
            headers=headers,
            files={
                "file": (
                    "sample_resume.docx",
                    fh,
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
            },
        )
    assert uploaded.status_code == 201, uploaded.text
    body = uploaded.json()
    assert body["status"] == "failed"
    assert body["latest_version"] is not None
    assert "malware" in (body["latest_version"]["parse_error"] or "").lower()

    monkeypatch.setenv("RESUME_MALWARE_SCANNER", "noop")
    get_settings.cache_clear()
