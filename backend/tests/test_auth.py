def test_register_login_me(client, unique_email):
    register = client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": "SecurePass1!",
            "full_name": "Test Candidate",
        },
    )
    assert register.status_code == 201, register.text
    body = register.json()
    assert body["email"] == unique_email
    assert "verification_token" in body

    verify = client.post("/api/v1/auth/verify-email", json={"token": body["verification_token"]})
    assert verify.status_code == 200

    login = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "SecurePass1!"},
    )
    assert login.status_code == 200, login.text
    tokens = login.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens

    me = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me.status_code == 200
    me_body = me.json()
    assert me_body["email"] == unique_email
    assert me_body["is_email_verified"] is True
    assert len(me_body["memberships"]) >= 1


def test_refresh_and_logout(client, unique_email):
    client.post(
        "/api/v1/auth/register",
        json={"email": unique_email, "password": "SecurePass1!", "full_name": "Refresh User"},
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "SecurePass1!"},
    )
    tokens = login.json()

    refreshed = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refreshed.status_code == 200
    new_tokens = refreshed.json()

    # Old refresh should no longer work after rotation
    reuse = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert reuse.status_code == 401

    logout = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {new_tokens['access_token']}"},
        json={"refresh_token": new_tokens["refresh_token"]},
    )
    assert logout.status_code == 200


def test_password_reset_flow(client, unique_email):
    client.post(
        "/api/v1/auth/register",
        json={"email": unique_email, "password": "SecurePass1!", "full_name": "Reset User"},
    )
    forgot = client.post("/api/v1/auth/forgot-password", json={"email": unique_email})
    assert forgot.status_code == 202
    reset_token = forgot.json()["reset_token"]

    reset = client.post(
        "/api/v1/auth/reset-password",
        json={"token": reset_token, "new_password": "NewSecurePass2!"},
    )
    assert reset.status_code == 200

    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "SecurePass1!"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "NewSecurePass2!"},
    )
    assert new_login.status_code == 200
