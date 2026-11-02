import os
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault(
    "SECRET_KEY",
    "test-secret-key-hirematch-ai-phase1-32chars",
)
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg2://hirematch:hirematch@localhost:5432/hirematch_test",
)
os.environ.setdefault("EMAIL_BACKEND", "console")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")
# Force test env inside Compose (setdefault would keep container APP_ENV=development)
os.environ["APP_ENV"] = "test"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ.setdefault("TRUSTED_HOSTS", "*")
os.environ.setdefault("DEBUG", "true")
os.environ["RESUME_STORAGE_PATH"] = str(
    __import__("pathlib").Path(__file__).resolve().parent / "_resume_storage"
)
os.environ.setdefault("RESUME_MALWARE_SCANNER", "noop")
os.environ["CELERY_TASK_ALWAYS_EAGER"] = "true"

from app.core.config import get_settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models import SubscriptionPlan  # noqa: E402

get_settings.cache_clear()
settings = get_settings()

engine = create_engine(settings.database_url, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def prepare_database():
    from app.services.rbac_seed import seed_rbac_defaults

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestingSessionLocal() as db:
        if not db.query(SubscriptionPlan).filter_by(code="free").first():
            db.add(
                SubscriptionPlan(
                    id=uuid.uuid4(),
                    code="free",
                    name="Free",
                    description="Test free plan",
                    is_active=True,
                )
            )
            db.commit()
        seed_rbac_defaults(db)
    yield


@pytest.fixture()
def client():
    app = create_app()

    def _override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def unique_email():
    return f"user-{uuid.uuid4().hex[:10]}@example.com"
