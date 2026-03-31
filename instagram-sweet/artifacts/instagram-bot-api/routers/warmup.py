"""Warmup API routes."""

import logging
from fastapi import APIRouter
from warmup import start_warmup, stop_warmup, get_warmup_info, get_warmup_dm_limit

logger = logging.getLogger("instagram_bot")
router = APIRouter()


@router.get("/{username}")
def get_warmup_status(username: str):
    """Get warmup status for a specific account."""
    return get_warmup_info(username)


@router.post("/{username}/start")
def start_account_warmup(username: str):
    """Start warmup for an account."""
    return start_warmup(username)


@router.post("/{username}/stop")
def stop_account_warmup(username: str):
    """Stop warmup for an account."""
    return stop_warmup(username)
