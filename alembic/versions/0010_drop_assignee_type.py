"""Drop assignee_type from liveops_ticket_types

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-03

Changes:
- alter: liveops_ticket_types — drop assignee_type column
"""

from alembic import op

revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column('liveops_ticket_types', 'assignee_type')


def downgrade():
    import sqlalchemy as sa
    op.add_column(
        'liveops_ticket_types',
        sa.Column('assignee_type', sa.String(), nullable=False, server_default='platform_engineer'),
    )
