"""Optional demo user for investor / pitch demos."""

import logging

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import MemberRole, User, UserProfile
from app.services.workspace import create_workspace

logger = logging.getLogger("hirematch")

DEMO_EMAIL = "demo@hirematch.ai"
DEMO_PASSWORD = "DemoPass123!"
DEMO_NAME = "HireMatch Demo"


def seed_demo_user() -> None:
    db = SessionLocal()
    try:
        existing = db.scalar(select(User).where(User.email == DEMO_EMAIL))
        if existing:
            logger.info("Demo user already exists: %s", DEMO_EMAIL)
            return

        user = User(
            email=DEMO_EMAIL,
            hashed_password=hash_password(DEMO_PASSWORD),
            is_email_verified=True,
            is_active=True,
        )
        db.add(user)
        db.flush()
        db.add(UserProfile(user_id=user.id, full_name=DEMO_NAME, headline="Investor demo account"))
        create_workspace(
            db,
            name="HireMatch Demo Workspace",
            owner_user_id=user.id,
            owner_role=MemberRole.org_admin,
            is_personal=True,
            slug_seed="hirematch-demo",
        )
        db.commit()
        logger.info("Seeded demo user %s", DEMO_EMAIL)
    except Exception:
        db.rollback()
        logger.exception("Failed to seed demo user")
    finally:
        db.close()
