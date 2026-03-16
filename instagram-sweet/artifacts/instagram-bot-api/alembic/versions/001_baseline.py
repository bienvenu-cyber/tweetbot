"""Baseline: create all existing tables

Revision ID: 001_baseline
Revises: 
Create Date: 2026-03-16
"""
from alembic import op
import sqlalchemy as sa

revision = "001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- bot_accounts ---
    op.create_table(
        "bot_accounts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(100), unique=True, nullable=False),
        sa.Column("encrypted_password", sa.Text(), nullable=True),
        sa.Column("session_data", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("is_logged_in", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("last_login_at", sa.DateTime(), nullable=True),
        sa.Column("last_action_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_bot_accounts_id", "bot_accounts", ["id"])

    # --- bot_queue ---
    op.create_table(
        "bot_queue",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("action_type", sa.String(50), nullable=False),
        sa.Column("target", sa.String(255), nullable=False),
        sa.Column("payload", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), server_default=sa.text("'pending'")),
        sa.Column("scheduled_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("processed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_bot_queue_id", "bot_queue", ["id"])

    # --- bot_logs ---
    op.create_table(
        "bot_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("action_type", sa.String(50), nullable=False),
        sa.Column("target", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("account_username", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_bot_logs_id", "bot_logs", ["id"])

    # --- bot_settings ---
    op.create_table(
        "bot_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("dm_daily_limit", sa.Integer(), server_default=sa.text("50")),
        sa.Column("dm_delay_min", sa.Integer(), server_default=sa.text("30")),
        sa.Column("dm_delay_max", sa.Integer(), server_default=sa.text("120")),
        sa.Column("comment_daily_limit", sa.Integer(), server_default=sa.text("30")),
        sa.Column("comment_delay_min", sa.Integer(), server_default=sa.text("20")),
        sa.Column("comment_delay_max", sa.Integer(), server_default=sa.text("90")),
        sa.Column("post_daily_limit", sa.Integer(), server_default=sa.text("3")),
        sa.Column("auto_dm_enabled", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("auto_comment_enabled", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("proxy_url", sa.String(500), nullable=True),
    )

    # --- bot_bulk_jobs ---
    op.create_table(
        "bot_bulk_jobs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("job_type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), server_default=sa.text("'running'")),
        sa.Column("total", sa.Integer(), server_default=sa.text("0")),
        sa.Column("processed", sa.Integer(), server_default=sa.text("0")),
        sa.Column("succeeded", sa.Integer(), server_default=sa.text("0")),
        sa.Column("failed", sa.Integer(), server_default=sa.text("0")),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("account_username", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_bot_bulk_jobs_id", "bot_bulk_jobs", ["id"])

    # --- bot_scheduled_posts ---
    op.create_table(
        "bot_scheduled_posts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("account_username", sa.String(100), nullable=False),
        sa.Column("image_url", sa.Text(), nullable=False),
        sa.Column("caption", sa.Text(), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(20), server_default=sa.text("'pending'")),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("published_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_bot_scheduled_posts_id", "bot_scheduled_posts", ["id"])

    # Seed default settings
    op.execute("INSERT INTO bot_settings (id) VALUES (1) ON CONFLICT DO NOTHING")


def downgrade() -> None:
    op.drop_table("bot_scheduled_posts")
    op.drop_table("bot_bulk_jobs")
    op.drop_table("bot_settings")
    op.drop_table("bot_logs")
    op.drop_table("bot_queue")
    op.drop_table("bot_accounts")
