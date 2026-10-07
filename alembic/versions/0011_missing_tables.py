"""Add tables missing from migration history: tracker, supervisor, cost_entries, push_subscriptions

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-07

These tables were created via Base.metadata.create_all in seed.py but were never
added to the alembic migration chain.
"""

import sqlalchemy as sa
from alembic import op

revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = inspector.get_table_names()

    if 'push_subscriptions' not in existing:
        op.create_table(
            'push_subscriptions',
            sa.Column('id',         sa.String(), primary_key=True),
            sa.Column('user_email', sa.String(), nullable=False),
            sa.Column('endpoint',   sa.Text(),   nullable=False, unique=True),
            sa.Column('p256dh',     sa.Text(),   nullable=False),
            sa.Column('auth',       sa.Text(),   nullable=False),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if 'tracker_areas' not in existing:
        op.create_table(
            'tracker_areas',
            sa.Column('id',         sa.String(),  primary_key=True),
            sa.Column('name',       sa.String(),  nullable=False),
            sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if 'tracker_groups' not in existing:
        op.create_table(
            'tracker_groups',
            sa.Column('id',         sa.String(),  primary_key=True),
            sa.Column('area_id',    sa.String(),  sa.ForeignKey('tracker_areas.id', ondelete='CASCADE'), nullable=False),
            sa.Column('name',       sa.String(),  nullable=False),
            sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if 'tracker_tasks' not in existing:
        op.create_table(
            'tracker_tasks',
            sa.Column('id',               sa.String(),  primary_key=True),
            sa.Column('group_id',         sa.String(),  sa.ForeignKey('tracker_groups.id', ondelete='CASCADE'), nullable=False),
            sa.Column('title',            sa.String(),  nullable=False),
            sa.Column('owner',            sa.String(),  nullable=True),
            sa.Column('planned_end_date', sa.String(),  nullable=True),
            sa.Column('sort_order',       sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at',       sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if 'tracker_subtasks' not in existing:
        op.create_table(
            'tracker_subtasks',
            sa.Column('id',         sa.String(),  primary_key=True),
            sa.Column('task_id',    sa.String(),  sa.ForeignKey('tracker_tasks.id', ondelete='CASCADE'), nullable=False),
            sa.Column('title',      sa.String(),  nullable=False),
            sa.Column('date',       sa.String(),  nullable=True),
            sa.Column('remarks',    sa.Text(),    nullable=True),
            sa.Column('is_done',    sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if 'supervisor_tasks' not in existing:
        op.create_table(
            'supervisor_tasks',
            sa.Column('id',          sa.String(), primary_key=True),
            sa.Column('title',       sa.String(), nullable=False),
            sa.Column('description', sa.Text(),   nullable=True),
            sa.Column('size',        sa.String(), nullable=False),
            sa.Column('status',      sa.String(), nullable=False, server_default='pending'),
            sa.Column('start_date',  sa.String(), nullable=False),
            sa.Column('due_date',    sa.String(), nullable=False),
            sa.Column('created_by',  sa.String(), nullable=True),
            sa.Column('created_at',  sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at',  sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if 'supervisor_task_assignments' not in existing:
        op.create_table(
            'supervisor_task_assignments',
            sa.Column('id',        sa.String(), primary_key=True),
            sa.Column('task_id',   sa.String(), sa.ForeignKey('supervisor_tasks.id', ondelete='CASCADE'),  nullable=False),
            sa.Column('member_id', sa.String(), sa.ForeignKey('team_members.id',     ondelete='CASCADE'),  nullable=False),
            sa.UniqueConstraint('task_id', 'member_id', name='supervisor_task_assignments_unique'),
        )

    if 'cost_entries' not in existing:
        op.create_table(
            'cost_entries',
            sa.Column('id',                  sa.String(),  primary_key=True),
            sa.Column('category',            sa.String(),  nullable=False),
            sa.Column('service_name',        sa.String(),  nullable=False),
            sa.Column('service_description', sa.String(),  nullable=True),
            sa.Column('month',               sa.String(),  nullable=False),
            sa.Column('amount_cents',        sa.Integer(), nullable=False),
            sa.Column('created_at',          sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at',          sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )


def downgrade():
    for tbl in [
        'cost_entries',
        'supervisor_task_assignments', 'supervisor_tasks',
        'tracker_subtasks', 'tracker_tasks', 'tracker_groups', 'tracker_areas',
        'push_subscriptions',
    ]:
        op.drop_table(tbl)
