import time
import random
import threading
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session

from instagram_client import ig_manager
from database import get_db, LogEntry, QueueItem, BotSettingsModel

logger = logging.getLogger(__name__)
router = APIRouter()


class SendDmRequest(BaseModel):
    username: str
    message: str


class BulkSendDmRequest(BaseModel):
    usernames: List[str]
    message: str
    delay_min: int = 30
    delay_max: int = 120


def log_action(db: Session, action_type: str, target: str, status: str, message: str):
    entry = LogEntry(
        action_type=action_type,
        target=target,
        status=status,
        message=message,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    db.commit()


def get_daily_count(db: Session, action_type: str) -> int:
    from sqlalchemy import func
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    count = db.query(func.count(LogEntry.id)).filter(
        LogEntry.action_type == action_type,
        LogEntry.status == "success",
        LogEntry.created_at >= today_start,
    ).scalar()
    return count or 0


@router.get("/threads")
def get_threads(amount: int = Query(20)):
    cl = ig_manager.get_client()
    if not cl:
        raise HTTPException(status_code=401, detail="Not logged in")
    try:
        threads = cl.direct_threads(amount=amount)
        result = []
        for t in threads:
            users = [u.username for u in t.users] if t.users else []
            last_msg = ""
            if t.messages:
                msg = t.messages[0]
                if hasattr(msg, "text") and msg.text:
                    last_msg = msg.text
            result.append({
                "id": str(t.id),
                "users": users,
                "last_message": last_msg,
                "last_seen_at": t.last_seen_at.isoformat() if hasattr(t, "last_seen_at") and t.last_seen_at else None,
                "unread": t.unread_count > 0 if hasattr(t, "unread_count") else False,
            })
        return {"threads": result, "total": len(result)}
    except Exception as e:
        logger.error(f"Error fetching threads: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send")
def send_dm(req: SendDmRequest, db: Session = Depends(get_db)):
    cl = ig_manager.get_client()
    if not cl:
        raise HTTPException(status_code=401, detail="Not logged in")

    settings = db.query(BotSettingsModel).filter(BotSettingsModel.id == 1).first()
    daily_limit = settings.dm_daily_limit if settings else 50
    daily_count = get_daily_count(db, "dm_send")

    if daily_count >= daily_limit:
        log_action(db, "dm_send", req.username, "blocked", f"Daily limit reached ({daily_limit})")
        raise HTTPException(status_code=429, detail=f"Daily DM limit reached ({daily_limit})")

    try:
        user_id = cl.user_id_from_username(req.username)
        cl.direct_send(req.message, user_ids=[user_id])
        log_action(db, "dm_send", req.username, "success", f"DM sent: {req.message[:50]}")
        return {"success": True, "message": f"DM sent to @{req.username}"}
    except Exception as e:
        log_action(db, "dm_send", req.username, "error", str(e))
        raise HTTPException(status_code=500, detail=str(e))


def bulk_send_worker(usernames: List[str], message: str, delay_min: int, delay_max: int, settings_id: int):
    from database import SessionLocal, QueueItem, LogEntry, BotSettingsModel
    from datetime import datetime, timezone

    db = SessionLocal()
    try:
        settings = db.query(BotSettingsModel).filter(BotSettingsModel.id == settings_id).first()
        daily_limit = settings.dm_daily_limit if settings else 50

        for i, username in enumerate(usernames):
            cl = ig_manager.get_client()
            if not cl:
                break

            from sqlalchemy import func
            today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            daily_count = db.query(func.count(LogEntry.id)).filter(
                LogEntry.action_type == "dm_send",
                LogEntry.status == "success",
                LogEntry.created_at >= today_start,
            ).scalar() or 0

            if daily_count >= daily_limit:
                entry = LogEntry(action_type="dm_send", target=username, status="blocked",
                                 message=f"Daily limit reached ({daily_limit})",
                                 created_at=datetime.now(timezone.utc))
                db.add(entry)
                db.commit()
                break

            try:
                user_id = cl.user_id_from_username(username)
                cl.direct_send(message, user_ids=[user_id])
                entry = LogEntry(action_type="dm_send", target=username, status="success",
                                 message=f"Bulk DM sent: {message[:50]}",
                                 created_at=datetime.now(timezone.utc))
                db.add(entry)
                db.commit()
                logger.info(f"Bulk DM sent to {username} ({i+1}/{len(usernames)})")
            except Exception as e:
                entry = LogEntry(action_type="dm_send", target=username, status="error",
                                 message=str(e), created_at=datetime.now(timezone.utc))
                db.add(entry)
                db.commit()
                logger.error(f"Error sending bulk DM to {username}: {e}")

            if i < len(usernames) - 1:
                delay = random.randint(delay_min, delay_max)
                logger.info(f"Waiting {delay}s before next DM...")
                time.sleep(delay)
    finally:
        db.close()


@router.post("/bulk-send")
def bulk_send_dm(req: BulkSendDmRequest, db: Session = Depends(get_db)):
    cl = ig_manager.get_client()
    if not cl:
        raise HTTPException(status_code=401, detail="Not logged in")

    if not req.usernames:
        raise HTTPException(status_code=400, detail="No usernames provided")

    if req.delay_min > req.delay_max:
        raise HTTPException(status_code=400, detail="delay_min must be <= delay_max")

    settings = db.query(BotSettingsModel).filter(BotSettingsModel.id == 1).first()

    thread = threading.Thread(
        target=bulk_send_worker,
        args=(req.usernames, req.message, req.delay_min, req.delay_max, 1),
        daemon=True,
    )
    thread.start()

    log_action(db, "bulk_dm_start", f"{len(req.usernames)} users", "queued",
               f"Bulk DM job started for {len(req.usernames)} users")

    return {
        "success": True,
        "queued": len(req.usernames),
        "message": f"Bulk DM job started for {len(req.usernames)} users with {req.delay_min}-{req.delay_max}s delays",
    }
