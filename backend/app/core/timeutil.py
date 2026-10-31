from datetime import datetime, timedelta, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def expires_in(*, hours: int = 0, days: int = 0) -> datetime:
    return utcnow() + timedelta(hours=hours, days=days)
