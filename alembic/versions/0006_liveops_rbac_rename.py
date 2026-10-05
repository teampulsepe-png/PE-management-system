"""Rename LiveOps role and status values to match RBAC design

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-02

Renames:
  Roles:    practice_lead → workstream_lead, delivery_lead → team_lead, lo_team → platform_engineer
  Statuses: pending_pl → pending_wl, pending_dl → pending_tl
  Columns:  practice_lead_id/delivery_lead_id → workstream_lead_id/team_lead_id (tickets + approver_configs)
            pl_*/dl_* audit cols → wl_*/tl_* on liveops_tickets
"""
from alembic import op
import sqlalchemy as sa

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def _col_names(bind, table):
    return {c['name'] for c in sa.inspect(bind).get_columns(table)}


def upgrade():
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())

    # ── liveops_tickets ────────────────────────────────────────────────────────
    if 'liveops_tickets' in tables:
        cols = _col_names(bind, 'liveops_tickets')

        renames = [
            ('practice_lead_id', 'workstream_lead_id'),
            ('delivery_lead_id', 'team_lead_id'),
            ('pl_status',        'wl_status'),
            ('pl_actor_id',      'wl_actor_id'),
            ('pl_acted_at',      'wl_acted_at'),
            ('pl_reason',        'wl_reason'),
            ('dl_status',        'tl_status'),
            ('dl_actor_id',      'tl_actor_id'),
            ('dl_acted_at',      'tl_acted_at'),
            ('dl_reason',        'tl_reason'),
        ]
        for old, new in renames:
            if old in cols and new not in cols:
                op.alter_column('liveops_tickets', old, new_column_name=new)

        # Update data: old status values → new
        op.execute("UPDATE liveops_tickets SET status = 'pending_wl' WHERE status = 'pending_pl'")
        op.execute("UPDATE liveops_tickets SET status = 'pending_tl' WHERE status = 'pending_dl'")

        # Drop old status CHECK and add new one
        op.execute("ALTER TABLE liveops_tickets DROP CONSTRAINT IF EXISTS liveops_tickets_status_check")
        op.execute(
            "ALTER TABLE liveops_tickets ADD CONSTRAINT liveops_tickets_status_check "
            "CHECK (status IN ('draft','pending_wl','pending_tl','pending_lo','open',"
            "'in_progress','completed','rejected','cancelled','on_hold'))"
        )

    # ── liveops_approver_configs ───────────────────────────────────────────────
    if 'liveops_approver_configs' in tables:
        cols = _col_names(bind, 'liveops_approver_configs')
        if 'practice_lead_id' in cols and 'workstream_lead_id' not in cols:
            op.alter_column('liveops_approver_configs', 'practice_lead_id', new_column_name='workstream_lead_id')
        if 'delivery_lead_id' in cols and 'team_lead_id' not in cols:
            op.alter_column('liveops_approver_configs', 'delivery_lead_id', new_column_name='team_lead_id')

    # ── liveops_member_roles ───────────────────────────────────────────────────
    if 'liveops_member_roles' in tables:
        op.execute("UPDATE liveops_member_roles SET role = 'workstream_lead' WHERE role = 'practice_lead'")
        op.execute("UPDATE liveops_member_roles SET role = 'team_lead'        WHERE role = 'delivery_lead'")
        op.execute("UPDATE liveops_member_roles SET role = 'platform_engineer' WHERE role = 'lo_team'")

        op.execute("ALTER TABLE liveops_member_roles DROP CONSTRAINT IF EXISTS liveops_member_roles_role_check")
        op.execute(
            "ALTER TABLE liveops_member_roles ADD CONSTRAINT liveops_member_roles_role_check "
            "CHECK (role IN ('workstream_lead','team_lead','lo_manager','platform_engineer'))"
        )


def downgrade():
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())

    if 'liveops_tickets' in tables:
        cols = _col_names(bind, 'liveops_tickets')
        renames = [
            ('workstream_lead_id', 'practice_lead_id'),
            ('team_lead_id',       'delivery_lead_id'),
            ('wl_status',  'pl_status'),
            ('wl_actor_id', 'pl_actor_id'),
            ('wl_acted_at', 'pl_acted_at'),
            ('wl_reason',   'pl_reason'),
            ('tl_status',  'dl_status'),
            ('tl_actor_id', 'dl_actor_id'),
            ('tl_acted_at', 'dl_acted_at'),
            ('tl_reason',   'dl_reason'),
        ]
        for old, new in renames:
            if old in cols and new not in cols:
                op.alter_column('liveops_tickets', old, new_column_name=new)
        op.execute("UPDATE liveops_tickets SET status = 'pending_pl' WHERE status = 'pending_wl'")
        op.execute("UPDATE liveops_tickets SET status = 'pending_dl' WHERE status = 'pending_tl'")
        op.execute("ALTER TABLE liveops_tickets DROP CONSTRAINT IF EXISTS liveops_tickets_status_check")
        op.execute(
            "ALTER TABLE liveops_tickets ADD CONSTRAINT liveops_tickets_status_check "
            "CHECK (status IN ('draft','pending_pl','pending_dl','pending_lo','open',"
            "'in_progress','completed','rejected','cancelled','on_hold'))"
        )

    if 'liveops_approver_configs' in tables:
        cols = _col_names(bind, 'liveops_approver_configs')
        if 'workstream_lead_id' in cols:
            op.alter_column('liveops_approver_configs', 'workstream_lead_id', new_column_name='practice_lead_id')
        if 'team_lead_id' in cols:
            op.alter_column('liveops_approver_configs', 'team_lead_id', new_column_name='delivery_lead_id')

    if 'liveops_member_roles' in tables:
        op.execute("UPDATE liveops_member_roles SET role = 'practice_lead'  WHERE role = 'workstream_lead'")
        op.execute("UPDATE liveops_member_roles SET role = 'delivery_lead'  WHERE role = 'team_lead'")
        op.execute("UPDATE liveops_member_roles SET role = 'lo_team'        WHERE role = 'platform_engineer'")
        op.execute("ALTER TABLE liveops_member_roles DROP CONSTRAINT IF EXISTS liveops_member_roles_role_check")
        op.execute(
            "ALTER TABLE liveops_member_roles ADD CONSTRAINT liveops_member_roles_role_check "
            "CHECK (role IN ('practice_lead','delivery_lead','lo_manager','lo_team'))"
        )
