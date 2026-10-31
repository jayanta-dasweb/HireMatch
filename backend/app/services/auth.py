"""Authentication: register, login, tokens, email verify, password reset."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.core.errors import bad_request, conflict, forbidden, unauthorized
from app.core.security import create_access_token, hash_password, verify_password
from app.models import (
    EmailVerificationToken,
    MemberRole,
    PasswordResetToken,
    RefreshToken,
    User,
    UserProfile,
)
from app.services import tokens as token_svc
from app.services.audit import record_audit
from app.services.email import send_email
from app.services.workspace import create_workspace


def register_user(db: Session, *, email: str, password: str, full_name: str) -> tuple[User, str]:
    email = email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise conflict("Email already registered")

    user = User(email=email, hashed_password=hash_password(password))
    db.add(user)
    db.flush()
    db.add(UserProfile(user_id=user.id, full_name=full_name))

    org = create_workspace(
        db,
        name=f"{full_name}'s workspace",
        owner_user_id=user.id,
        owner_role=MemberRole.candidate,
        is_personal=True,
        slug_seed=full_name,
    )

    raw, hashed = token_svc.new_raw_token()
    db.add(
        EmailVerificationToken(
            user_id=user.id,
            token_hash=hashed,
            expires_at=token_svc.make_expiry(hours=get_settings().email_token_expire_hours),
        )
    )
    record_audit(
        db,
        action="user.registered",
        actor_user_id=user.id,
        organization_id=org.id,
        resource_type="user",
        resource_id=str(user.id),
    )

    link = f"{get_settings().frontend_url}/verify-email?token={raw}"
    send_email(
        to=user.email,
        subject="Verify your HireMatch AI email",
        body=f"Welcome to HireMatch AI.\n\nVerify your email: {link}\n",
    )
    db.commit()
    db.refresh(user)
    return user, raw


def authenticate_user(db: Session, *, email: str, password: str) -> User:
    user = db.scalar(
        select(User)
        .options(joinedload(User.profile), joinedload(User.memberships))
        .where(User.email == email.lower())
    )
    if not user or not verify_password(password, user.hashed_password):
        raise unauthorized("Invalid credentials")
    if not user.is_active:
        raise forbidden("Account is inactive")
    return user


def issue_token_pair(db: Session, user: User) -> dict[str, str]:
    raw, hashed = token_svc.new_raw_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hashed,
            expires_at=token_svc.make_expiry(days=get_settings().refresh_token_expire_days),
        )
    )
    db.commit()
    return {
        "access_token": create_access_token(subject=user.id),
        "refresh_token": raw,
        "token_type": "bearer",
    }


def refresh_token_pair(db: Session, *, refresh_token: str) -> dict[str, str]:
    stored = token_svc.find_by_hash(db, RefreshToken, refresh_token)
    if not token_svc.still_valid(stored):
        raise unauthorized("Invalid refresh token")

    user = db.get(User, stored.user_id)
    if not user or not user.is_active:
        raise unauthorized("Invalid refresh token")

    token_svc.mark_revoked(stored)
    return issue_token_pair(db, user)


def logout(db: Session, *, refresh_token: str, user_id: UUID) -> None:
    stored = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_svc.token_hash(refresh_token),
            RefreshToken.user_id == user_id,
        )
    )
    if stored and stored.revoked_at is None:
        token_svc.mark_revoked(stored)
        db.commit()


def verify_email(db: Session, *, token: str) -> None:
    stored = token_svc.find_by_hash(db, EmailVerificationToken, token)
    if not token_svc.still_valid(stored):
        raise bad_request("Invalid or expired token")

    user = db.get(User, stored.user_id)
    if not user:
        raise bad_request("Invalid or expired token")

    user.is_email_verified = True
    token_svc.mark_used(stored)
    record_audit(
        db,
        action="user.email_verified",
        actor_user_id=user.id,
        resource_type="user",
        resource_id=str(user.id),
    )
    db.commit()


def forgot_password(db: Session, *, email: str) -> str | None:
    user = db.scalar(select(User).where(User.email == email.lower()))
    if not user:
        return None

    settings = get_settings()
    raw, hashed = token_svc.new_raw_token()
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hashed,
            expires_at=token_svc.make_expiry(hours=settings.password_reset_expire_hours),
        )
    )
    link = f"{settings.frontend_url}/reset-password?token={raw}"
    send_email(
        to=user.email,
        subject="Reset your HireMatch AI password",
        body=f"Reset your password: {link}\n",
    )
    record_audit(db, action="user.password_reset_requested", actor_user_id=user.id)
    db.commit()
    return raw if settings.email_backend == "console" else None


def reset_password(db: Session, *, token: str, new_password: str) -> None:
    stored = token_svc.find_by_hash(db, PasswordResetToken, token)
    if not token_svc.still_valid(stored):
        raise bad_request("Invalid or expired token")

    user = db.get(User, stored.user_id)
    if not user:
        raise bad_request("Invalid or expired token")

    user.hashed_password = hash_password(new_password)
    token_svc.mark_used(stored)
    token_svc.revoke_all_refresh(db, RefreshToken, user_id=user.id)
    record_audit(db, action="user.password_reset", actor_user_id=user.id)
    db.commit()
