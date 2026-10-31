"""Seed platform admin + optional demo user."""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import MemberRole, User, UserProfile
from app.services.workspace import create_workspace

logger = logging.getLogger("hirematch")

# Platform super-admin (full console access)
ADMIN_EMAIL = "admin@hirematch.ai"
ADMIN_PASSWORD = "Admin@123"
ADMIN_NAME = "HireMatch Admin"

DEMO_EMAIL = "demo@hirematch.ai"
DEMO_PASSWORD = "DemoPass123!"
DEMO_NAME = "HireMatch Demo"


def _ensure_user(
    db: Session,
    *,
    email: str,
    password: str,
    full_name: str,
    headline: str,
    is_platform_admin: bool,
    workspace_name: str,
    slug_seed: str,
    role: MemberRole,
) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if user:
        user.hashed_password = hash_password(password)
        user.is_active = True
        user.is_email_verified = True
        user.is_platform_admin = is_platform_admin
        if user.profile:
            user.profile.full_name = full_name
            user.profile.headline = headline
        else:
            db.add(UserProfile(user_id=user.id, full_name=full_name, headline=headline))
        logger.info("Updated seeded user %s (platform_admin=%s)", email, is_platform_admin)
        return user

    user = User(
        email=email,
        hashed_password=hash_password(password),
        is_email_verified=True,
        is_active=True,
        is_platform_admin=is_platform_admin,
    )
    db.add(user)
    db.flush()
    db.add(UserProfile(user_id=user.id, full_name=full_name, headline=headline))
    create_workspace(
        db,
        name=workspace_name,
        owner_user_id=user.id,
        owner_role=role,
        is_personal=True,
        slug_seed=slug_seed,
    )
    logger.info("Created seeded user %s (platform_admin=%s)", email, is_platform_admin)
    return user


def seed_platform_admin() -> None:
    db = SessionLocal()
    try:
        _ensure_user(
            db,
            email=ADMIN_EMAIL,
            password=ADMIN_PASSWORD,
            full_name=ADMIN_NAME,
            headline="Platform administrator",
            is_platform_admin=True,
            workspace_name="HireMatch Platform",
            slug_seed="hirematch-platform",
            role=MemberRole.org_admin,
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to seed platform admin")
    finally:
        db.close()


def seed_demo_user() -> None:
    db = SessionLocal()
    try:
        _ensure_user(
            db,
            email=DEMO_EMAIL,
            password=DEMO_PASSWORD,
            full_name=DEMO_NAME,
            headline="Investor demo account",
            is_platform_admin=False,
            workspace_name="HireMatch Demo Workspace",
            slug_seed="hirematch-demo",
            role=MemberRole.org_admin,
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to seed demo user")
    finally:
        db.close()


def run_seeds(*, seed_admin: bool, seed_demo: bool) -> None:
    if seed_admin:
        seed_platform_admin()
    if seed_demo:
        seed_demo_user()
