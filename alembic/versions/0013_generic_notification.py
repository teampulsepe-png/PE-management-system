"""Refactor notifications to generic entity model

Revision ID: 0013
Revises: 0012
Create Date: 2026-10-12
"""

from alembic import op
import sqlalchemy as sa

revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('notifications', sa.Column('entity_type', sa.String(), nullable=True))
    op.add_column('notifications', sa.Column('entity_id',   sa.String(), nullable=True))
    op.add_column('notifications', sa.Column('metadata',    sa.JSON(),   nullable=True))

    # Backfill existing task_occurrence mention notifications
    op.execute("""
        UPDATE notifications
        SET entity_type = 'task_occurrence',
            entity_id   = occurrence_id,
            metadata    = json_build_object(
                'task_id',         task_id,
                'task_recurrence', task_recurrence
            )
        WHERE occurrence_id IS NOT NULL
    """)

    # Drop old domain-specific columns (CASCADE removes FK constraints automatically)
    op.execute("ALTER TABLE notifications DROP COLUMN IF EXISTS task_id CASCADE")
    op.execute("ALTER TABLE notifications DROP COLUMN IF EXISTS task_recurrence CASCADE")
    op.execute("ALTER TABLE notifications DROP COLUMN IF EXISTS occurrence_id CASCADE")
    op.execute("ALTER TABLE notifications DROP COLUMN IF EXISTS comment_id CASCADE")


def downgrade():
    op.add_column('notifications', sa.Column('task_id',         sa.String(), nullable=True))
    op.add_column('notifications', sa.Column('task_recurrence', sa.String(), nullable=True))
    op.add_column('notifications', sa.Column('occurrence_id',   sa.String(), nullable=True))
    op.add_column('notifications', sa.Column('comment_id',      sa.String(), nullable=True))

    # Restore task_occurrence data
    op.execute("""
        UPDATE notifications
        SET task_id         = metadata->>'task_id',
            task_recurrence = metadata->>'task_recurrence',
            occurrence_id   = entity_id
        WHERE entity_type = 'task_occurrence'
    """)

    op.create_foreign_key(None, 'notifications', 'tasks',
                          ['task_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'notifications', 'task_occurrences',
                          ['occurrence_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'notifications', 'task_comments',
                          ['comment_id'], ['id'], ondelete='SET NULL')

    op.drop_column('notifications', 'entity_type')
    op.drop_column('notifications', 'entity_id')
    op.drop_column('notifications', 'metadata')
