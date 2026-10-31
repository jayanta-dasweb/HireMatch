from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.deps import require_platform_admin
from app.db.session import get_db
from app.models import Organization, User
from app.schemas.organization import OrganizationOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/organizations", response_model=list[OrganizationOut])
def admin_list_organizations(
    _: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    """Metadata only — no resume or candidate content access."""
    return list(db.scalars(select(Organization).order_by(Organization.created_at.desc()).limit(200)).all())


@router.get("/system-health")
def admin_system_health(
    _: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    db.execute(text("SELECT 1"))
    org_count = db.scalar(select(func.count()).select_from(Organization)) or 0
    user_count = db.scalar(select(func.count()).select_from(User)) or 0
    return {
        "status": "ok",
        "database": "up",
        "organization_count": org_count,
        "user_count": user_count,
        "background_workers": "not_configured_until_phase_2",
    }
