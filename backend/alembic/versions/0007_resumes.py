"""Resume documents and versions

Revision ID: 0007_resumes
Revises: 0006_org_profile
Create Date: 2026-11-02
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_resumes"
down_revision: Union[str, None] = "0006_org_profile"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    resume_status = postgresql.ENUM(
        "uploaded",
        "processing",
        "ready",
        "failed",
        name="resume_status",
        create_type=False,
    )
    resume_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "resume_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "uploaded_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(
                "uploaded",
                "processing",
                "ready",
                "failed",
                name="resume_status",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_resume_documents_organization_id", "resume_documents", ["organization_id"])
    op.create_index("ix_resume_documents_uploaded_by_user_id", "resume_documents", ["uploaded_by_user_id"])

    op.create_table(
        "resume_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("resume_documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("byte_size", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("parse_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_resume_versions_document_id", "resume_versions", ["document_id"])


def downgrade() -> None:
    op.drop_index("ix_resume_versions_document_id", table_name="resume_versions")
    op.drop_table("resume_versions")
    op.drop_index("ix_resume_documents_uploaded_by_user_id", table_name="resume_documents")
    op.drop_index("ix_resume_documents_organization_id", table_name="resume_documents")
    op.drop_table("resume_documents")
    op.execute("DROP TYPE IF EXISTS resume_status")
