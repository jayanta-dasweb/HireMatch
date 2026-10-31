"""Organization company profile fields

Revision ID: 0006_org_profile
Revises: 0005_user_perms
Create Date: 2026-10-31
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_org_profile"
down_revision: Union[str, None] = "0005_user_perms"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("legal_name", sa.String(length=200), nullable=True))
    op.add_column("organizations", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("organizations", sa.Column("industry", sa.String(length=120), nullable=True))
    op.add_column("organizations", sa.Column("company_size", sa.String(length=40), nullable=True))
    op.add_column("organizations", sa.Column("website", sa.String(length=300), nullable=True))
    op.add_column("organizations", sa.Column("contact_email", sa.String(length=320), nullable=True))
    op.add_column("organizations", sa.Column("contact_phone", sa.String(length=40), nullable=True))
    op.add_column("organizations", sa.Column("country", sa.String(length=100), nullable=True))
    op.add_column("organizations", sa.Column("city", sa.String(length=120), nullable=True))
    op.add_column("organizations", sa.Column("address_line", sa.String(length=300), nullable=True))


def downgrade() -> None:
    op.drop_column("organizations", "address_line")
    op.drop_column("organizations", "city")
    op.drop_column("organizations", "country")
    op.drop_column("organizations", "contact_phone")
    op.drop_column("organizations", "contact_email")
    op.drop_column("organizations", "website")
    op.drop_column("organizations", "company_size")
    op.drop_column("organizations", "industry")
    op.drop_column("organizations", "description")
    op.drop_column("organizations", "legal_name")
