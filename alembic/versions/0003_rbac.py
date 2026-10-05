"""RBAC overhaul — rename dev→user, add admin role, nullable team_id, head_team_assignments

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-26

Changes:
- roles: rename 'dev' → 'user', insert 'admin'
- team_members: make team_id nullable (admins have no team)
- create: head_team_assignments (head member ↔ team many-to-many)
"""

import uuid
import sqlalchemy as sa
from alembic import op

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    # ── roles: rename dev → user ───────────────────────────────────────────────
    bind.execute(sa.text("UPDATE roles SET name = 'user' WHERE name = 'dev'"))

    # ── roles: insert admin if not already present ─────────────────────────────
    result = bind.execute(sa.text("SELECT id FROM roles WHERE name = 'admin'")).fetchone()
    if not result:
        bind.execute(
            sa.text("INSERT INTO roles (id, name, created_at) VALUES (:id, 'admin', now())"),
            {"id": str(uuid.uuid4())},
        )

    # ── team_members: make team_id nullable ────────────────────────────────────
    tm_cols = {c['name']: c for c in inspector.get_columns('team_members')}
    if tm_cols.get('team_id', {}).get('nullable') is False:
        op.alter_column('team_members', 'team_id', nullable=True)

    # ── head_team_assignments: create if missing ───────────────────────────────
    if 'head_team_assignments' not in existing_tables:
        op.create_table(
            'head_team_assignments',
            sa.Column('id', sa.String, primary_key=True),
            sa.Column('member_id', sa.String, sa.ForeignKey('team_members.id', ondelete='CASCADE'), nullable=False),
            sa.Column('team_id', sa.String, sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False),
            sa.Column('assigned_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_unique_constraint(
            'head_team_assignments_unique',
            'head_team_assignments',
            ['member_id', 'team_id'],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'head_team_assignments' in existing_tables:
        op.drop_table('head_team_assignments')

    op.alter_column('team_members', 'team_id', nullable=False)

    bind.execute(sa.text("UPDATE roles SET name = 'dev' WHERE name = 'user'"))
    bind.execute(sa.text("DELETE FROM roles WHERE name = 'admin'"))
