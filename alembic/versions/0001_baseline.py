"""baseline — full schema as it existed before migration tracking

Revision ID: 0001
Revises:
Create Date: 2026-08-13

If the tables already exist in your DB, stamp without running:
    python -m alembic stamp 0001
"""

import sqlalchemy as sa
from alembic import op

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── enums ─────────────────────────────────────────────────────────────────
    conn = op.get_bind()
    conn.execute(sa.text("CREATE TYPE IF NOT EXISTS recurrence_type AS ENUM ('weekly','monthly','quarterly','annually')"))
    conn.execute(sa.text("CREATE TYPE IF NOT EXISTS occurrence_status AS ENUM ('pending','in_progress','done','skipped')"))
    conn.execute(sa.text("CREATE TYPE IF NOT EXISTS kpi_frequency    AS ENUM ('monthly','quarterly','annually')"))

    # ── teams ─────────────────────────────────────────────────────────────────
    op.create_table(
        'teams',
        sa.Column('id',         sa.String(), primary_key=True),
        sa.Column('name',       sa.String(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── roles ─────────────────────────────────────────────────────────────────
    op.create_table(
        'roles',
        sa.Column('id',         sa.String(), primary_key=True),
        sa.Column('name',       sa.String(), nullable=False, unique=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── team_members ──────────────────────────────────────────────────────────
    op.create_table(
        'team_members',
        sa.Column('id',         sa.String(), primary_key=True),
        sa.Column('team_id',    sa.String(), sa.ForeignKey('teams.id', ondelete='CASCADE'),  nullable=False),
        sa.Column('name',       sa.String(), nullable=False),
        sa.Column('email',      sa.String(), nullable=True),
        sa.Column('role_id',    sa.String(), sa.ForeignKey('roles.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('team_id', 'name', name='team_members_unique_name'),
    )

    # ── tasks ─────────────────────────────────────────────────────────────────
    op.create_table(
        'tasks',
        sa.Column('id',          sa.String(),  primary_key=True),
        sa.Column('title',       sa.String(),  nullable=False),
        sa.Column('description', sa.Text(),    nullable=True),
        sa.Column('recurrence',  sa.Enum('weekly', 'monthly', 'quarterly', 'annually', name='recurrence_type', create_type=False), nullable=False),
        sa.Column('team_id',     sa.String(),  sa.ForeignKey('teams.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('is_active',   sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at',  sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("recurrence IN ('weekly','monthly','quarterly','annually')", name='tasks_recurrence_check'),
    )

    # ── task_occurrences ──────────────────────────────────────────────────────
    op.create_table(
        'task_occurrences',
        sa.Column('id',               sa.String(), primary_key=True),
        sa.Column('task_id',          sa.String(), sa.ForeignKey('tasks.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('period',           sa.String(), nullable=False),
        sa.Column('status',           sa.Enum('pending', 'in_progress', 'done', 'skipped', name='occurrence_status', create_type=False), nullable=False, server_default='pending'),
        sa.Column('completed_by',     sa.String(), nullable=True),
        sa.Column('completion_notes', sa.Text(),   nullable=True),
        sa.Column('completed_at',     sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at',       sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at',       sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('task_id', 'period', name='task_occurrences_unique'),
        sa.CheckConstraint("status IN ('pending','in_progress','done','skipped')", name='task_occurrences_status_check'),
    )

    # ── task_comments ─────────────────────────────────────────────────────────
    op.create_table(
        'task_comments',
        sa.Column('id',            sa.String(), primary_key=True),
        sa.Column('occurrence_id', sa.String(), sa.ForeignKey('task_occurrences.id', ondelete='CASCADE'), nullable=False),
        sa.Column('author',        sa.String(), nullable=False),
        sa.Column('body',          sa.Text(),   nullable=False),
        sa.Column('created_at',    sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── task_id_counters ──────────────────────────────────────────────────────
    op.create_table(
        'task_id_counters',
        sa.Column('team_id',    sa.String(),  sa.ForeignKey('teams.id', ondelete='RESTRICT'), primary_key=True),
        sa.Column('recurrence', sa.String(),  primary_key=True),
        sa.Column('year',       sa.Integer(), primary_key=True),
        sa.Column('counter',    sa.Integer(), nullable=False, server_default='0'),
    )

    # ── notifications ─────────────────────────────────────────────────────────
    op.create_table(
        'notifications',
        sa.Column('id',                  sa.String(),  primary_key=True),
        sa.Column('recipient_member_id', sa.String(),  sa.ForeignKey('team_members.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type',                sa.String(),  nullable=False),
        sa.Column('task_id',             sa.String(),  sa.ForeignKey('tasks.id', ondelete='SET NULL'), nullable=True),
        sa.Column('task_recurrence',     sa.String(),  nullable=True),
        sa.Column('occurrence_id',       sa.String(),  sa.ForeignKey('task_occurrences.id', ondelete='SET NULL'), nullable=True),
        sa.Column('comment_id',          sa.String(),  sa.ForeignKey('task_comments.id', ondelete='SET NULL'), nullable=True),
        sa.Column('triggered_by_name',   sa.String(),  nullable=True),
        sa.Column('message',             sa.String(),  nullable=False),
        sa.Column('is_read',             sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at',          sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── kpi_metrics ───────────────────────────────────────────────────────────
    op.create_table(
        'kpi_metrics',
        sa.Column('id',                   sa.String(),  primary_key=True),
        sa.Column('category',             sa.String(),  nullable=False),
        sa.Column('year',                 sa.Integer(), nullable=False),
        sa.Column('metric_name',          sa.String(),  nullable=False),
        sa.Column('pdca',                 sa.String(),  nullable=False, server_default='plan'),
        sa.Column('frequency',            sa.Enum('monthly', 'quarterly', 'annually', name='kpi_frequency', create_type=False), nullable=False, server_default='monthly'),
        sa.Column('kpi_owner_id',         sa.String(),  sa.ForeignKey('team_members.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('responsible_party_id', sa.String(),  sa.ForeignKey('team_members.id', ondelete='SET NULL'), nullable=True),
        sa.Column('planned',              sa.Integer(), nullable=False),
        sa.Column('target',               sa.Integer(), nullable=False, server_default='100'),
        sa.Column('remarks',              sa.Text(),    nullable=True),
        sa.Column('created_at',           sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── kpi_evaluations ───────────────────────────────────────────────────────
    op.create_table(
        'kpi_evaluations',
        sa.Column('id',            sa.String(),  primary_key=True),
        sa.Column('kpi_metric_id', sa.String(),  sa.ForeignKey('kpi_metrics.id', ondelete='CASCADE'), nullable=False),
        sa.Column('period_label',  sa.String(),  nullable=False),
        sa.Column('period_order',  sa.Integer(), nullable=False),
        sa.Column('actual',        sa.Integer(), nullable=True),
        sa.Column('completed_at',  sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at',    sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── kpi_evaluation_entries ────────────────────────────────────────────────
    op.create_table(
        'kpi_evaluation_entries',
        sa.Column('id',                sa.String(), primary_key=True),
        sa.Column('kpi_evaluation_id', sa.String(), sa.ForeignKey('kpi_evaluations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('done_at',           sa.String(), nullable=False),
        sa.Column('created_at',        sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── departments ───────────────────────────────────────────────────────────
    op.create_table(
        'departments',
        sa.Column('id',         sa.String(), primary_key=True),
        sa.Column('name',       sa.String(), nullable=False, unique=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── ai_tools ──────────────────────────────────────────────────────────────
    op.create_table(
        'ai_tools',
        sa.Column('id',           sa.String(),  primary_key=True),
        sa.Column('name',         sa.String(),  nullable=False),
        sa.Column('tier',         sa.String(),  nullable=True),
        sa.Column('monthly_cost', sa.Integer(), nullable=False),
        sa.Column('created_at',   sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── ai_subscriptions ──────────────────────────────────────────────────────
    op.create_table(
        'ai_subscriptions',
        sa.Column('id',              sa.String(), primary_key=True),
        sa.Column('subscriber_name', sa.String(), nullable=False),
        sa.Column('email',           sa.String(), nullable=False),
        sa.Column('department_id',   sa.String(), sa.ForeignKey('departments.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('tool_id',         sa.String(), sa.ForeignKey('ai_tools.id',    ondelete='RESTRICT'), nullable=False),
        sa.Column('start_date',      sa.String(), nullable=False),
        sa.Column('end_date',        sa.String(), nullable=True),
        sa.Column('remarks',         sa.Text(),   nullable=True),
        sa.Column('created_at',      sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── ai_subscription_addons ────────────────────────────────────────────────
    # Note: uses addon_date here (pre-0002 rename)
    op.create_table(
        'ai_subscription_addons',
        sa.Column('id',              sa.String(),  primary_key=True),
        sa.Column('subscription_id', sa.String(),  sa.ForeignKey('ai_subscriptions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('credits',         sa.Integer(), nullable=False),
        sa.Column('addon_date',      sa.String(),  nullable=False),
        sa.Column('remarks',         sa.Text(),    nullable=True),
        sa.Column('created_at',      sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('ai_subscription_addons')
    op.drop_table('ai_subscriptions')
    op.drop_table('ai_tools')
    op.drop_table('departments')
    op.drop_table('kpi_evaluation_entries')
    op.drop_table('kpi_evaluations')
    op.drop_table('kpi_metrics')
    op.drop_table('notifications')
    op.drop_table('task_id_counters')
    op.drop_table('task_comments')
    op.drop_table('task_occurrences')
    op.drop_table('tasks')
    op.drop_table('team_members')
    op.drop_table('roles')
    op.drop_table('teams')

    conn = op.get_bind()
    conn.execute(sa.text('DROP TYPE IF EXISTS kpi_frequency'))
    conn.execute(sa.text('DROP TYPE IF EXISTS occurrence_status'))
    conn.execute(sa.text('DROP TYPE IF EXISTS recurrence_type'))
