import asyncio
import random
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional

from instagram_client import account_manager
import db_proxy
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
def send_dm(req: SendDmRequest):
    cl = account_manager.get_client(req.account_username)
    if not cl:
        raise HTTPException(status_code=401, detail="Not logged in")

    settings = db_proxy.select_first("bot_settings", {"id": "1"})
    daily_limit = settings.get("dm_daily_limit", 50) if settings else 50
    daily_count = get_daily_count("dm_send")

    if daily_count >= daily_limit:
        log_action("dm_send", req.username, "blocked", f"Daily limit reached ({daily_limit})")
        raise HTTPException(status_code=429, detail=f"Daily DM limit reached ({daily_limit})")

    try:
        user_id = cl.user_id_from_username(req.username)
        cl.direct_send(req.message, user_ids=[user_id])
        log_action("dm_send", req.username, "success", f"DM sent: {req.message[:50]}")
        return {"success": True, "message": f"DM sent to @{req.username}"}
    except Exception as e:
        log_action("dm_send", req.username, "error", str(e))
        raise HTTPException(status_code=500, detail=str(e))


def _get_already_messaged_usernames() -> set:
    """Get usernames that already received a successful DM to avoid duplicates."""
    try:
        logs = db_proxy.select("bot_logs", filters={"action_type": "dm_send", "status": "success"}, limit=1000)
        return {log.get("target", "").lower() for log in logs if log.get("target")}
    except Exception:
        return set()


def _bulk_send_sync(job_id: int, usernames: List[str], message: str, delay_min: int, delay_max: int, account_username: Optional[str], skip_already_sent: bool = True):
    import time
    loop = asyncio.new_event_loop()
    try:
        job = db_proxy.select_one("bot_bulk_jobs", job_id)
        if not job:
            return

        settings = db_proxy.select_first("bot_settings", {"id": "1"})
        daily_limit = settings.get("dm_daily_limit", 50) if settings else 50

        # Dedup: skip users already messaged
        already_sent = _get_already_messaged_usernames() if skip_already_sent else set()
        skipped = 0

        for i, username in enumerate(usernames):
            # Refresh job status
            job = db_proxy.select_one("bot_bulk_jobs", job_id)
            if not job or job.get("status") == "cancelled":
                break

            # Skip already messaged
            if username.lower() in already_sent:
                skipped += 1
                log_action("dm_send", username, "skipped", "Already messaged in a previous campaign")
                processed = job.get("processed", 0) + 1
                db_proxy.update("bot_bulk_jobs", job_id, {"processed": processed, "message": f"Skipped {skipped} duplicates"})
                continue

            cl = account_manager.get_client(account_username)
            if not cl:
                db_proxy.update("bot_bulk_jobs", job_id, {"status": "failed", "message": "Client disconnected"})
                _broadcast_sync(loop, job_id, {**job, "status": "failed", "message": "Client disconnected"})
                break

            daily_count = get_daily_count("dm_send")
            if daily_count >= daily_limit:
                log_action("dm_send", username, "blocked", f"Daily limit reached ({daily_limit})")
                db_proxy.update("bot_bulk_jobs", job_id, {"status": "completed", "message": f"Stopped at daily limit ({daily_limit})"})
                break

            succeeded = job.get("succeeded", 0)
            failed = job.get("failed", 0)
            processed = job.get("processed", 0)

            try:
                user_id = cl.user_id_from_username(username)
                cl.direct_send(message, user_ids=[user_id])
                log_action("dm_send", username, "success", f"Bulk DM sent: {message[:50]}")
                succeeded += 1
                already_sent.add(username.lower())  # Add to dedup set
            except Exception as e:
                log_action("dm_send", username, "error", str(e))
                failed += 1

            processed += 1
            updated = db_proxy.update("bot_bulk_jobs", job_id, {
                "processed": processed,
                "succeeded": succeeded,
                "failed": failed,
            })
            _broadcast_sync(loop, job_id, updated)

            if i < len(usernames) - 1:
                delay = random.randint(delay_min, delay_max)
                time.sleep(delay)

        # Final status
        job = db_proxy.select_one("bot_bulk_jobs", job_id)
        if job and job.get("status") == "running":
            final_msg = f"Done. Skipped {skipped} duplicates." if skipped > 0 else "Done."
            db_proxy.update("bot_bulk_jobs", job_id, {"status": "completed", "message": final_msg})
    finally:
        loop.close()


def _broadcast_sync(loop, job_id, job):
    try:
        data = {
            "job_id": job.get("id", job_id),
            "status": job.get("status"),
            "total": job.get("total"),
            "processed": job.get("processed"),
            "succeeded": job.get("succeeded"),
            "failed": job.get("failed"),
            "message": job.get("message"),
        }
        asyncio.run_coroutine_threadsafe(broadcast_job_update(job_id, data), asyncio.get_event_loop())
    except Exception:
        pass


async def bulk_send_task(job_id: int, usernames: List[str], message: str, delay_min: int, delay_max: int, account_username: Optional[str], skip_already_sent: bool = True):
    await asyncio.to_thread(_bulk_send_sync, job_id, usernames, message, delay_min, delay_max, account_username, skip_already_sent)


@router.post("/bulk-send")
async def bulk_send_dm(req: BulkSendDmRequest):
    cl = account_manager.get_client(req.account_username)
    if not cl:
        raise HTTPException(status_code=401, detail="Not logged in")

    if not req.usernames:
        raise HTTPException(status_code=400, detail="No usernames provided")
    if req.delay_min > req.delay_max:
        raise HTTPException(status_code=400, detail="delay_min must be <= delay_max")

    job = db_proxy.insert("bot_bulk_jobs", {
        "job_type": "bulk_dm",
        "status": "running",
        "total": len(req.usernames),
        "account_username": req.account_username,
        "processed": 0,
        "succeeded": 0,
        "failed": 0,
    })

    job_id = job.get("id")
    log_action("bulk_dm_start", f"{len(req.usernames)} users", "queued",
               f"Bulk DM job #{job_id} started for {len(req.usernames)} users")

    asyncio.create_task(bulk_send_task(job_id, req.usernames, req.message, req.delay_min, req.delay_max, req.account_username))

    return {
        "success": True,
        "job_id": job_id,
        "queued": len(req.usernames),
        "message": f"Bulk DM job #{job_id} started — connect to /bot-api/ws/bulk-jobs/{job_id} for live updates",
    }


@router.get("/bulk-jobs")
def get_bulk_jobs():
    jobs = db_proxy.select("bot_bulk_jobs", filters={"job_type": "bulk_dm"}, order="created_at.desc", limit=20)
    return {
        "jobs": [
            {
                "id": j.get("id"),
                "status": j.get("status"),
                "total": j.get("total"),
                "processed": j.get("processed"),
                "succeeded": j.get("succeeded"),
                "failed": j.get("failed"),
                "message": j.get("message"),
                "account_username": j.get("account_username"),
                "created_at": j.get("created_at"),
            }
            for j in jobs
        ]
    }


@router.post("/bulk-jobs/{job_id}/cancel")
def cancel_bulk_job(job_id: int):
    job = db_proxy.select_one("bot_bulk_jobs", job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("status") != "running":
        raise HTTPException(status_code=400, detail=f"Job is already {job.get('status')}")
    db_proxy.update("bot_bulk_jobs", job_id, {"status": "cancelled"})
    return {"success": True, "message": f"Job #{job_id} cancelled"}
