"""Add pending_review status to liveops_tickets

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-09
"""

from alembic import op

revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint('liveops_tickets_status_check', 'liveops_tickets', type_='check')
    op.create_check_constraint(
        'liveops_tickets_status_check',
        'liveops_tickets',
        "status IN ('draft','pending_wl','pending_tl','pending_lo','open','in_progress',"
        "'completed','rejected','cancelled','on_hold','pending_review')",
    )


def downgrade():
    op.drop_constraint('liveops_tickets_status_check', 'liveops_tickets', type_='check')
    op.create_check_constraint(
        'liveops_tickets_status_check',
        'liveops_tickets',
        "status IN ('draft','pending_wl','pending_tl','pending_lo','open','in_progress',"
        "'completed','rejected','cancelled','on_hold')",
    )
