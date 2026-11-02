"""Celery tasks for resume processing."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.db.session import SessionLocal
from app.models import ExtractionStatus, ResumeDocument, ResumeStatus, ResumeVersion
from app.services import malware_scan, resume_analysis, resume_llm, resume_parse, resume_storage
from app.services.resume_extractions import upsert_extraction
from app.workers.celery_app import celery

logger = logging.getLogger(__name__)


@celery.task(
    name="resumes.process_version",
    bind=True,
    max_retries=2,
    soft_time_limit=240,
    time_limit=300,
)
def process_resume_version(self, document_id: str, version_id: str) -> dict:
    """Malware scan → text extract → heuristic analysis (commit ready) → optional timed LLM enrich."""
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
        except Exception as exc:  # noqa: BLE001 — honest parse failures
            version.extracted_text = None
            version.parse_error = str(exc).replace("\x00", "")[:2000]
            doc.status = ResumeStatus.failed
            db.commit()
            return {"ok": False, "reason": "parse_failed"}

        # 1) Always persist heuristic analysis quickly so UI leaves "processing"
        try:
            payload = resume_analysis.analyze_resume(text)
            upsert_extraction(
                db,
                document=doc,
                version_id=version.id,
                payload=payload,
                status=ExtractionStatus.ready,
                error=None,
                extractor=resume_analysis.ANALYZER_ID,
            )
        except Exception as exc:  # noqa: BLE001
            upsert_extraction(
                db,
                document=doc,
                version_id=version.id,
                payload={
                    "extractor": resume_analysis.ANALYZER_ID,
                    "analyzer": resume_analysis.ANALYZER_ID,
                    "contact": {},
                    "skills": [],
                    "experience_sections": [],
                    "education_sections": [],
                    "findings": [],
                    "ats": {"score": 0, "checks": [], "passed": 0, "total": 0},
                },
                status=ExtractionStatus.failed,
                error=str(exc).replace("\x00", "")[:2000],
                extractor=resume_analysis.ANALYZER_ID,
            )
            logger.exception("Resume analysis failed for %s", document_id)
            db.commit()
            return {"ok": True, "status": doc.status.value, "llm": False}

        db.commit()

        # 2) Optional embedded LLM enrich (timed). Never block "ready" status.
        try:
            enriched = resume_llm.enrich_with_local_llm(text, payload)
            if enriched.get("llm", {}).get("used"):
                db2 = SessionLocal()
                try:
                    doc2 = db2.get(ResumeDocument, doc_uuid)
                    if doc2:
                        upsert_extraction(
                            db2,
                            document=doc2,
                            version_id=ver_uuid,
                            payload=enriched,
                            status=ExtractionStatus.ready,
                            error=None,
                            extractor=str(enriched.get("extractor") or resume_analysis.ANALYZER_ID),
                        )
                        db2.commit()
                finally:
                    db2.close()
                return {"ok": True, "status": "ready", "llm": True}
            logger.info(
                "LLM enrich skipped for %s: %s",
                document_id,
                (enriched.get("llm") or {}).get("detail"),
            )
        except Exception:  # noqa: BLE001
            logger.exception("Embedded LLM enrich failed for %s; heuristic kept", document_id)

        return {"ok": True, "status": "ready", "llm": False}
    finally:
        db.close()
