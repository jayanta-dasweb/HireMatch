"""Org-scoped resume structured extraction read/review."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import bad_request, not_found
from app.models import ExtractionStatus, ResumeDocument, ResumeExtraction, User
from app.services.audit import record_audit
from app.services.rbac import require_permission


def extraction_to_dict(row: ResumeExtraction) -> dict:
    return {
        "id": row.id,
        "document_id": row.document_id,
        "version_id": row.version_id,
        "organization_id": row.organization_id,
        "status": row.status,
        "payload": row.payload or {},
        "reviewed_payload": row.reviewed_payload,
        "extractor": row.extractor,
        "error": row.error,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "effective_payload": row.reviewed_payload if row.reviewed_payload is not None else (row.payload or {}),
    }


def _require_active_doc(
    db: Session, *, organization_id: uuid.UUID, document_id: uuid.UUID
) -> ResumeDocument:
    doc = db.scalar(
        select(ResumeDocument).where(
            ResumeDocument.id == document_id,
            ResumeDocument.organization_id == organization_id,
            ResumeDocument.is_active.is_(True),
        )
    )
    if not doc:
        raise not_found("Resume not found")
    return doc


def get_extraction(
    db: Session, *, user: User, organization_id: uuid.UUID, document_id: uuid.UUID
) -> ResumeExtraction:
    require_permission(db, user=user, organization_id=organization_id, code="resumes.view")
    _require_active_doc(db, organization_id=organization_id, document_id=document_id)
    row = db.scalar(
        select(ResumeExtraction).where(
            ResumeExtraction.document_id == document_id,
            ResumeExtraction.organization_id == organization_id,
        )
    )
    if not row:
        raise not_found("Extraction not found")
    return row


def save_review(
    db: Session,
    *,
    user: User,
    organization_id: uuid.UUID,
    document_id: uuid.UUID,
    reviewed_payload: dict,
) -> ResumeExtraction:
    require_permission(db, user=user, organization_id=organization_id, code="resumes.edit")
    _require_active_doc(db, organization_id=organization_id, document_id=document_id)
    row = db.scalar(
        select(ResumeExtraction).where(
            ResumeExtraction.document_id == document_id,
            ResumeExtraction.organization_id == organization_id,
        )
    )
    if not row:
        raise not_found("Extraction not found")
    if not isinstance(reviewed_payload, dict):
        raise bad_request("reviewed_payload must be an object")
    row.reviewed_payload = reviewed_payload
    row.status = ExtractionStatus.reviewed
    record_audit(
        db,
        action="resume.extraction_reviewed",
        actor_user_id=user.id,
        organization_id=organization_id,
        resource_type="resume_extraction",
        resource_id=str(row.id),
    )
    db.commit()
    db.refresh(row)
    return row


def upsert_extraction(
    db: Session,
    *,
    document: ResumeDocument,
    version_id: uuid.UUID,
    payload: dict,
    status: ExtractionStatus = ExtractionStatus.ready,
    error: str | None = None,
    extractor: str = "local_v1",
) -> ResumeExtraction:
    row = db.scalar(select(ResumeExtraction).where(ResumeExtraction.document_id == document.id))
    if row is None:
        row = ResumeExtraction(
            document_id=document.id,
            version_id=version_id,
            organization_id=document.organization_id,
            status=status,
            payload=payload,
            reviewed_payload=None,
            extractor=extractor,
            error=error,
        )
        db.add(row)
    else:
        row.version_id = version_id
        row.status = status
        row.payload = payload
        row.reviewed_payload = None
        row.extractor = extractor
        row.error = error
    return row
