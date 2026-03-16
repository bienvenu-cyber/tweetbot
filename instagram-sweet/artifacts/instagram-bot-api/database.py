import os
import logging
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Mapped, mapped_column
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("instagram_bot")

# ---------------------------------------------------------------------------
# Database connection
# Supports both standard DATABASE_URL and Supabase-style connection strings.
# For Lovable Cloud / Supabase, use the direct PostgreSQL connection string:
#   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
# ---------------------------------------------------------------------------
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Supabase sometimes provides pooler URLs with `postgresql://` scheme
# SQLAlchemy needs `postgresql://` (not `postgres://`)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is required.\n"
        "For Lovable Cloud (Supabase), use the direct connection string from your project settings:\n"
        "  postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
    )

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Bot accounts (multi-account support)
# ---------------------------------------------------------------------------
class BotAccount(Base):
    __tablename__ = "bot_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    encrypted_password: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    session_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_logged_in: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_action_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# Queue, logs, settings
# ---------------------------------------------------------------------------
class QueueItem(Base):
    __tablename__ = "bot_queue"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    target: Mapped[str] = mapped_column(String(255), nullable=False)
    payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class LogEntry(Base):
    __tablename__ = "bot_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    target: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    account_username: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class BotSettingsModel(Base):
    __tablename__ = "bot_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    dm_daily_limit: Mapped[int] = mapped_column(Integer, default=50)
    dm_delay_min: Mapped[int] = mapped_column(Integer, default=30)
    dm_delay_max: Mapped[int] = mapped_column(Integer, default=120)
    comment_daily_limit: Mapped[int] = mapped_column(Integer, default=30)
    comment_delay_min: Mapped[int] = mapped_column(Integer, default=20)
    comment_delay_max: Mapped[int] = mapped_column(Integer, default=90)
    post_daily_limit: Mapped[int] = mapped_column(Integer, default=3)
    auto_dm_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_comment_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    proxy_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, default=None)


class BulkJob(Base):
    __tablename__ = "bot_bulk_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    job_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="running")
    total: Mapped[int] = mapped_column(Integer, default=0)
    processed: Mapped[int] = mapped_column(Integer, default=0)
    succeeded: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    account_username: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class ScheduledPost(Base):
    """Posts scheduled for future publication."""
    __tablename__ = "bot_scheduled_posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    account_username: Mapped[str] = mapped_column(String(100), nullable=False)
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    caption: Mapped[str] = mapped_column(Text, nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, published, failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables and seed defaults.
    Uses CREATE TABLE IF NOT EXISTS via metadata.create_all,
    then runs lightweight ALTER migrations for backward compat."""
    from sqlalchemy import text, inspect

    # Create all tables that don't exist yet
    Base.metadata.create_all(bind=engine)

    # Lightweight migrations for existing DBs missing new columns
    migrations = [
        "ALTER TABLE bot_settings ADD COLUMN IF NOT EXISTS proxy_url VARCHAR(500)",
        "ALTER TABLE bot_logs ADD COLUMN IF NOT EXISTS account_username VARCHAR(100)",
        "ALTER TABLE bot_bulk_jobs ADD COLUMN IF NOT EXISTS account_username VARCHAR(100)",
    ]
    with engine.connect() as connection:
        for sql in migrations:
            try:
                connection.execute(text(sql))
            except Exception:
                pass
        connection.commit()

    # Seed default settings
    db = SessionLocal()
    try:
        settings = db.query(BotSettingsModel).filter(BotSettingsModel.id == 1).first()
        if not settings:
            db.add(BotSettingsModel(id=1))
            db.commit()
            logger.info("[DB] Default settings created")
    finally:
        db.close()

    logger.info(f"[DB] Connected to: {DATABASE_URL[:40]}...")
