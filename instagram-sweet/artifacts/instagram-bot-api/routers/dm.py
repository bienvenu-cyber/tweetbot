import asyncio
import json
import random
import logging
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional

from instagram_client import account_manager
import db_proxy
from utils import get_daily_count, log_action
from routers.ws import broadcast_job_update
from instagram_errors import normalize_username, normalize_usernames, summarize_instagram_error, is_rate_limited

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_CONSECUTIVE_SEND_FAILURES = 3


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


def _resolve_recipient_id(cl, username: str) -> int:
    clean_username = normalize_username(username)
    last_error: Exception | None = None

    resolvers = [
        lambda: cl.user_id_from_username(clean_username),
        lambda: getattr(cl.user_info_by_username(clean_username), "pk", None),
    ]

    if hasattr(cl, "user_info_by_username_v1"):
        resolvers.insert(1, lambda: getattr(cl.user_info_by_username_v1(clean_username), "pk", None))

    for resolver in resolvers:
        try:
            value = resolver()
            if value:
                return int(value)
        except Exception as exc:
            last_error = exc
            logger.warning(f"[DM] Could not resolve @{clean_username}: {exc}")

    if last_error:
        raise last_error

    raise ValueError(f"Impossible de résoudre @{clean_username}")


def _job_payload(job_id: int, job: dict) -> dict:
    return {
        "job_id": job.get("id", job_id),
        "status": job.get("status"),
        "total": job.get("total"),
        "processed": job.get("processed"),
        "succeeded": job.get("succeeded"),
        "failed": job.get("failed"),
        "message": job.get("message"),
    }


def _broadcast_sync(job_id: int, job: dict):
    try:
        asyncio.run(broadcast_job_update(job_id, _job_payload(job_id, job)))
    except Exception:
        pass


def _is_dm_blocked_error(error: Exception | str) -> bool:
    """Detect if Instagram is blocking DM sending (not just a user-level error)."""
    lowered = str(error).lower()
    return "threads/broadcast/text" in lowered or ("400 client error" in lowered and "direct_v2" in lowered)


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
    except Exception as exc:
        detail = summarize_instagram_error(exc, context="dm_threads")
        logger.error(f"Error fetching threads: {exc}")
        raise HTTPException(status_code=429 if is_rate_limited(exc) else 503, detail=detail)


@router.post("/send")
def send_dm(req: SendDmRequest):
    clean_username = normalize_username(req.username)
    cl = account_manager.get_client(req.account_username)
    if not cl:
        raise HTTPException(status_code=401, detail="Not logged in")

    settings = db_proxy.select_first("bot_settings", {"id": "1"})
    daily_limit = settings.get("dm_daily_limit", 50) if settings else 50
    daily_count = get_daily_count("dm_send")

    if daily_count >= daily_limit:
        log_action("dm_send", clean_username, "failed", f"Daily limit reached ({daily_limit})", account_username=req.account_username)
        raise HTTPException(status_code=429, detail=f"Daily DM limit reached ({daily_limit})")

    try:
        user_id = _resolve_recipient_id(cl, clean_username)
        cl.direct_send(req.message, user_ids=[int(user_id)])
        log_action("dm_send", clean_username, "success", f"DM sent: {req.message[:50]}", account_username=req.account_username)
        return {"success": True, "message": f"DM sent to @{clean_username}"}
    except Exception as exc:
        detail = summarize_instagram_error(exc, context="dm_send")
        log_action("dm_send", clean_username, "failed", detail, account_username=req.account_username)
        raise HTTPException(status_code=429 if is_rate_limited(exc) else 503, detail=detail)


def _bulk_send_sync(job_id: int, usernames: List[str], message: str, delay_min: int, delay_max: int, account_username: Optional[str], skip_already_sent: bool = True, start_index: int = 0):
    import time

    usernames = normalize_usernames(usernames)
    settings = db_proxy.select_first("bot_settings", {"id": "1"})
    daily_limit = settings.get("dm_daily_limit", 50) if settings else 50

    job = db_proxy.select_one("bot_bulk_jobs", job_id)
    if not job:
        return

    already_sent: set[str] = set()
    if skip_already_sent:
        try:
            logs = db_proxy.select("bot_logs", filters={"action_type": "dm_send", "status": "success"}, limit=1000)
            already_sent = {normalize_username(log.get("target", "")) for log in logs if log.get("target")}
        except Exception:
            already_sent = set()

    skipped = 0
    stop_reason: Optional[str] = None
    last_error: Optional[str] = None
    consecutive_send_failures = 0

    for index, username in enumerate(usernames):
        # Skip already-processed entries on resume
        if index < start_index:
            continue

        job = db_proxy.select_one("bot_bulk_jobs", job_id)
        if not job:
            return
        if job.get("status") == "cancelled":
            stop_reason = "Campagne annulée."
            break

        processed = job.get("processed", 0) or 0
        succeeded = job.get("succeeded", 0) or 0
        failed = job.get("failed", 0) or 0

        if username in already_sent:
            skipped += 1
            processed += 1
            updated = db_proxy.update("bot_bulk_jobs", job_id, {
                "processed": processed,
                "succeeded": succeeded,
                "failed": failed,
                "message": f"{processed}/{len(usernames)} traités — {skipped} doublons ignorés",
            })
            _broadcast_sync(job_id, updated)
            continue

        cl = account_manager.get_client(account_username)
        if not cl:
            stop_reason = "Session Instagram du compte expéditeur indisponible."
            updated = db_proxy.update("bot_bulk_jobs", job_id, {"status": "failed", "message": stop_reason})
            _broadcast_sync(job_id, updated)
            break

        daily_count = get_daily_count("dm_send")
        if daily_count >= daily_limit:
            stop_reason = f"Arrêt à la limite quotidienne ({daily_limit})."
            break

        try:
            user_id = _resolve_recipient_id(cl, username)
            cl.direct_send(message, user_ids=[int(user_id)])
            succeeded += 1
            already_sent.add(username)
            consecutive_send_failures = 0
        except Exception as exc:
            failed += 1
            last_error = summarize_instagram_error(exc, context="dm_send")

            if _is_dm_blocked_error(exc):
                consecutive_send_failures += 1
                if consecutive_send_failures >= MAX_CONSECUTIVE_SEND_FAILURES:
                    stop_reason = (
                        f"Instagram bloque l'envoi de DM depuis cette session "
                        f"({consecutive_send_failures} échecs consécutifs). "
                        f"Réimporte les cookies du compte puis réessaie."
                    )
                    break
            else:
                consecutive_send_failures = 0

        processed += 1
        updated = db_proxy.update("bot_bulk_jobs", job_id, {
            "processed": processed,
            "succeeded": succeeded,
            "failed": failed,
            "message": f"{processed}/{len(usernames)} traités",
        })
        _broadcast_sync(job_id, updated)

        if index < len(usernames) - 1:
            time.sleep(random.randint(delay_min, delay_max))

    final_job = db_proxy.select_one("bot_bulk_jobs", job_id) or {"id": job_id, "total": len(usernames), "processed": 0, "succeeded": 0, "failed": 0, "status": "running"}
    final_status = final_job.get("status")

    if final_status == "cancelled":
        summary_status = "info"
        summary_message = stop_reason or f"Campagne annulée — {final_job.get('processed', 0)}/{len(usernames)} traités."
    elif final_status == "failed":
        summary_status = "failed"
        summary_message = stop_reason or last_error or "Campagne interrompue."
    elif stop_reason:
        final_status = "failed"
        summary_status = "failed"
        summary_message = stop_reason
    else:
        final_status = "completed"
        summary_status = "success" if (final_job.get("failed", 0) or 0) == 0 else "failed"
        summary_message = (
            f"Campagne terminée — {final_job.get('succeeded', 0) or 0} envoyés, "
            f"{final_job.get('failed', 0) or 0} échecs, {skipped} doublons ignorés."
        )

    updated = db_proxy.update("bot_bulk_jobs", job_id, {
        "status": final_status,
        "message": summary_message,
    })
    _broadcast_sync(job_id, updated)
    log_action("bulk_dm", str(len(usernames)), summary_status, summary_message, account_username=account_username)


async def bulk_send_task(job_id: int, usernames: List[str], message: str, delay_min: int, delay_max: int, account_username: Optional[str], skip_already_sent: bool = True, start_index: int = 0):
    await asyncio.to_thread(_bulk_send_sync, job_id, usernames, message, delay_min, delay_max, account_username, skip_already_sent, start_index)


@router.post("/bulk-send")
async def bulk_send_dm(req: BulkSendDmRequest):
    cl = account_manager.get_client(req.account_username)
    if not cl:
        raise HTTPException(status_code=401, detail="Not logged in")

    usernames = normalize_usernames(req.usernames)
    if not usernames:
        raise HTTPException(status_code=400, detail="No usernames provided")
    if req.delay_min > req.delay_max:
        raise HTTPException(status_code=400, detail="delay_min must be <= delay_max")

    job = db_proxy.insert("bot_bulk_jobs", {
        "job_type": "bulk_dm",
        "status": "running",
        "total": len(usernames),
        "account_username": req.account_username,
        "processed": 0,
        "succeeded": 0,
        "failed": 0,
        "message": "Campagne démarrée",
        "payload": json.dumps({
            "usernames": usernames,
            "message": req.message,
            "delay_min": req.delay_min,
            "delay_max": req.delay_max,
        }),
    })

    job_id = job.get("id")
    log_action("bulk_dm", str(len(usernames)), "info", f"Campagne DM lancée pour {len(usernames)} destinataires", account_username=req.account_username)

    asyncio.create_task(bulk_send_task(job_id, usernames, req.message, req.delay_min, req.delay_max, req.account_username, True))

    return {
        "success": True,
        "job_id": job_id,
        "queued": len(usernames),
        "message": f"Bulk DM job #{job_id} started",
    }


def resume_interrupted_jobs():
    """Called at startup to resume any bulk jobs left in 'running' state."""
    try:
        jobs = db_proxy.select("bot_bulk_jobs", filters={"status": "running"}, limit=10)
        if not jobs:
            logger.info("[RESUME] No interrupted bulk jobs found")
            return

        for job in jobs:
            job_id = job.get("id")
            payload_raw = job.get("payload")
            if not payload_raw:
                logger.warning(f"[RESUME] Job #{job_id} has no payload, marking as failed")
                db_proxy.update("bot_bulk_jobs", job_id, {"status": "failed", "message": "Impossible de reprendre : données manquantes."})
                continue

            try:
                payload = json.loads(payload_raw) if isinstance(payload_raw, str) else payload_raw
            except (json.JSONDecodeError, TypeError):
                logger.warning(f"[RESUME] Job #{job_id} has invalid payload")
                db_proxy.update("bot_bulk_jobs", job_id, {"status": "failed", "message": "Impossible de reprendre : données invalides."})
                continue

            usernames = payload.get("usernames", [])
            message = payload.get("message", "")
            delay_min = payload.get("delay_min", 30)
            delay_max = payload.get("delay_max", 120)
            account_username = job.get("account_username")
            processed = job.get("processed", 0) or 0

            if not usernames or not message:
                db_proxy.update("bot_bulk_jobs", job_id, {"status": "failed", "message": "Impossible de reprendre : données incomplètes."})
                continue

            logger.info(f"[RESUME] Resuming job #{job_id} from index {processed}/{len(usernames)}")
            db_proxy.update("bot_bulk_jobs", job_id, {"message": f"Reprise après redémarrage — {processed}/{len(usernames)} déjà traités"})

            asyncio.create_task(bulk_send_task(
                job_id, usernames, message, delay_min, delay_max,
                account_username, skip_already_sent=True, start_index=processed,
            ))

    except Exception as exc:
        logger.error(f"[RESUME] Failed to resume jobs: {exc}")


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
    updated = db_proxy.update("bot_bulk_jobs", job_id, {"status": "cancelled", "message": "Campagne annulée"})
    _broadcast_sync(job_id, updated)
    return {"success": True, "message": f"Job #{job_id} cancelled"}
