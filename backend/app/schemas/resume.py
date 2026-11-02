from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import ResumeStatus


class ResumeVersionOut(BaseModel):
    id: UUID
    version_number: int
    byte_size: int
    sha256: str
    extracted_text: str | None = None
    parse_error: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ResumeDocumentOut(BaseModel):
    id: UUID
    organization_id: UUID
    uploaded_by_user_id: UUID | None
    title: str
    original_filename: str
    content_type: str
    status: ResumeStatus
    is_active: bool
    created_at: datetime
    updated_at: datetime
    latest_version: ResumeVersionOut | None = None

    model_config = {"from_attributes": True}


class ResumeDocumentDetailOut(ResumeDocumentOut):
    versions: list[ResumeVersionOut] = Field(default_factory=list)


class ResumeUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
