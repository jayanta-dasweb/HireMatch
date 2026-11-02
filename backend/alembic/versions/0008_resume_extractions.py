"""Resume structured extractions

Revision ID: 0008_resume_extractions
Revises: 0007_resumes
Create Date: 2026-11-02
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008_resume_extractions"
down_revision: Union[str, None] = "0007_resumes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    extraction_status = postgresql.ENUM(
        "pending",
        "ready",
        "failed",
        "reviewed",
        name="extraction_status",
        create_type=False,
    )
    extraction_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "resume_extractions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("resume_documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("resume_versions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "pending",
                "ready",
                "failed",
                "reviewed",
                name="extraction_status",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("reviewed_payload", postgresql.JSONB(), nullable=True),
        sa.Column("extractor", sa.String(length=40), nullable=False, server_default="local_v1"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("document_id", name="uq_resume_extractions_document_id"),
    )
    op.create_index("ix_resume_extractions_document_id", "resume_extractions", ["document_id"])
    op.create_index("ix_resume_extractions_version_id", "resume_extractions", ["version_id"])
    op.create_index("ix_resume_extractions_organization_id", "resume_extractions", ["organization_id"])


def downgrade() -> None:
    op.drop_index("ix_resume_extractions_organization_id", table_name="resume_extractions")
    op.drop_index("ix_resume_extractions_version_id", table_name="resume_extractions")
    op.drop_index("ix_resume_extractions_document_id", table_name="resume_extractions")
    op.drop_table("resume_extractions")
    op.execute("DROP TYPE IF EXISTS extraction_status")
