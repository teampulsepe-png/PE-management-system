"""Add agent_config table

Revision ID: 0014
Revises: 0013
Create Date: 2026-10-19
"""

import sqlalchemy as sa
from alembic import op

revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'agent_config' not in inspector.get_table_names():
        op.create_table(
            'agent_config',
            sa.Column('id',            sa.Integer(), primary_key=True),
            sa.Column('agent_enabled', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('updated_by',    sa.String(),  nullable=True),
            sa.Column('updated_at',    sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )


def downgrade():
    op.drop_table('agent_config')
