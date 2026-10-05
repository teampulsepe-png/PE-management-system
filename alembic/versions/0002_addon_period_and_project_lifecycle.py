"""addon period columns + project lifecycle tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-13

Changes:
- ai_subscription_addons: rename addon_date -> start_date, add end_date
- create: projects, project_items, user_access_logs
"""

import sqlalchemy as sa
from alembic import op

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    # ── ai_subscription_addons ────────────────────────────────────────────────
    addon_cols = [c['name'] for c in inspector.get_columns('ai_subscription_addons')]
    if 'addon_date' in addon_cols:
        op.alter_column('ai_subscription_addons', 'addon_date', new_column_name='start_date')
    if 'end_date' not in addon_cols:
        op.add_column('ai_subscription_addons', sa.Column('end_date', sa.String(), nullable=False, server_default=''))
        op.alter_column('ai_subscription_addons', 'end_date', server_default=None)

    # ── projects ──────────────────────────────────────────────────────────────
    if 'projects' not in existing_tables:
        op.create_table(
            'projects',
            sa.Column('id',          sa.String(), primary_key=True),
            sa.Column('name',        sa.String(), nullable=False),
            sa.Column('description', sa.Text(),   nullable=True),
            sa.Column('status',      sa.String(), nullable=False, server_default='active'),
            sa.Column('owner_id',    sa.String(), sa.ForeignKey('team_members.id', ondelete='SET NULL'), nullable=True),
            sa.Column('created_at',  sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # ── project_items ─────────────────────────────────────────────────────────
    if 'project_items' not in existing_tables:
        op.create_table(
            'project_items',
            sa.Column('id',           sa.String(), primary_key=True),
            sa.Column('project_id',   sa.String(), sa.ForeignKey('projects.id',     ondelete='CASCADE'),  nullable=False),
            sa.Column('phase',        sa.String(), nullable=False),
            sa.Column('item_key',     sa.String(), nullable=False),
            sa.Column('sort_order',   sa.Integer(), nullable=False, server_default='0'),
            sa.Column('owner_id',     sa.String(), sa.ForeignKey('team_members.id', ondelete='SET NULL'), nullable=True),
            sa.Column('deadline',     sa.String(), nullable=True),
            sa.Column('deliverable',  sa.Text(),   nullable=True),
            sa.Column('status',       sa.String(), nullable=False, server_default='pending'),
            sa.Column('completed_at', sa.String(), nullable=True),
            sa.Column('created_at',   sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # ── user_access_logs ──────────────────────────────────────────────────────
    if 'user_access_logs' not in existing_tables:
        op.create_table(
            'user_access_logs',
            sa.Column('id',             sa.String(), primary_key=True),
            sa.Column('project_id',     sa.String(), sa.ForeignKey('projects.id',     ondelete='CASCADE'),  nullable=False),
            sa.Column('member_id',      sa.String(), sa.ForeignKey('team_members.id', ondelete='RESTRICT'), nullable=False),
            sa.Column('action',         sa.String(), nullable=False),
            sa.Column('actioned_by_id', sa.String(), sa.ForeignKey('team_members.id', ondelete='SET NULL'), nullable=True),
            sa.Column('notes',          sa.Text(),   nullable=True),
            sa.Column('actioned_at',    sa.String(), nullable=False),
            sa.Column('created_at',     sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )


def downgrade() -> None:
    op.drop_table('user_access_logs')
    op.drop_table('project_items')
    op.drop_table('projects')

    op.drop_column('ai_subscription_addons', 'end_date')
    op.alter_column('ai_subscription_addons', 'start_date', new_column_name='addon_date')
