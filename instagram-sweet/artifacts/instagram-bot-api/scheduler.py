"""
Post scheduler — HTTP proxy version.
"""

import logging
import requests
import tempfile
import os
from datetime import datetime, timezone

import db_proxy
from instagram_client import account_manager
from utils import get_daily_count, log_action, validate_image_url

logger = logging.getLogger("instagram_bot")


def process_scheduled_posts():
    try:
        now = datetime.now(timezone.utc)
        pending = db_proxy.select("bot_scheduled_posts", filters={
            "status": "pending",
            "scheduled_at__lte": now.isoformat(),
        }, order="scheduled_at.asc", limit=5)

        if not pending:
            return

        logger.info(f"[SCHEDULER] Found {len(pending)} scheduled posts due")

        settings = db_proxy.select_first("bot_settings", {"id": "1"})
        daily_limit = settings.get("post_daily_limit", 3) if settings else 3

        for post in pending:
            daily_count = get_daily_count("post")
            if daily_count >= daily_limit:
                logger.warning(f"[SCHEDULER] Daily post limit reached ({daily_limit}), skipping remaining")
                break

            post_id = post.get("id")
            account_username = post.get("account_username")

            cl = account_manager.get_client(account_username)
            if not cl:
                db_proxy.update("bot_scheduled_posts", post_id, {
                    "status": "failed",
                    "error_message": f"Account @{account_username} not logged in",
                })
                logger.error(f"[SCHEDULER] No client for @{account_username}")
                continue

            try:
                validate_image_url(post.get("image_url", ""))
            except ValueError as e:
                db_proxy.update("bot_scheduled_posts", post_id, {
                    "status": "failed",
                    "error_message": str(e),
                })
                continue

            tmp_path = None
            try:
                response = requests.get(post["image_url"], timeout=30)
                response.raise_for_status()

                with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                    tmp.write(response.content)
                    tmp_path = tmp.name

                cl.photo_upload(tmp_path, post.get("caption", ""))

                db_proxy.update("bot_scheduled_posts", post_id, {
                    "status": "published",
                    "published_at": datetime.now(timezone.utc).isoformat(),
                })
                log_action("scheduled_post", "photo", "success",
                           f"Scheduled post published for @{account_username}: {post.get('caption', '')[:80]}")
                logger.info(f"[SCHEDULER] ✓ Published post #{post_id} for @{account_username}")

            except Exception as e:
                db_proxy.update("bot_scheduled_posts", post_id, {
                    "status": "failed",
                    "error_message": str(e),
                })
                log_action("scheduled_post", "photo", "error",
                           f"Failed for @{account_username}: {e}")
                logger.error(f"[SCHEDULER] ✗ Post #{post_id} failed: {e}")

            finally:
                if tmp_path and os.path.exists(tmp_path):
                    os.unlink(tmp_path)

    except Exception as e:
        logger.error(f"[SCHEDULER] Error: {e}")
