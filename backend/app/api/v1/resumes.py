from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.resume import (
    ResumeDocumentDetailOut,
    ResumeDocumentOut,
    ResumeExtractionOut,
    ResumeExtractionReview,
    ResumeUpdate,
)
from app.services import resume_extractions as extraction_svc
from app.services import resumes as resume_svc

router = APIRouter(prefix="/organizations/{org_id}/resumes", tags=["resumes"])


@router.get("", response_model=list[ResumeDocumentOut])
def list_resumes(
    org_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = resume_svc.list_resumes(db, user=user, organization_id=org_id)
    return [ResumeDocumentOut(**resume_svc.document_to_dict(r)) for r in rows]


@router.post("", response_model=ResumeDocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    org_id: UUID,
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = await file.read()
    doc = resume_svc.create_resume(
        db,
        user=user,
        organization_id=org_id,
        filename=file.filename or "resume.pdf",
        content_type=file.content_type or "application/octet-stream",
        data=data,
        title=title,
    )
    return ResumeDocumentOut(**resume_svc.document_to_dict(doc))


@router.get("/{document_id}", response_model=ResumeDocumentDetailOut)
def get_resume(
    org_id: UUID,
    document_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = resume_svc.get_resume(db, user=user, organization_id=org_id, document_id=document_id)
    return ResumeDocumentDetailOut(**resume_svc.document_to_dict(doc, include_versions=True))


@router.patch("/{document_id}", response_model=ResumeDocumentOut)
def update_resume(
    org_id: UUID,
    document_id: UUID,
    payload: ResumeUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = resume_svc.update_resume(
        db,
        user=user,
        organization_id=org_id,
        document_id=document_id,
        title=payload.title,
    )
    return ResumeDocumentOut(**resume_svc.document_to_dict(doc))


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resume(
    org_id: UUID,
    document_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resume_svc.soft_delete_resume(db, user=user, organization_id=org_id, document_id=document_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{document_id}/download")
def download_resume(
    org_id: UUID,
    document_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc, _version, data = resume_svc.download_resume(
        db, user=user, organization_id=org_id, document_id=document_id
    )
    headers = {
        "Content-Disposition": f'attachment; filename="{doc.original_filename}"',
    }
    return Response(content=data, media_type=doc.content_type, headers=headers)


@router.get("/{document_id}/extraction", response_model=ResumeExtractionOut)
def get_extraction(
    org_id: UUID,
    document_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = extraction_svc.get_extraction(
        db, user=user, organization_id=org_id, document_id=document_id
    )
    return ResumeExtractionOut(**extraction_svc.extraction_to_dict(row))


@router.patch("/{document_id}/extraction", response_model=ResumeExtractionOut)
def review_extraction(
    org_id: UUID,
    document_id: UUID,
    payload: ResumeExtractionReview,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = extraction_svc.save_review(
        db,
        user=user,
        organization_id=org_id,
        document_id=document_id,
        reviewed_payload=payload.reviewed_payload,
    )
    return ResumeExtractionOut(**extraction_svc.extraction_to_dict(row))
