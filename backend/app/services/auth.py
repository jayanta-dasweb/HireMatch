from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    generate_raw_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models import (
    EmailVerificationToken,
    MemberRole,
    Organization,
    OrganizationMember,
    PasswordResetToken,
    RefreshToken,
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
    User,
    UserProfile,
)
from app.services.audit import record_audit
from app.services.email import send_email
from app.services.slugs import unique_org_slug


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def register_user(db: Session, *, email: str, password: str, full_name: str) -> tuple[User, str]:
    existing = db.scalar(select(User).where(User.email == email.lower()))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=email.lower(),
        hashed_password=hash_password(password),
        is_email_verified=False,
    )
    db.add(user)
    db.flush()

    profile = UserProfile(user_id=user.id, full_name=full_name)
    db.add(profile)

    org = Organization(
        name=f"{full_name}'s workspace",
        slug=unique_org_slug(db, full_name),
        is_personal=True,
    )
    db.add(org)
    db.flush()

    membership = OrganizationMember(
        organization_id=org.id,
        user_id=user.id,
        role=MemberRole.candidate,
    )
    db.add(membership)

    free_plan = db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == "free"))
    if free_plan:
        db.add(
            Subscription(
                organization_id=org.id,
                plan_id=free_plan.id,
                status=SubscriptionStatus.trial,
            )
        )

    raw_verify = generate_raw_token()
    verify = EmailVerificationToken(
        user_id=user.id,
        token_hash=hash_token(raw_verify),
        expires_at=_utcnow() + timedelta(hours=get_settings().email_token_expire_hours),
    )
    db.add(verify)

    record_audit(
        db,
        action="user.registered",
        actor_user_id=user.id,
        organization_id=org.id,
        resource_type="user",
        resource_id=str(user.id),
    )

    settings = get_settings()
    verify_link = f"{settings.frontend_url}/verify-email?token={raw_verify}"
    send_email(
        to=user.email,
        subject="Verify your HireMatch AI email",
        body=(
            f"Welcome to HireMatch AI.\n\n"
            f"Verify your email: {verify_link}\n\n"
            f"If you did not create this account, ignore this message."
        ),
    )

    db.commit()
    db.refresh(user)
    return user, raw_verify


def authenticate_user(db: Session, *, email: str, password: str) -> User:
    user = db.scalar(
        select(User)
        .options(joinedload(User.profile), joinedload(User.memberships))
        .where(User.email == email.lower())
    )
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")
    return user


def issue_token_pair(db: Session, user: User) -> dict[str, str]:
    access = create_access_token(subject=user.id)
    raw_refresh = generate_raw_token()
    settings = get_settings()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(raw_refresh),
            expires_at=_utcnow() + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    db.commit()
    return {"access_token": access, "refresh_token": raw_refresh, "token_type": "bearer"}


def refresh_token_pair(db: Session, *, refresh_token: str) -> dict[str, str]:
    token_hash = hash_token(refresh_token)
    stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if not stored or stored.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    if stored.expires_at < _utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    user = db.get(User, stored.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    stored.revoked_at = _utcnow()
    return issue_token_pair(db, user)


def logout(db: Session, *, refresh_token: str, user_id: UUID) -> None:
    stored = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_token(refresh_token),
            RefreshToken.user_id == user_id,
        )
    )
    if stored and stored.revoked_at is None:
        stored.revoked_at = _utcnow()
        db.commit()


def verify_email(db: Session, *, token: str) -> None:
    stored = db.scalar(
        select(EmailVerificationToken).where(EmailVerificationToken.token_hash == hash_token(token))
    )
    if not stored or stored.used_at is not None or stored.expires_at < _utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    user = db.get(User, stored.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    user.is_email_verified = True
    stored.used_at = _utcnow()
    record_audit(db, action="user.email_verified", actor_user_id=user.id, resource_type="user", resource_id=str(user.id))
    db.commit()


def forgot_password(db: Session, *, email: str) -> str | None:
    """Always succeeds from the caller's perspective. Returns raw token only for console email backend."""
    user = db.scalar(select(User).where(User.email == email.lower()))
    if not user:
        return None

    raw = generate_raw_token()
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw),
            expires_at=_utcnow() + timedelta(hours=get_settings().password_reset_expire_hours),
        )
    )
    settings = get_settings()
    reset_link = f"{settings.frontend_url}/reset-password?token={raw}"
    send_email(
        to=user.email,
        subject="Reset your HireMatch AI password",
        body=f"Reset your password: {reset_link}\n\nIf you did not request this, ignore this message.",
    )
    record_audit(db, action="user.password_reset_requested", actor_user_id=user.id)
    db.commit()
    return raw if settings.email_backend == "console" else None


def reset_password(db: Session, *, token: str, new_password: str) -> None:
    stored = db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(token))
    )
    if not stored or stored.used_at is not None or stored.expires_at < _utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    user = db.get(User, stored.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    user.hashed_password = hash_password(new_password)
    stored.used_at = _utcnow()

    # Revoke all refresh tokens
    tokens = db.scalars(select(RefreshToken).where(RefreshToken.user_id == user.id)).all()
    for t in tokens:
        if t.revoked_at is None:
            t.revoked_at = _utcnow()

    record_audit(db, action="user.password_reset", actor_user_id=user.id)
    db.commit()
