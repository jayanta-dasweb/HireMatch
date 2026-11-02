"""Celery tasks for resume processing."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.db.session import SessionLocal
from app.models import ResumeDocument, ResumeStatus, ResumeVersion
from app.services import malware_scan, resume_parse, resume_storage
from app.workers.celery_app import celery

logger = logging.getLogger(__name__)


@celery.task(name="resumes.process_version", bind=True, max_retries=2)
def process_resume_version(self, document_id: str, version_id: str) -> dict:
    """Malware scan hook then plain-text extract; update document status."""
    doc_uuid = uuid.UUID(document_id)
    ver_uuid = uuid.UUID(version_id)

    db = SessionLocal()
    try:
        doc = db.scalar(
            select(ResumeDocument)
            .options(joinedload(ResumeDocument.versions))
            .where(ResumeDocument.id == doc_uuid)
        )
        version = db.get(ResumeVersion, ver_uuid)
        if not doc or not version or version.document_id != doc.id:
            logger.warning("Resume task missing doc/version %s %s", document_id, version_id)
            return {"ok": False, "reason": "not_found"}

        try:
            data = resume_storage.read_bytes(version.storage_key)
        except FileNotFoundError:
            doc.status = ResumeStatus.failed
            version.parse_error = "Stored file missing"
            version.extracted_text = None
            db.commit()
            return {"ok": False, "reason": "file_missing"}

        scan = malware_scan.scan_bytes(
            data=data,
            filename=doc.original_filename,
            content_type=doc.content_type,
        )
        if not scan.ok:
            doc.status = ResumeStatus.failed
            version.parse_error = (scan.detail or "Malware scan rejected file")[:2000]
            version.extracted_text = None
            db.commit()
            return {"ok": False, "reason": "malware_rejected"}

        try:
            text = resume_parse.extract_text(
                data=data,
                content_type=doc.content_type,
                filename=doc.original_filename,
            )
            version.extracted_text = text
            version.parse_error = None
            doc.status = ResumeStatus.ready
            db.commit()
            return {"ok": True, "status": "ready"}
        except Exception as exc:  # noqa: BLE001 — honest parse failures
            version.extracted_text = None
            version.parse_error = str(exc).replace("\x00", "")[:2000]
            doc.status = ResumeStatus.failed
            db.commit()
            return {"ok": False, "reason": "parse_failed"}
    finally:
        db.close()
