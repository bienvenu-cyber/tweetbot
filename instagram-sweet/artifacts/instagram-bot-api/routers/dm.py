import asyncio
import random
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session

from instagram_client import account_manager
from database import get_db, LogEntry, BotSettingsModel, BulkJob, SessionLocal
from utils import get_daily_count, log_action
from routers.ws import broadcast_job_update

logger = logging.getLogger(__name__)
router = APIRouter()


class SendDmRequest(BaseModel):
    username: str
    message: str
    account_username: Optional[str] = None


class BulkSendDmRequest(BaseModel):
    usernames: List[str]
    message: str
    delay_min: int = 30
    delay_max: int = 120
    account_username: Optional[str] = None


@router.get("/threads")
def get_threads(amount: int = Query(20), account_username: Optional[str] = Query(None)):
    cl = account_manager.get_client(account_username)
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
    cl = account_manager.get_client(req.account_username)
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


def _bulk_send_sync(job_id: int, usernames: List[str], message: str, delay_min: int, delay_max: int, account_username: Optional[str]):
    import time
    db = SessionLocal()
    loop = asyncio.new_event_loop()
    try:
        job = db.query(BulkJob).filter(BulkJob.id == job_id).first()
        if not job:
            return

        settings = db.query(BotSettingsModel).filter(BotSettingsModel.id == 1).first()
        daily_limit = settings.dm_daily_limit if settings else 50

        for i, username in enumerate(usernames):
            db.refresh(job)
            if job.status == "cancelled":
                break

            cl = account_manager.get_client(account_username)
            if not cl:
                job.status = "failed"
                job.message = "Client disconnected"
                db.commit()
                _broadcast_sync(loop, job_id, job)
                break

            daily_count = get_daily_count(db, "dm_send")
            if daily_count >= daily_limit:
                log_action(db, "dm_send", username, "blocked", f"Daily limit reached ({daily_limit})")
                job.status = "completed"
                job.message = f"Stopped at daily limit ({daily_limit})"
                db.commit()
                _broadcast_sync(loop, job_id, job)
                break

            try:
                user_id = cl.user_id_from_username(username)
                cl.direct_send(message, user_ids=[user_id])
                log_action(db, "dm_send", username, "success", f"Bulk DM sent: {message[:50]}")
                job.succeeded += 1
            except Exception as e:
                log_action(db, "dm_send", username, "error", str(e))
                job.failed += 1

            job.processed += 1
            db.commit()
            _broadcast_sync(loop, job_id, job)

            if i < len(usernames) - 1:
                delay = random.randint(delay_min, delay_max)
                time.sleep(delay)

        db.refresh(job)
        if job.status == "running":
            job.status = "completed"
        db.commit()
        _broadcast_sync(loop, job_id, job)
    finally:
        loop.close()
        db.close()


def _broadcast_sync(loop, job_id, job):
    """Send WS update from sync thread."""
    try:
        data = {
            "job_id": job.id,
            "status": job.status,
            "total": job.total,
            "processed": job.processed,
            "succeeded": job.succeeded,
            "failed": job.failed,
            "message": job.message,
        }
        asyncio.run_coroutine_threadsafe(broadcast_job_update(job_id, data), asyncio.get_event_loop())
    except Exception:
        pass  # WS broadcast is best-effort


async def bulk_send_task(job_id: int, usernames: List[str], message: str, delay_min: int, delay_max: int, account_username: Optional[str]):
    await asyncio.to_thread(_bulk_send_sync, job_id, usernames, message, delay_min, delay_max, account_username)


@router.post("/bulk-send")
async def bulk_send_dm(req: BulkSendDmRequest, db: Session = Depends(get_db)):
    cl = account_manager.get_client(req.account_username)
    if not cl:
        raise HTTPException(status_code=401, detail="Not logged in")

    if not req.usernames:
        raise HTTPException(status_code=400, detail="No usernames provided")
    if req.delay_min > req.delay_max:
        raise HTTPException(status_code=400, detail="delay_min must be <= delay_max")

    job = BulkJob(
        job_type="bulk_dm",
        status="running",
        total=len(req.usernames),
        account_username=req.account_username,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    log_action(db, "bulk_dm_start", f"{len(req.usernames)} users", "queued",
               f"Bulk DM job #{job.id} started for {len(req.usernames)} users")

    asyncio.create_task(bulk_send_task(job.id, req.usernames, req.message, req.delay_min, req.delay_max, req.account_username))

    return {
        "success": True,
        "job_id": job.id,
        "queued": len(req.usernames),
        "message": f"Bulk DM job #{job.id} started — connect to /bot-api/ws/bulk-jobs/{job.id} for live updates",
    }


@router.get("/bulk-jobs")
def get_bulk_jobs(db: Session = Depends(get_db)):
    jobs = db.query(BulkJob).filter(BulkJob.job_type == "bulk_dm").order_by(BulkJob.created_at.desc()).limit(20).all()
    return {
        "jobs": [
            {
                "id": j.id,
                "status": j.status,
                "total": j.total,
                "processed": j.processed,
                "succeeded": j.succeeded,
                "failed": j.failed,
                "message": j.message,
                "account_username": j.account_username,
                "created_at": j.created_at.isoformat() if j.created_at else None,
            }
            for j in jobs
        ]
    }


@router.post("/bulk-jobs/{job_id}/cancel")
def cancel_bulk_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(BulkJob).filter(BulkJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "running":
        raise HTTPException(status_code=400, detail=f"Job is already {job.status}")
    job.status = "cancelled"
    db.commit()
    return {"success": True, "message": f"Job #{job_id} cancelled"}
