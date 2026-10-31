import json
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import AuditEvent


def record_audit(
    db: Session,
    *,
    action: str,
    actor_user_id: UUID | None = None,
    organization_id: UUID | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    ip_address: str | None = None,
    metadata: dict | None = None,
) -> None:
    event = AuditEvent(
        action=action,
        actor_user_id=actor_user_id,
        organization_id=organization_id,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip_address,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    db.add(event)
