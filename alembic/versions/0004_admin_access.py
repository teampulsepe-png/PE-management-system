"""Add has_admin_access flag to team_members

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-26
"""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = [c['name'] for c in inspector.get_columns('team_members')]
    if 'has_admin_access' not in cols:
        op.add_column('team_members', sa.Column(
            'has_admin_access', sa.Boolean(), nullable=False, server_default='false'
        ))


def downgrade():
    op.drop_column('team_members', 'has_admin_access')
