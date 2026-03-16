import os
import logging
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text, JSON, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session, Mapped, mapped_column
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("instagram_bot")

DATABASE_URL = os.environ.get("DATABASE_URL", "")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


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


class InstagramSession(Base):
    """Store Instagram sessions in DB instead of /tmp/ files."""
    __tablename__ = "bot_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    session_data: Mapped[str] = mapped_column(Text, nullable=False)  # JSON blob
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class BulkJob(Base):
    """Track bulk DM/comment jobs with state."""
    __tablename__ = "bot_bulk_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    job_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "bulk_dm"
    status: Mapped[str] = mapped_column(String(20), default="running")  # running, completed, failed, cancelled
    total: Mapped[int] = mapped_column(Integer, default=0)
    processed: Mapped[int] = mapped_column(Integer, default=0)
    succeeded: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _run_migrations(connection):
    """Add new columns/tables to existing database without breaking existing data."""
    migrations = [
        "ALTER TABLE bot_settings ADD COLUMN IF NOT EXISTS proxy_url VARCHAR(500)",
    ]
    for sql in migrations:
        try:
            connection.execute(text(sql))
            logger.info(f"[DB] Migration OK: {sql[:60]}")
        except Exception as e:
            logger.warning(f"[DB] Migration skipped ({sql[:40]}...): {e}")


def init_db():
    Base.metadata.create_all(bind=engine)
    with engine.connect() as connection:
        _run_migrations(connection)
        connection.commit()

    db = SessionLocal()
    try:
        settings = db.query(BotSettingsModel).filter(BotSettingsModel.id == 1).first()
        if not settings:
            db.add(BotSettingsModel(id=1))
            db.commit()
            logger.info("[DB] Default settings created")
    finally:
        db.close()
