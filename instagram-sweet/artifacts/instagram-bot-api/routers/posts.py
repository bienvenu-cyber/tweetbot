import logging
import requests
import tempfile
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from instagram_client import account_manager
from database import get_db, BotSettingsModel, ScheduledPost
from utils import get_daily_count, log_action, validate_image_url

logger = logging.getLogger(__name__)
router = APIRouter()


class CreatePostRequest(BaseModel):
    image_url: str
    caption: str
    schedule_at: Optional[str] = None
    account_username: Optional[str] = None


@router.post("/create")
def create_post(req: CreatePostRequest, db: Session = Depends(get_db)):
    # Validate image URL
    try:
        validate_image_url(req.image_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # If scheduled, save to DB and let the scheduler handle it
    if req.schedule_at:
        try:
            scheduled_time = datetime.fromisoformat(req.schedule_at.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Format de date invalide. Utilisez ISO 8601.")

        if scheduled_time <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="La date de planification doit être dans le futur.")

        # Determine account
        account_username = req.account_username
        if not account_username:
            cl = account_manager.get_client()
            if not cl:
                raise HTTPException(status_code=401, detail="Not logged in")
            try:
                account_username = cl.account_info().username.lower()
            except Exception:
                raise HTTPException(status_code=401, detail="Could not determine account")

        scheduled = ScheduledPost(
            account_username=account_username,
            image_url=req.image_url,
            caption=req.caption,
            scheduled_at=scheduled_time,
        )
        db.add(scheduled)
        db.commit()
        db.refresh(scheduled)

        log_action(db, "post", "photo", "scheduled",
                   f"Post scheduled for {scheduled_time.isoformat()} by @{account_username}")

        return {
            "success": True,
            "scheduled": True,
            "post_id": scheduled.id,
            "scheduled_at": scheduled_time.isoformat(),
            "message": f"Post planifié pour {scheduled_time.isoformat()}",
        }

    # Immediate post
    cl = account_manager.get_client(req.account_username)
    if not cl:
        raise HTTPException(status_code=401, detail="Not logged in")

    settings = db.query(BotSettingsModel).filter(BotSettingsModel.id == 1).first()
    daily_limit = settings.post_daily_limit if settings else 3
    daily_count = get_daily_count(db, "post")

    if daily_count >= daily_limit:
        log_action(db, "post", "photo", "blocked", f"Daily limit reached ({daily_limit})")
        raise HTTPException(status_code=429, detail=f"Daily post limit reached ({daily_limit})")

    tmp_path = None
    try:
        response = requests.get(req.image_url, timeout=30)
        response.raise_for_status()

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name

        cl.photo_upload(tmp_path, req.caption)

        log_action(db, "post", "photo", "success", f"Post created: {req.caption[:80]}")
        return {"success": True, "message": "Post created successfully"}
    except Exception as e:
        log_action(db, "post", "photo", "error", str(e))
        logger.error(f"Error creating post: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.get("/scheduled")
def get_scheduled_posts(db: Session = Depends(get_db)):
    """List all scheduled posts."""
    posts = db.query(ScheduledPost).order_by(ScheduledPost.scheduled_at.asc()).all()
    return {
        "posts": [
            {
                "id": p.id,
                "account_username": p.account_username,
                "image_url": p.image_url,
                "caption": p.caption[:100],
                "scheduled_at": p.scheduled_at.isoformat() if p.scheduled_at else None,
                "status": p.status,
                "error_message": p.error_message,
                "published_at": p.published_at.isoformat() if p.published_at else None,
            }
            for p in posts
        ]
    }


@router.delete("/scheduled/{post_id}")
def cancel_scheduled_post(post_id: int, db: Session = Depends(get_db)):
    """Cancel a pending scheduled post."""
    post = db.query(ScheduledPost).filter(ScheduledPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.status != "pending":
        raise HTTPException(status_code=400, detail=f"Post is already {post.status}")
    db.delete(post)
    db.commit()
    return {"success": True, "message": f"Scheduled post #{post_id} cancelled"}
