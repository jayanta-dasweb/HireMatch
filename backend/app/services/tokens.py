"""Shared token create / lookup helpers."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import generate_raw_token, hash_token
from app.core.timeutil import expires_in, utcnow


def new_raw_token() -> tuple[str, str]:
    """Return (raw_token_for_email, hash_for_database)."""
    raw = generate_raw_token()
    return raw, hash_token(raw)


def token_hash(raw: str) -> str:
    return hash_token(raw)


def make_expiry(*, hours: int = 0, days: int = 0) -> datetime:
    return expires_in(hours=hours, days=days)


def find_by_hash(db: Session, model, raw: str):
    return db.scalar(select(model).where(model.token_hash == hash_token(raw)))


def still_valid(row) -> bool:
    if row is None:
        return False
    if getattr(row, "used_at", None) is not None:
        return False
    if getattr(row, "revoked_at", None) is not None:
        return False
    return row.expires_at >= utcnow()


def mark_used(row) -> None:
    row.used_at = utcnow()


def mark_revoked(row) -> None:
    row.revoked_at = utcnow()


def revoke_all_refresh(db: Session, model, *, user_id: UUID) -> None:
    now = utcnow()
    for row in db.scalars(select(model).where(model.user_id == user_id)).all():
        if row.revoked_at is None:
            row.revoked_at = now
