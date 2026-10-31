"""User special/direct permissions

Revision ID: 0005_user_perms
Revises: 0004_perm_groups
Create Date: 2026-10-31
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_user_perms"
down_revision: Union[str, None] = "0004_perm_groups"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "user_permissions" not in inspector.get_table_names():
        op.create_table(
            "user_permissions",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "organization_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("organizations.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "permission_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("permissions.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "created_by_user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.UniqueConstraint(
                "user_id", "organization_id", "permission_id", name="uq_user_org_permission"
            ),
        )
    inspector = sa.inspect(bind)
    existing = {idx["name"] for idx in inspector.get_indexes("user_permissions")}
    if "ix_user_permissions_user_id" not in existing:
        op.create_index("ix_user_permissions_user_id", "user_permissions", ["user_id"])
    if "ix_user_permissions_organization_id" not in existing:
        op.create_index(
            "ix_user_permissions_organization_id", "user_permissions", ["organization_id"]
        )
    if "ix_user_permissions_permission_id" not in existing:
        op.create_index(
            "ix_user_permissions_permission_id", "user_permissions", ["permission_id"]
        )


def downgrade() -> None:
    op.drop_table("user_permissions")
