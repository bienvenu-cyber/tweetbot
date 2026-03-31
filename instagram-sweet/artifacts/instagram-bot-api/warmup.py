"""
Warm-up engine — simulates human-like Instagram activity to season new accounts.

Progression over ~7 days:
  Day 1-2: Feed browsing + likes only (0 DMs allowed)
  Day 3-4: + Stories + explore (3-5 DMs)
  Day 5-6: + Comments + profile visits (10-20 DMs)
  Day 7+:  Full activity (configured limit)

Runs every 30-60 min during "active hours" (8h-23h local).
"""

import logging
import random
import time
from datetime import datetime, timezone, timedelta
from typing import Optional

import db_proxy
from instagram_client import account_manager

logger = logging.getLogger("instagram_bot")

# --- Warm-up schedule per day ---
WARMUP_SCHEDULE = {
    # day: { actions: [...], dm_limit: int }
    1: {"actions": ["feed", "likes"], "dm_limit": 0},
    2: {"actions": ["feed", "likes"], "dm_limit": 0},
    3: {"actions": ["feed", "likes", "stories", "explore"], "dm_limit": 3},
    4: {"actions": ["feed", "likes", "stories", "explore"], "dm_limit": 5},
    5: {"actions": ["feed", "likes", "stories", "explore", "comments", "profiles"], "dm_limit": 10},
    6: {"actions": ["feed", "likes", "stories", "explore", "comments", "profiles"], "dm_limit": 20},
    7: {"actions": ["feed", "likes", "stories", "explore", "comments", "profiles"], "dm_limit": -1},  # -1 = full
}

ACTIVE_HOURS = (8, 23)  # Only run warmup between 8:00 and 23:00


def _human_delay(min_s: float = 3.0, max_s: float = 15.0):
    """Random human-like delay between actions."""
    time.sleep(random.uniform(min_s, max_s))


def _get_warmup_day(started_at: Optional[str]) -> int:
    """Calculate which warmup day we're on (1-based)."""
    if not started_at:
        return 0
    try:
        start = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        delta = datetime.now(timezone.utc) - start
        return min(delta.days + 1, 7)
    except Exception:
        return 0


def get_warmup_dm_limit(username: str) -> Optional[int]:
    """Returns the DM limit for this account based on warmup status.
    Returns None if warmup is not active (= use configured limit).
    Returns 0 to block DMs, or a reduced number.
    """
    account = db_proxy.select_first("bot_accounts", {"username": username.lower()})
    if not account:
        return None

    status = account.get("warmup_status", "idle")
    if status != "active":
        return None

    day = _get_warmup_day(account.get("warmup_started_at"))
    if day <= 0:
        return None

    schedule = WARMUP_SCHEDULE.get(day, WARMUP_SCHEDULE[7])
    limit = schedule["dm_limit"]
    return None if limit == -1 else limit


def get_warmup_info(username: str) -> dict:
    """Get warmup status info for an account."""
    account = db_proxy.select_first("bot_accounts", {"username": username.lower()})
    if not account:
        return {"status": "unknown", "day": 0, "dm_limit": None, "actions": []}

    status = account.get("warmup_status", "idle")
    day = _get_warmup_day(account.get("warmup_started_at"))

    if status != "active":
        return {"status": status, "day": 0, "dm_limit": None, "actions": []}

    schedule = WARMUP_SCHEDULE.get(day, WARMUP_SCHEDULE[7])
    dm_limit = schedule["dm_limit"]

    return {
        "status": status,
        "day": day,
        "total_days": 7,
        "dm_limit": None if dm_limit == -1 else dm_limit,
        "actions": schedule["actions"],
        "started_at": account.get("warmup_started_at"),
    }


def start_warmup(username: str) -> dict:
    """Start warmup for an account."""
    username = username.lower()
    account = db_proxy.select_first("bot_accounts", {"username": username})
    if not account:
        return {"success": False, "message": "Compte introuvable."}

    now = datetime.now(timezone.utc).isoformat()
    db_proxy.update("bot_accounts", account["id"], {
        "warmup_status": "active",
        "warmup_started_at": now,
        "warmup_day": 1,
    })
    logger.info(f"[WARMUP] Started for @{username}")
    return {"success": True, "message": f"Warm-up démarré pour @{username}. Durée : 7 jours."}


def stop_warmup(username: str) -> dict:
    """Stop warmup for an account."""
    username = username.lower()
    account = db_proxy.select_first("bot_accounts", {"username": username})
    if not account:
        return {"success": False, "message": "Compte introuvable."}

    db_proxy.update("bot_accounts", account["id"], {
        "warmup_status": "idle",
        "warmup_started_at": None,
        "warmup_day": 0,
    })
    logger.info(f"[WARMUP] Stopped for @{username}")
    return {"success": True, "message": f"Warm-up arrêté pour @{username}."}


# ---- Action executors ----

def _action_browse_feed(cl, username: str):
    """Scroll the timeline feed like a human."""
    try:
        feed = cl.get_timeline_feed()
        items = feed.get("feed_items", []) if isinstance(feed, dict) else []
        count = random.randint(3, 8)
        logger.info(f"[WARMUP] @{username} browsing feed ({count} items)")
        for i, item in enumerate(items[:count]):
            _human_delay(2, 8)
        return True
    except Exception as e:
        logger.warning(f"[WARMUP] @{username} feed browse failed: {e}")
        return False


def _action_like_posts(cl, username: str):
    """Like random posts from timeline."""
    try:
        feed_items = cl.get_timeline_feed()
        media_ids = []
        items = feed_items.get("feed_items", []) if isinstance(feed_items, dict) else []
        for item in items:
            media = item.get("media_or_ad")
            if media and media.get("pk"):
                media_ids.append(media["pk"])

        count = random.randint(2, 5)
        liked = 0
        for mid in random.sample(media_ids, min(count, len(media_ids))):
            try:
                cl.media_like(mid)
                liked += 1
                _human_delay(5, 20)
            except Exception:
                pass

        logger.info(f"[WARMUP] @{username} liked {liked} posts")
        return True
    except Exception as e:
        logger.warning(f"[WARMUP] @{username} like action failed: {e}")
        return False


def _action_watch_stories(cl, username: str):
    """Watch stories from followed accounts."""
    try:
        reels = cl.get_reels_tray_feed()
        trays = reels.get("tray", []) if isinstance(reels, dict) else []
        count = random.randint(2, 5)
        watched = 0
        for tray in trays[:count]:
            user_id = tray.get("user", {}).get("pk")
            if user_id:
                try:
                    stories = cl.user_stories(user_id)
                    if stories:
                        cl.story_seen([s.pk for s in stories[:3]])
                        watched += 1
                    _human_delay(3, 10)
                except Exception:
                    pass

        logger.info(f"[WARMUP] @{username} watched {watched} story trays")
        return True
    except Exception as e:
        logger.warning(f"[WARMUP] @{username} stories failed: {e}")
        return False


def _action_explore(cl, username: str):
    """Browse the explore page."""
    try:
        cl.explore_page()
        _human_delay(3, 8)
        logger.info(f"[WARMUP] @{username} browsed explore page")
        return True
    except Exception as e:
        logger.warning(f"[WARMUP] @{username} explore failed: {e}")
        return False


def _action_visit_profiles(cl, username: str):
    """Visit a few random user profiles."""
    try:
        feed_items = cl.get_timeline_feed()
        users = []
        items = feed_items.get("feed_items", []) if isinstance(feed_items, dict) else []
        for item in items:
            media = item.get("media_or_ad")
            if media and media.get("user", {}).get("pk"):
                users.append(media["user"]["pk"])

        count = random.randint(2, 4)
        visited = 0
        for uid in random.sample(users, min(count, len(users))):
            try:
                cl.user_info(uid)
                visited += 1
                _human_delay(5, 15)
            except Exception:
                pass

        logger.info(f"[WARMUP] @{username} visited {visited} profiles")
        return True
    except Exception as e:
        logger.warning(f"[WARMUP] @{username} profile visits failed: {e}")
        return False


def _action_comment(cl, username: str):
    """Leave a simple comment on a feed post."""
    generic_comments = [
        "🔥", "👏", "💯", "Trop bien !", "Super 👍", "J'adore 😍",
        "Magnifique ✨", "Top 🙌", "Wow 😮", "Incroyable 🤩",
        "Nice!", "Amazing!", "Love this ❤️", "Great content 💪",
    ]
    try:
        feed_items = cl.get_timeline_feed()
        items = feed_items.get("feed_items", []) if isinstance(feed_items, dict) else []
        media_ids = []
        for item in items:
            media = item.get("media_or_ad")
            if media and media.get("pk"):
                media_ids.append(media["pk"])

        if media_ids:
            mid = random.choice(media_ids[:10])
            comment = random.choice(generic_comments)
            cl.media_comment(mid, comment)
            _human_delay(5, 15)
            logger.info(f"[WARMUP] @{username} commented '{comment}' on a post")
            return True
        return False
    except Exception as e:
        logger.warning(f"[WARMUP] @{username} comment failed: {e}")
        return False


ACTION_MAP = {
    "feed": _action_browse_feed,
    "likes": _action_like_posts,
    "stories": _action_watch_stories,
    "explore": _action_explore,
    "profiles": _action_visit_profiles,
    "comments": _action_comment,
}


def run_warmup_cycle():
    """Main warmup loop — called by APScheduler every 30-60 min.
    Processes all accounts with warmup_status='active'.
    """
    now = datetime.now()
    hour = now.hour
    if hour < ACTIVE_HOURS[0] or hour >= ACTIVE_HOURS[1]:
        logger.debug("[WARMUP] Outside active hours, skipping")
        return

    accounts = db_proxy.select("bot_accounts", filters={"warmup_status": "active"})
    if not accounts:
        return

    logger.info(f"[WARMUP] Running warmup cycle for {len(accounts)} account(s)")

    for account in accounts:
        username = account["username"]
        day = _get_warmup_day(account.get("warmup_started_at"))

        if day > 7:
            # Warmup complete
            db_proxy.update("bot_accounts", account["id"], {
                "warmup_status": "completed",
                "warmup_day": 7,
            })
            logger.info(f"[WARMUP] ✅ @{username} warmup completed (day {day})")

            # Log it
            try:
                db_proxy.insert("bot_logs", {
                    "account_username": username,
                    "action_type": "warmup",
                    "status": "success",
                    "message": f"Warm-up terminé après 7 jours",
                })
            except Exception:
                pass
            continue

        # Update day in DB
        db_proxy.update("bot_accounts", account["id"], {"warmup_day": day})

        schedule = WARMUP_SCHEDULE.get(day, WARMUP_SCHEDULE[7])
        actions_for_day = schedule["actions"]

        # Get client
        cl = account_manager.get_client(username)
        if not cl:
            logger.warning(f"[WARMUP] @{username} — no client available, skipping")
            continue

        # Pick a random subset of allowed actions for this cycle
        num_actions = random.randint(2, min(4, len(actions_for_day)))
        selected_actions = random.sample(actions_for_day, num_actions)

        logger.info(f"[WARMUP] @{username} day {day} — executing: {selected_actions}")

        for action_name in selected_actions:
            executor = ACTION_MAP.get(action_name)
            if executor:
                try:
                    executor(cl, username)
                except Exception as e:
                    logger.error(f"[WARMUP] @{username} action '{action_name}' crashed: {e}")

                # Human-like pause between different action types
                _human_delay(10, 30)

        # Log the cycle
        try:
            db_proxy.insert("bot_logs", {
                "account_username": username,
                "action_type": "warmup",
                "status": "success",
                "message": f"Jour {day}/7 — actions: {', '.join(selected_actions)}",
            })
        except Exception:
            pass

        # Save refreshed session
        try:
            import json
            session_json = json.dumps(cl.get_settings(), default=str)
            db_proxy.update("bot_accounts", account["id"], {
                "session_data": session_json,
            })
        except Exception:
            pass

    logger.info("[WARMUP] Cycle complete")
