from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def liveness():
    """Process is up — does not check dependencies (for orchestrator liveness)."""
    return {"status": "ok", "service": "hirematch-api"}


@router.get("/ready")
def readiness(response: Response, db: Session = Depends(get_db)):
    """Ready to serve traffic — verifies database connectivity."""
    settings = get_settings()
    try:
        db.execute(text("SELECT 1"))
        db_status = "up"
        code = status.HTTP_200_OK
        overall = "ready"
    except Exception:
        db_status = "down"
        code = status.HTTP_503_SERVICE_UNAVAILABLE
        overall = "not_ready"

    response.status_code = code
    return {
        "status": overall,
        "service": "hirematch-api",
        "environment": settings.app_env,
        "checks": {"database": db_status},
    }
