def _register_and_login(client, email: str, name: str) -> dict:
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SecurePass1!", "full_name": name},
    )
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePass1!"})
    assert login.status_code == 200
    return login.json()


def test_cross_tenant_org_access_denied(client, unique_email):
    email_a = unique_email
    email_b = unique_email.replace("@", "+b@")

    tokens_a = _register_and_login(client, email_a, "User A")
    tokens_b = _register_and_login(client, email_b, "User B")

    orgs_a = client.get(
        "/api/v1/organizations",
        headers={"Authorization": f"Bearer {tokens_a['access_token']}"},
    )
    assert orgs_a.status_code == 200
    org_a_id = orgs_a.json()[0]["id"]

    # User B must not access User A's organization by guessed ID
    denied = client.get(
        f"/api/v1/organizations/{org_a_id}",
        headers={"Authorization": f"Bearer {tokens_b['access_token']}"},
    )
    assert denied.status_code == 404

    members_denied = client.get(
        f"/api/v1/organizations/{org_a_id}/members",
        headers={"Authorization": f"Bearer {tokens_b['access_token']}"},
    )
    assert members_denied.status_code == 404


def test_create_org_and_invite_requires_manager(client, unique_email):
    tokens = _register_and_login(client, unique_email, "Org Creator")
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    created = client.post(
        "/api/v1/organizations",
        headers=headers,
        json={"name": "Acme Recruiting", "slug": f"acme-{unique_email[:8]}"},
    )
    assert created.status_code == 201
    org_id = created.json()["id"]

    invite = client.post(
        f"/api/v1/organizations/{org_id}/invitations",
        headers=headers,
        json={"email": "recruiter@example.com", "role": "recruiter"},
    )
    assert invite.status_code == 201
    assert invite.json()["invite_token"] is not None
