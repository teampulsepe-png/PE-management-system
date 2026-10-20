"""Split LO/PE ticketing: add assignee_type and PE approval stage

Revision ID: 0015
Revises: 0014
Create Date: 2026-10-19

Changes:
- alter: liveops_tickets — add assignee_type column ('lo' | 'pe', default 'lo')
- alter: liveops_tickets — add pe_status, pe_actor_id, pe_acted_at, pe_reason columns
- alter: liveops_tickets — update status check constraint to include 'pending_pe'
"""

from alembic import op
import sqlalchemy as sa

revision = '0015'
down_revision = '0014'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('liveops_tickets', sa.Column('assignee_type', sa.String(), nullable=False, server_default='lo'))
    op.add_column('liveops_tickets', sa.Column('pe_status',   sa.String(),                  nullable=False, server_default='pending'))
    op.add_column('liveops_tickets', sa.Column('pe_actor_id', sa.String(),                  nullable=True))
    op.add_column('liveops_tickets', sa.Column('pe_acted_at', sa.TIMESTAMP(timezone=True),  nullable=True))
    op.add_column('liveops_tickets', sa.Column('pe_reason',   sa.Text(),                    nullable=True))

    op.create_foreign_key(
        'liveops_tickets_pe_actor_id_fkey',
        'liveops_tickets', 'team_members',
        ['pe_actor_id'], ['id'],
        ondelete='SET NULL',
    )

    op.create_check_constraint(
        'liveops_tickets_assignee_type_check',
        'liveops_tickets',
        "assignee_type IN ('lo', 'pe')",
    )

    op.drop_constraint('liveops_tickets_status_check', 'liveops_tickets', type_='check')
    op.create_check_constraint(
        'liveops_tickets_status_check',
        'liveops_tickets',
        "status IN ('draft','pending_wl','pending_tl','pending_lo','pending_pe','open',"
        "'in_progress','completed','rejected','cancelled','on_hold','pending_review')",
    )


def downgrade():
    op.drop_constraint('liveops_tickets_status_check', 'liveops_tickets', type_='check')
    op.create_check_constraint(
        'liveops_tickets_status_check',
        'liveops_tickets',
        "status IN ('draft','pending_wl','pending_tl','pending_lo','open','in_progress',"
        "'completed','rejected','cancelled','on_hold','pending_review')",
    )

    op.drop_constraint('liveops_tickets_assignee_type_check', 'liveops_tickets', type_='check')
    op.drop_constraint('liveops_tickets_pe_actor_id_fkey', 'liveops_tickets', type_='foreignkey')

    op.drop_column('liveops_tickets', 'pe_reason')
    op.drop_column('liveops_tickets', 'pe_acted_at')
    op.drop_column('liveops_tickets', 'pe_actor_id')
    op.drop_column('liveops_tickets', 'pe_status')
    op.drop_column('liveops_tickets', 'assignee_type')
