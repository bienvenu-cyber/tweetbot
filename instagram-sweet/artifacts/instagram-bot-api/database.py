import os
import logging
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text, JSON, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone

logger = logging.getLogger("instagram_bot")

DATABASE_URL = os.environ.get("DATABASE_URL", "")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class QueueItem(Base):
    __tablename__ = "bot_queue"

    id = Column(Integer, primary_key=True, index=True)
    action_type = Column(String(50), nullable=False)
    target = Column(String(255), nullable=False)
    payload = Column(Text, nullable=True)
    status = Column(String(20), default="pending")
    scheduled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    processed_at = Column(DateTime, nullable=True)


class LogEntry(Base):
    __tablename__ = "bot_logs"

    id = Column(Integer, primary_key=True, index=True)
    action_type = Column(String(50), nullable=False)
    target = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class BotSettingsModel(Base):
    __tablename__ = "bot_settings"

    id = Column(Integer, primary_key=True, default=1)
    dm_daily_limit = Column(Integer, default=50)
    dm_delay_min = Column(Integer, default=30)
    dm_delay_max = Column(Integer, default=120)
    comment_daily_limit = Column(Integer, default=30)
    comment_delay_min = Column(Integer, default=20)
    comment_delay_max = Column(Integer, default=90)
    post_daily_limit = Column(Integer, default=3)
    auto_dm_enabled = Column(Boolean, default=False)
    auto_comment_enabled = Column(Boolean, default=False)
    proxy_url = Column(String(500), nullable=True, default=None)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _run_migrations(connection):
    """Add new columns to existing tables without breaking existing data."""
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
