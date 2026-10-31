"""Permission groups master

Revision ID: 0004_perm_groups
Revises: 0003_rbac_meta
Create Date: 2026-10-31
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_perm_groups"
down_revision: Union[str, None] = "0003_rbac_meta"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "permission_groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_permission_groups_slug", "permission_groups", ["slug"])

    op.add_column(
        "permissions",
        sa.Column("group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("permission_groups.id", ondelete="RESTRICT"), nullable=True),
    )
    op.create_index("ix_permissions_group_id", "permissions", ["group_id"])

    # Backfill groups from existing permission.group strings
    op.execute(
        """
        INSERT INTO permission_groups (id, slug, name, description, is_active, created_at, updated_at)
        SELECT gen_random_uuid(), g.slug, initcap(replace(g.slug, '_', ' ')), NULL, true, now(), now()
        FROM (SELECT DISTINCT "group" AS slug FROM permissions WHERE "group" IS NOT NULL AND "group" <> '') g
        ON CONFLICT (slug) DO NOTHING
        """
    )
    op.execute(
        """
        UPDATE permissions p
        SET group_id = pg.id
        FROM permission_groups pg
        WHERE pg.slug = p."group"
        """
    )
    # Ensure general exists and catch any nulls
    op.execute(
        """
        INSERT INTO permission_groups (id, slug, name, is_active, created_at, updated_at)
        SELECT gen_random_uuid(), 'general', 'General', true, now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM permission_groups WHERE slug = 'general')
        """
    )
    op.execute(
        """
        UPDATE permissions
        SET group_id = (SELECT id FROM permission_groups WHERE slug = 'general' LIMIT 1)
        WHERE group_id IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_permissions_group_id", table_name="permissions")
    op.drop_column("permissions", "group_id")
    op.drop_table("permission_groups")
