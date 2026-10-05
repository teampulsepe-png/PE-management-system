"""Add team_feature_flags for per-team module access control

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-03

Changes:
- create: team_feature_flags (team_id, feature, enabled)
"""

import uuid
import sqlalchemy as sa
from alembic import op

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None

FEATURES = [
    'tasks', 'kpi', 'workload', 'pipelines',
    'ai_subscriptions', 'project_lifecycle', 'tracker', 'cost',
    'liveops', 'devops', 'agent',
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'team_feature_flags' not in existing_tables:
        op.create_table(
            'team_feature_flags',
            sa.Column('id', sa.String, primary_key=True),
            sa.Column('team_id', sa.String, sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False),
            sa.Column('feature', sa.String, nullable=False),
            sa.Column('enabled', sa.Boolean, nullable=False, server_default='true'),
            sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_unique_constraint(
            'team_feature_flags_unique',
            'team_feature_flags',
            ['team_id', 'feature'],
        )

    # Seed all teams with all features enabled
    teams = bind.execute(sa.text("SELECT id FROM teams")).fetchall()
    existing_flags = bind.execute(sa.text("SELECT team_id, feature FROM team_feature_flags")).fetchall()
    existing_set = {(r[0], r[1]) for r in existing_flags}

    for (team_id,) in teams:
        for feature in FEATURES:
            if (team_id, feature) not in existing_set:
                bind.execute(
                    sa.text(
                        "INSERT INTO team_feature_flags (id, team_id, feature, enabled) "
                        "VALUES (:id, :team_id, :feature, true)"
                    ),
                    {"id": str(uuid.uuid4()), "team_id": team_id, "feature": feature},
                )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'team_feature_flags' in inspector.get_table_names():
        op.drop_table('team_feature_flags')
