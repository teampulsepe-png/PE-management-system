"""Add liveops_engineer to liveops_member_roles check constraint

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-03

Changes:
- alter: liveops_member_roles — extend role CHECK to include 'liveops_engineer'
"""

from alembic import op

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE liveops_member_roles DROP CONSTRAINT IF EXISTS liveops_member_roles_role_check")
    op.execute(
        "ALTER TABLE liveops_member_roles ADD CONSTRAINT liveops_member_roles_role_check "
        "CHECK (role IN ('workstream_lead','team_lead','lo_manager','platform_engineer','liveops_engineer'))"
    )


def downgrade():
    op.execute("ALTER TABLE liveops_member_roles DROP CONSTRAINT IF EXISTS liveops_member_roles_role_check")
    op.execute(
        "ALTER TABLE liveops_member_roles ADD CONSTRAINT liveops_member_roles_role_check "
        "CHECK (role IN ('workstream_lead','team_lead','lo_manager','platform_engineer'))"
    )
