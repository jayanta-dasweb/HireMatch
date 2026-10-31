from app.core.security import hash_password, hash_token, verify_password


def test_password_hash_roundtrip():
    hashed = hash_password("SecurePass1!")
    assert hashed != "SecurePass1!"
    assert verify_password("SecurePass1!", hashed)
    assert not verify_password("wrong", hashed)


def test_token_hash_is_sha256_hex():
    digest = hash_token("abc")
    assert len(digest) == 64
    assert digest == hash_token("abc")
    assert digest != hash_token("abcd")
