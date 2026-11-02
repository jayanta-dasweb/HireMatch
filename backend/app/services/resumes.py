"""Org-scoped resume documents — upload, list, parse, soft-delete."""

from __future__ import annotations

import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.core.errors import bad_request, not_found
from app.models import ResumeDocument, ResumeStatus, ResumeVersion, User
from app.services import resume_parse, resume_storage
from app.services.audit import record_audit
from app.services.rbac import require_permission


def _latest_version(doc: ResumeDocument) -> ResumeVersion | None:
    if not doc.versions:
        return None
    return max(doc.versions, key=lambda v: v.version_number)


def document_to_dict(doc: ResumeDocument, *, include_versions: bool = False) -> dict:
    latest = _latest_version(doc)
    latest_out = None
    if latest:
        latest_out = {
            "id": latest.id,
            "version_number": latest.version_number,
            "byte_size": latest.byte_size,
            "sha256": latest.sha256,
            "extracted_text": latest.extracted_text,
            "parse_error": latest.parse_error,
            "created_at": latest.created_at,
        }
    base = {
        "id": doc.id,
        "organization_id": doc.organization_id,
        "uploaded_by_user_id": doc.uploaded_by_user_id,
        "title": doc.title,
        "original_filename": doc.original_filename,
        "content_type": doc.content_type,
        "status": doc.status,
        "is_active": doc.is_active,
        "created_at": doc.created_at,
        "updated_at": doc.updated_at,
        "latest_version": latest_out,
    }
    if include_versions:
        base["versions"] = [
            {
                "id": v.id,
                "version_number": v.version_number,
                "byte_size": v.byte_size,
                "sha256": v.sha256,
                "extracted_text": v.extracted_text,
                "parse_error": v.parse_error,
                "created_at": v.created_at,
            }
            for v in sorted(doc.versions, key=lambda x: x.version_number)
        ]
    return base


def _get_active_document(
    db: Session, *, organization_id: uuid.UUID, document_id: uuid.UUID
) -> ResumeDocument:
    doc = db.scalar(
        select(ResumeDocument)
        .options(joinedload(ResumeDocument.versions))
        .where(
            ResumeDocument.id == document_id,
            ResumeDocument.organization_id == organization_id,
            ResumeDocument.is_active.is_(True),
        )
    )
    if not doc:
        raise not_found("Resume not found")
    return doc


def list_resumes(db: Session, *, user: User, organization_id: uuid.UUID) -> list[ResumeDocument]:
    require_permission(db, user=user, organization_id=organization_id, code="resumes.view")
    return list(
        db.scalars(
            select(ResumeDocument)
            .options(joinedload(ResumeDocument.versions))
            .where(
                ResumeDocument.organization_id == organization_id,
                ResumeDocument.is_active.is_(True),
            )
            .order_by(ResumeDocument.created_at.desc())
        )
        .unique()
        .all()
    )


def get_resume(
    db: Session, *, user: User, organization_id: uuid.UUID, document_id: uuid.UUID
) -> ResumeDocument:
    require_permission(db, user=user, organization_id=organization_id, code="resumes.view")
    return _get_active_document(db, organization_id=organization_id, document_id=document_id)


def create_resume(
    db: Session,
    *,
    user: User,
    organization_id: uuid.UUID,
    filename: str,
    content_type: str,
    data: bytes,
    title: str | None = None,
) -> ResumeDocument:
    require_permission(db, user=user, organization_id=organization_id, code="resumes.create")
    settings = get_settings()

    if not data:
        raise bad_request("Empty file")
    if len(data) > settings.resume_max_bytes:
        raise bad_request(f"File too large (max {settings.resume_max_bytes} bytes)")

    name = (filename or "resume").strip() or "resume"
    ext = Path(name).suffix.lower()
    ctype = (content_type or "").split(";")[0].strip().lower()

    if ext not in resume_storage.ALLOWED_EXTENSIONS and ctype not in resume_storage.ALLOWED_CONTENT_TYPES:
        raise bad_request("Only PDF and DOCX resumes are supported")

    if ctype not in resume_storage.ALLOWED_CONTENT_TYPES:
        # Infer from extension when browser sends octet-stream
        if ext == ".pdf":
            ctype = "application/pdf"
        elif ext == ".docx":
            ctype = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        else:
            raise bad_request("Only PDF and DOCX resumes are supported")
    else:
        if ext not in resume_storage.ALLOWED_EXTENSIONS:
            ext = resume_storage.ALLOWED_CONTENT_TYPES[ctype]

    display_title = (title or Path(name).stem or "Resume").strip()[:200]

    doc = ResumeDocument(
        organization_id=organization_id,
        uploaded_by_user_id=user.id,
        title=display_title,
        original_filename=name[:255],
        content_type=ctype,
        status=ResumeStatus.processing,
        is_active=True,
    )
    db.add(doc)
    db.flush()

    version_number = 1
    storage_key = resume_storage.build_storage_key(
        organization_id=organization_id,
        document_id=doc.id,
        version=version_number,
        ext=ext,
    )
    byte_size, sha256 = resume_storage.save_bytes(storage_key=storage_key, data=data)

    extracted: str | None = None
    parse_error: str | None = None
    try:
        extracted = resume_parse.extract_text(data=data, content_type=ctype, filename=name)
        doc.status = ResumeStatus.ready
    except Exception as exc:  # noqa: BLE001 — surface honest parse failures
        parse_error = str(exc)[:2000]
        doc.status = ResumeStatus.failed

    version = ResumeVersion(
        document_id=doc.id,
        version_number=version_number,
        storage_key=storage_key,
        byte_size=byte_size,
        sha256=sha256,
        extracted_text=extracted,
        parse_error=parse_error,
    )
    db.add(version)
    record_audit(
        db,
        action="resume.uploaded",
        actor_user_id=user.id,
        organization_id=organization_id,
        resource_type="resume_document",
        resource_id=str(doc.id),
        metadata={"filename": name, "status": doc.status.value, "byte_size": byte_size},
    )
    db.commit()
    return _get_active_document(db, organization_id=organization_id, document_id=doc.id)


def update_resume(
    db: Session,
    *,
    user: User,
    organization_id: uuid.UUID,
    document_id: uuid.UUID,
    title: str | None,
) -> ResumeDocument:
    require_permission(db, user=user, organization_id=organization_id, code="resumes.edit")
    doc = _get_active_document(db, organization_id=organization_id, document_id=document_id)
    if title is not None:
        doc.title = title.strip()[:200]
    record_audit(
        db,
        action="resume.updated",
        actor_user_id=user.id,
        organization_id=organization_id,
        resource_type="resume_document",
        resource_id=str(doc.id),
    )
    db.commit()
    return _get_active_document(db, organization_id=organization_id, document_id=doc.id)


def soft_delete_resume(
    db: Session, *, user: User, organization_id: uuid.UUID, document_id: uuid.UUID
) -> None:
    require_permission(db, user=user, organization_id=organization_id, code="resumes.delete")
    doc = _get_active_document(db, organization_id=organization_id, document_id=document_id)
    doc.is_active = False
    record_audit(
        db,
        action="resume.deleted",
        actor_user_id=user.id,
        organization_id=organization_id,
        resource_type="resume_document",
        resource_id=str(doc.id),
    )
    db.commit()


def download_resume(
    db: Session, *, user: User, organization_id: uuid.UUID, document_id: uuid.UUID
) -> tuple[ResumeDocument, ResumeVersion, bytes]:
    require_permission(db, user=user, organization_id=organization_id, code="resumes.view")
    doc = _get_active_document(db, organization_id=organization_id, document_id=document_id)
    latest = _latest_version(doc)
    if not latest:
        raise not_found("Resume file not found")
    try:
        data = resume_storage.read_bytes(latest.storage_key)
    except FileNotFoundError as exc:
        raise not_found("Resume file not found") from exc
    return doc, latest, data
