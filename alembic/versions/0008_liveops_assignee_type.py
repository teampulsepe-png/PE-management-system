"""Add assignee_type to liveops_ticket_types

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-03

Changes:
- alter: liveops_ticket_types — add assignee_type column
  ('platform_engineer' | 'liveops_engineer', default 'platform_engineer')
"""

from alembic import op
import sqlalchemy as sa

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'liveops_ticket_types',
        sa.Column('assignee_type', sa.String(), nullable=False, server_default='platform_engineer'),
    )


def downgrade():
    op.drop_column('liveops_ticket_types', 'assignee_type')
