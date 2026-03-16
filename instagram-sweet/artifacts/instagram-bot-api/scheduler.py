"""
Post scheduler — checks for pending scheduled posts and publishes them.
Uses APScheduler to run every 60 seconds.
"""

import logging
import requests
import tempfile
import os
from datetime import datetime, timezone

from database import SessionLocal, ScheduledPost, BotSettingsModel
from instagram_client import account_manager
from utils import get_daily_count, log_action, validate_image_url

logger = logging.getLogger("instagram_bot")


def process_scheduled_posts():
    """Check for pending scheduled posts that are due and publish them."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        pending = (
            db.query(ScheduledPost)
            .filter(ScheduledPost.status == "pending", ScheduledPost.scheduled_at <= now)
            .order_by(ScheduledPost.scheduled_at.asc())
            .limit(5)  # Process max 5 at a time
            .all()
        )

        if not pending:
            return

        logger.info(f"[SCHEDULER] Found {len(pending)} scheduled posts due")

        settings = db.query(BotSettingsModel).filter(BotSettingsModel.id == 1).first()
        daily_limit = settings.post_daily_limit if settings else 3

        for post in pending:
            daily_count = get_daily_count(db, "post")
            if daily_count >= daily_limit:
                logger.warning(f"[SCHEDULER] Daily post limit reached ({daily_limit}), skipping remaining")
                break

            # Get client for the specified account
            cl = account_manager.get_client(post.account_username)
            if not cl:
                post.status = "failed"
                post.error_message = f"Account @{post.account_username} not logged in"
                db.commit()
                logger.error(f"[SCHEDULER] No client for @{post.account_username}")
                continue

            # Validate URL
            try:
                validate_image_url(post.image_url)
            except ValueError as e:
                post.status = "failed"
                post.error_message = str(e)
                db.commit()
                continue

            tmp_path = None
            try:
                response = requests.get(post.image_url, timeout=30)
                response.raise_for_status()

                with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                    tmp.write(response.content)
                    tmp_path = tmp.name

                cl.photo_upload(tmp_path, post.caption)

                post.status = "published"
                post.published_at = datetime.now(timezone.utc)
                log_action(db, "scheduled_post", "photo", "success",
                           f"Scheduled post published for @{post.account_username}: {post.caption[:80]}")
                logger.info(f"[SCHEDULER] ✓ Published post #{post.id} for @{post.account_username}")

            except Exception as e:
                post.status = "failed"
                post.error_message = str(e)
                log_action(db, "scheduled_post", "photo", "error",
                           f"Failed for @{post.account_username}: {e}")
                logger.error(f"[SCHEDULER] ✗ Post #{post.id} failed: {e}")

            finally:
                if tmp_path and os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                db.commit()

    except Exception as e:
        logger.error(f"[SCHEDULER] Error: {e}")
    finally:
        db.close()
