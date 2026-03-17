import logging
import requests
import tempfile
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from instagram_client import account_manager
import db_proxy
from utils import get_daily_count, log_action, validate_image_url

logger = logging.getLogger(__name__)
router = APIRouter()


class CreatePostRequest(BaseModel):
    image_url: str
    caption: str
    schedule_at: Optional[str] = None
    account_username: Optional[str] = None


@router.post("/create")
def create_post(req: CreatePostRequest):
    try:
        validate_image_url(req.image_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if req.schedule_at:
        try:
            scheduled_time = datetime.fromisoformat(req.schedule_at.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Format de date invalide. Utilisez ISO 8601.")

        if scheduled_time <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="La date de planification doit être dans le futur.")

        account_username = req.account_username
        if not account_username:
            cl = account_manager.get_client()
            if not cl:
                raise HTTPException(status_code=401, detail="Not logged in")
            try:
                account_username = cl.account_info().username.lower()
            except Exception:
                raise HTTPException(status_code=401, detail="Could not determine account")

        scheduled = db_proxy.insert("bot_scheduled_posts", {
            "account_username": account_username,
            "image_url": req.image_url,
            "caption": req.caption,
            "scheduled_at": scheduled_time.isoformat(),
            "status": "pending",
        })

        log_action("post", "photo", "scheduled",
                   f"Post scheduled for {scheduled_time.isoformat()} by @{account_username}")

        return {
            "success": True,
            "scheduled": True,
            "post_id": scheduled.get("id"),
            "scheduled_at": scheduled_time.isoformat(),
            "message": f"Post planifié pour {scheduled_time.isoformat()}",
        }

    # Immediate post
    cl = account_manager.get_client(req.account_username)
    if not cl:
        raise HTTPException(status_code=401, detail="Not logged in")

    settings = db_proxy.select_first("bot_settings", {"id": "1"})
    daily_limit = settings.get("post_daily_limit", 3) if settings else 3
    daily_count = get_daily_count("post")

    if daily_count >= daily_limit:
        log_action("post", "photo", "blocked", f"Daily limit reached ({daily_limit})")
        raise HTTPException(status_code=429, detail=f"Daily post limit reached ({daily_limit})")

    tmp_path = None
    try:
        response = requests.get(req.image_url, timeout=30)
        response.raise_for_status()

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name

        cl.photo_upload(tmp_path, req.caption)

        log_action("post", "photo", "success", f"Post created: {req.caption[:80]}")
        return {"success": True, "message": "Post created successfully"}
    except Exception as e:
        log_action("post", "photo", "error", str(e))
        logger.error(f"Error creating post: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.get("/scheduled")
def get_scheduled_posts():
    posts = db_proxy.select("bot_scheduled_posts", order="scheduled_at.asc")
    return {
        "posts": [
            {
                "id": p.get("id"),
                "account_username": p.get("account_username"),
                "image_url": p.get("image_url"),
                "caption": (p.get("caption") or "")[:100],
                "scheduled_at": p.get("scheduled_at"),
                "status": p.get("status"),
                "error_message": p.get("error_message"),
                "published_at": p.get("published_at"),
            }
            for p in posts
        ]
    }


@router.delete("/scheduled/{post_id}")
def cancel_scheduled_post(post_id: int):
    post = db_proxy.select_one("bot_scheduled_posts", post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Post is already {post.get('status')}")
    db_proxy.delete("bot_scheduled_posts", post_id)
    return {"success": True, "message": f"Scheduled post #{post_id} cancelled"}
