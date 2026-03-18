import logging
import random
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from instagram_errors import normalize_username

logger = logging.getLogger("instagram_bot")

_ACTION_LABELS = {
    "inbox": "lecture des DMs",
    "send": "envoi de DM",
}

_BASE_COOLDOWN_MINUTES = {
    "inbox": 20,
    "send": 60,
}

_MAX_COOLDOWN_MINUTES = {
    "inbox": 180,
    "send": 360,
}

_DELAY_RANGES_SECONDS = {
    "inbox": (2.5, 5.0),
    "send": (1.5, 3.5),
}

_state: dict[str, dict[str, dict[str, object]]] = {}


def _account_key(account_username: Optional[str]) -> str:
    if not account_username:
        return "session_active"
    return normalize_username(account_username) or "session_active"


def _get_state(account_username: Optional[str], action: str) -> dict[str, object]:
    account_key = _account_key(account_username)
    account_state = _state.setdefault(account_key, {})
    return account_state.setdefault(action, {
        "failures": 0,
        "blocked_until": None,
        "last_reason": None,
    })


def should_back_off_for_dm_error(error: Exception | str) -> bool:
    lowered = str(error).lower()
    triggers = (
        "direct_v2/inbox",
        "threads/broadcast/text",
        "feedback_required",
        "defcon",
        "too many 429 error responses",
        " 429 ",
        "rate limit",
        "temporarily unavailable",
        "please wait",
        "spam",
        "try again later",
    )
    return any(trigger in lowered for trigger in triggers)


def get_cooldown_message(account_username: Optional[str], action: str) -> Optional[str]:
    state = _get_state(account_username, action)
    blocked_until = state.get("blocked_until")

    if not isinstance(blocked_until, datetime):
        return None

    now = datetime.now(timezone.utc)
    if blocked_until <= now:
        state["blocked_until"] = None
        return None

    remaining_seconds = int((blocked_until - now).total_seconds())
    remaining_minutes = max(1, (remaining_seconds + 59) // 60)
    label = _ACTION_LABELS.get(action, action)
    reason = str(state.get("last_reason") or "Instagram a temporairement restreint cette action.")

    if account_username:
        return f"Le compte @{_account_key(account_username)} est en pause pour la {label} pendant encore ~{remaining_minutes} min. {reason}"

    return f"La session Instagram active est en pause pour la {label} pendant encore ~{remaining_minutes} min. {reason}"


def wait_before_dm_action(account_username: Optional[str], action: str):
    state = _get_state(account_username, action)
    delay_min, delay_max = _DELAY_RANGES_SECONDS.get(action, (2.0, 4.0))
    failure_penalty = min(int(state.get("failures") or 0), 3) * 2
    delay_seconds = random.uniform(delay_min, delay_max) + failure_penalty

    logger.info(
        f"[DM GUARD] Waiting {delay_seconds:.1f}s before {action} for @{_account_key(account_username)}"
    )
    time.sleep(delay_seconds)


def register_dm_success(account_username: Optional[str], action: str):
    state = _get_state(account_username, action)
    state["failures"] = 0
    state["blocked_until"] = None
    state["last_reason"] = None


def register_dm_failure(account_username: Optional[str], action: str, reason: str) -> str:
    state = _get_state(account_username, action)
    failures = int(state.get("failures") or 0) + 1
    state["failures"] = failures
    state["last_reason"] = reason.strip() or "Instagram a temporairement restreint cette action."

    base_minutes = _BASE_COOLDOWN_MINUTES.get(action, 30)
    max_minutes = _MAX_COOLDOWN_MINUTES.get(action, 180)
    cooldown_minutes = min(base_minutes * (2 ** (failures - 1)), max_minutes)
    blocked_until = datetime.now(timezone.utc) + timedelta(minutes=cooldown_minutes)
    state["blocked_until"] = blocked_until

    logger.warning(
        f"[DM GUARD] Cooldown activated for @{_account_key(account_username)} / {action}: "
        f"{cooldown_minutes} min after failure #{failures}"
    )

    return get_cooldown_message(account_username, action) or state["last_reason"]
