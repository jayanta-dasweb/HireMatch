import re
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Organization


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value[:80] or "workspace"


def unique_org_slug(db: Session, seed: str) -> str:
    base = slugify(seed)
    candidate = base
    while db.scalar(select(Organization.id).where(Organization.slug == candidate)):
        candidate = f"{base}-{secrets.token_hex(3)}"
    return candidate
