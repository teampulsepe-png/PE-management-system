"""Add LiveOps ticketing tables

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-01
"""
from alembic import op
import sqlalchemy as sa

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = inspector.get_table_names()

    if 'liveops_business_units' not in existing:
        op.create_table(
            'liveops_business_units',
            sa.Column('id',         sa.String(),  primary_key=True),
            sa.Column('name',       sa.String(),  nullable=False, unique=True),
            sa.Column('is_active',  sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if 'liveops_ticket_types' not in existing:
        op.create_table(
            'liveops_ticket_types',
            sa.Column('id',         sa.String(),  primary_key=True),
            sa.Column('name',       sa.String(),  nullable=False, unique=True),
            sa.Column('guide_text', sa.Text(),    nullable=True),
            sa.Column('is_active',  sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if 'liveops_use_cases' not in existing:
        op.create_table(
            'liveops_use_cases',
            sa.Column('id',               sa.String(),  primary_key=True),
            sa.Column('business_unit_id', sa.String(),  sa.ForeignKey('liveops_business_units.id', ondelete='RESTRICT'), nullable=False),
            sa.Column('name',             sa.String(),  nullable=False),
            sa.Column('is_active',        sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_at',       sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint('business_unit_id', 'name', name='liveops_use_cases_unique'),
        )

    if 'liveops_approver_configs' not in existing:
        op.create_table(
            'liveops_approver_configs',
            sa.Column('id',               sa.String(), primary_key=True),
            sa.Column('ticket_type_id',   sa.String(), sa.ForeignKey('liveops_ticket_types.id',   ondelete='CASCADE'),  nullable=False),
            sa.Column('business_unit_id', sa.String(), sa.ForeignKey('liveops_business_units.id', ondelete='CASCADE'),  nullable=False),
            sa.Column('practice_lead_id', sa.String(), sa.ForeignKey('team_members.id',           ondelete='SET NULL'), nullable=True),
            sa.Column('delivery_lead_id', sa.String(), sa.ForeignKey('team_members.id',           ondelete='SET NULL'), nullable=True),
            sa.Column('created_at',       sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint('ticket_type_id', 'business_unit_id', name='liveops_approver_configs_unique'),
        )

    if 'liveops_member_roles' not in existing:
        op.create_table(
            'liveops_member_roles',
            sa.Column('id',         sa.String(), primary_key=True),
            sa.Column('member_id',  sa.String(), sa.ForeignKey('team_members.id', ondelete='CASCADE'), nullable=False),
            sa.Column('role',       sa.String(), nullable=False),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint('member_id', 'role', name='liveops_member_roles_unique'),
            sa.CheckConstraint("role IN ('practice_lead','delivery_lead','lo_manager','lo_team')", name='liveops_member_roles_role_check'),
        )

    if 'liveops_sla_configs' not in existing:
        op.create_table(
            'liveops_sla_configs',
            sa.Column('id',             sa.String(),  primary_key=True),
            sa.Column('urgency',        sa.String(),  nullable=False, unique=True),
            sa.Column('response_hours', sa.Integer(), nullable=False),
            sa.Column('created_at',     sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at',     sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.CheckConstraint("urgency IN ('low','medium','high')", name='liveops_sla_configs_urgency_check'),
        )

    if 'liveops_tickets' not in existing:
        op.create_table(
            'liveops_tickets',
            sa.Column('id',            sa.String(),  primary_key=True),
            sa.Column('ticket_number', sa.Integer(), nullable=False, unique=True),

            sa.Column('ticket_type_id',   sa.String(), sa.ForeignKey('liveops_ticket_types.id',   ondelete='RESTRICT'), nullable=False),
            sa.Column('use_case_id',      sa.String(), sa.ForeignKey('liveops_use_cases.id',       ondelete='RESTRICT'), nullable=False),
            sa.Column('business_unit_id', sa.String(), sa.ForeignKey('liveops_business_units.id',  ondelete='RESTRICT'), nullable=False),
            sa.Column('urgency',          sa.String(), nullable=False),
            sa.Column('description',      sa.Text(),   nullable=False),

            sa.Column('submitted_by_id', sa.String(), sa.ForeignKey('team_members.id', ondelete='RESTRICT'), nullable=False),
            sa.Column('submitted_at',    sa.TIMESTAMP(timezone=True), nullable=True),
            sa.Column('sla_deadline',    sa.TIMESTAMP(timezone=True), nullable=True),

            sa.Column('practice_lead_id', sa.String(), sa.ForeignKey('team_members.id', ondelete='SET NULL'), nullable=True),
            sa.Column('delivery_lead_id', sa.String(), sa.ForeignKey('team_members.id', ondelete='SET NULL'), nullable=True),

            sa.Column('pl_status',   sa.String(), nullable=False, server_default='pending'),
            sa.Column('pl_actor_id', sa.String(), sa.ForeignKey('team_members.id', ondelete='SET NULL'), nullable=True),
            sa.Column('pl_acted_at', sa.TIMESTAMP(timezone=True), nullable=True),
            sa.Column('pl_reason',   sa.Text(),   nullable=True),

            sa.Column('dl_status',   sa.String(), nullable=False, server_default='pending'),
            sa.Column('dl_actor_id', sa.String(), sa.ForeignKey('team_members.id', ondelete='SET NULL'), nullable=True),
            sa.Column('dl_acted_at', sa.TIMESTAMP(timezone=True), nullable=True),
            sa.Column('dl_reason',   sa.Text(),   nullable=True),

            sa.Column('lo_status',   sa.String(), nullable=False, server_default='pending'),
            sa.Column('lo_actor_id', sa.String(), sa.ForeignKey('team_members.id', ondelete='SET NULL'), nullable=True),
            sa.Column('lo_acted_at', sa.TIMESTAMP(timezone=True), nullable=True),
            sa.Column('lo_reason',   sa.Text(),   nullable=True),

            sa.Column('status',            sa.String(), nullable=False, server_default='draft'),
            sa.Column('currently_with_id', sa.String(), sa.ForeignKey('team_members.id', ondelete='SET NULL'), nullable=True),

            sa.Column('cancelled_by_id', sa.String(), sa.ForeignKey('team_members.id', ondelete='SET NULL'), nullable=True),
            sa.Column('cancelled_at',    sa.TIMESTAMP(timezone=True), nullable=True),
            sa.Column('cancel_reason',   sa.Text(), nullable=True),

            sa.Column('on_hold_reason', sa.Text(), nullable=True),
            sa.Column('put_on_hold_at', sa.TIMESTAMP(timezone=True), nullable=True),
            sa.Column('completed_at',   sa.TIMESTAMP(timezone=True), nullable=True),

            sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),

            sa.CheckConstraint("urgency IN ('low','medium','high')", name='liveops_tickets_urgency_check'),
            sa.CheckConstraint(
                "status IN ('draft','pending_pl','pending_dl','pending_lo','open','in_progress','completed','rejected','cancelled','on_hold')",
                name='liveops_tickets_status_check',
            ),
        )

    if 'liveops_assignments' not in existing:
        op.create_table(
            'liveops_assignments',
            sa.Column('id',               sa.String(), primary_key=True),
            sa.Column('ticket_id',        sa.String(), sa.ForeignKey('liveops_tickets.id',   ondelete='CASCADE'),  nullable=False),
            sa.Column('assignee_id',      sa.String(), sa.ForeignKey('team_members.id',      ondelete='RESTRICT'), nullable=False),
            sa.Column('assigned_by_id',   sa.String(), sa.ForeignKey('team_members.id',      ondelete='SET NULL'), nullable=True),
            sa.Column('lo_message',       sa.Text(),   nullable=True),
            sa.Column('status',           sa.String(), nullable=False, server_default='pending'),
            sa.Column('assigned_at',      sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('picked_up_at',     sa.TIMESTAMP(timezone=True), nullable=True),
            sa.Column('completed_at',     sa.TIMESTAMP(timezone=True), nullable=True),
            sa.Column('rejected_at',      sa.TIMESTAMP(timezone=True), nullable=True),
            sa.Column('rejection_reason', sa.Text(), nullable=True),
            sa.CheckConstraint("status IN ('pending','active','completed','rejected')", name='liveops_assignments_status_check'),
        )

    if 'liveops_comments' not in existing:
        op.create_table(
            'liveops_comments',
            sa.Column('id',         sa.String(),  primary_key=True),
            sa.Column('ticket_id',  sa.String(),  sa.ForeignKey('liveops_tickets.id', ondelete='CASCADE'),  nullable=False),
            sa.Column('author_id',  sa.String(),  sa.ForeignKey('team_members.id',    ondelete='SET NULL'), nullable=True),
            sa.Column('body',       sa.Text(),    nullable=False),
            sa.Column('is_system',  sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if 'liveops_ticket_events' not in existing:
        op.create_table(
            'liveops_ticket_events',
            sa.Column('id',         sa.String(), primary_key=True),
            sa.Column('ticket_id',  sa.String(), sa.ForeignKey('liveops_tickets.id', ondelete='CASCADE'),  nullable=False),
            sa.Column('actor_id',   sa.String(), sa.ForeignKey('team_members.id',    ondelete='SET NULL'), nullable=True),
            sa.Column('event_type', sa.String(), nullable=False),
            sa.Column('event_data', sa.Text(),   nullable=True),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )


def downgrade():
    for tbl in [
        'liveops_ticket_events', 'liveops_comments', 'liveops_assignments',
        'liveops_tickets', 'liveops_sla_configs', 'liveops_member_roles',
        'liveops_approver_configs', 'liveops_use_cases',
        'liveops_ticket_types', 'liveops_business_units',
    ]:
        op.drop_table(tbl)
