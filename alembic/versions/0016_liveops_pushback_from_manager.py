"""Allow push-back from any approval stage, including managers

Revision ID: 0016
Revises: 0015
Create Date: 2026-10-19

Changes:
- alter: liveops_tickets — add pushed_back_from column (wl|tl|lo|pe, nullable)
"""

from alembic import op
import sqlalchemy as sa

revision = '0016'
down_revision = '0015'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'liveops_tickets',
        sa.Column('pushed_back_from', sa.String(), nullable=True),
    )


def downgrade():
    op.drop_column('liveops_tickets', 'pushed_back_from')
