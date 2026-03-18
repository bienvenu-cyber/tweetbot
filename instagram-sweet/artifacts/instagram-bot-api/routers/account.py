import logging
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from instagram_client import account_manager
import db_proxy
from instagram_errors import normalize_username, summarize_instagram_error, is_rate_limited

logger = logging.getLogger("instagram_bot")
router = APIRouter()


def _resolve_target_user(cl, account_username: str):
    target_username = normalize_username(account_username)
    last_error: Exception | None = None

    logger.info(f"[FOLLOWERS] Looking up @{target_username} via active client")

    resolvers = []
    if hasattr(cl, "user_info_by_username_v1"):
        resolvers.append(lambda: cl.user_info_by_username_v1(target_username))

    resolvers.extend([
        lambda: cl.user_info_by_username(target_username),
        lambda: cl.user_info(cl.user_id_from_username(target_username)),
    ])

    for resolver in resolvers:
        try:
            user = resolver()
            if user:
                return user, target_username
        except Exception as exc:
            last_error = exc
            logger.warning(f"[FOLLOWERS] Resolver failed for @{target_username}: {exc}")

    if last_error:
        raise last_error

    raise HTTPException(status_code=404, detail=f"Compte Instagram @{target_username} introuvable")


def _fetch_followers(cl, user_id: int, amount: int):
    errors: list[Exception] = []

    if hasattr(cl, "user_followers_v1"):
        try:
            followers_v1 = cl.user_followers_v1(user_id, amount=amount)
            if followers_v1:
                return list(followers_v1)
        except Exception as exc:
            errors.append(exc)
            logger.warning(f"[FOLLOWERS] v1 fetch failed for user_id={user_id}: {exc}")

    try:
        followers = cl.user_followers(user_id, amount=amount)
        if isinstance(followers, dict):
            return list(followers.values())
        if isinstance(followers, list):
            return followers
        return []
    except Exception as exc:
        errors.append(exc)
        logger.warning(f"[FOLLOWERS] default fetch failed for user_id={user_id}: {exc}")

    if errors:
        raise errors[-1]

    return []


@router.get("")
def get_account(username: Optional[str] = Query(None)):
    cl = account_manager.get_client(username)
    if not cl:
        raise HTTPException(status_code=401, detail="Not logged in")

    try:
        user = cl.account_info()
        # Fetch DB record for created_at
        db_account = db_proxy.select_first("bot_accounts", {"username": (getattr(user, "username", "") or "").lower()})
        return {
            "username": getattr(user, "username", None),
            "full_name": getattr(user, "full_name", "") or "",
            "biography": getattr(user, "biography", "") or "",
            "profile_pic_url": str(getattr(user, "profile_pic_url", "") or "") or None,
            "profile_pic_url_hd": str(getattr(user, "profile_pic_url_hd", "") or "") or None,
            "followers_count": getattr(user, "follower_count", 0) or 0,
            "following_count": getattr(user, "following_count", 0) or 0,
            "media_count": getattr(user, "media_count", 0) or 0,
            "is_private": bool(getattr(user, "is_private", False)),
            "is_verified": bool(getattr(user, "is_verified", False)),
            "is_business": bool(getattr(user, "is_business", False)),
            "category": getattr(user, "category", None) or getattr(user, "category_name", None),
            "public_email": getattr(user, "public_email", None) or None,
            "public_phone": getattr(user, "public_phone_number", None) or getattr(user, "contact_phone_number", None) or None,
            "external_url": getattr(user, "external_url", None) or None,
            "account_type": getattr(user, "account_type", None),
            "pk": str(getattr(user, "pk", "")) if getattr(user, "pk", None) else None,
            "added_at": db_account.get("created_at") if db_account else None,
            "last_login_at": db_account.get("last_login_at") if db_account else None,
        }
    except Exception as exc:
        detail = summarize_instagram_error(exc, context="account")
        logger.error(f"[ACCOUNT] Error fetching account info: {exc}")
        raise HTTPException(status_code=429 if is_rate_limited(exc) else 503, detail=detail)


@router.get("/list")
def list_accounts():
    accounts = account_manager.list_accounts()
    return {"accounts": accounts, "total": len(accounts)}


@router.get("/followers")
def get_followers(
    amount: int = Query(50, ge=1, le=500),
    account_username: Optional[str] = Query(None),
):
    cl = account_manager.get_client()
    if not cl:
        raise HTTPException(status_code=401, detail="No active Instagram session. Log in first.")

    try:
        if account_username:
            target_user, display_name = _resolve_target_user(cl, account_username)
        else:
            target_user = cl.account_info()
            display_name = getattr(target_user, "username", "compte_actif")

        user_id = int(getattr(target_user, "pk"))
        expected_followers = int(getattr(target_user, "follower_count", 0) or 0)
        is_private = bool(getattr(target_user, "is_private", False))

        logger.info(f"[FOLLOWERS] Fetching up to {amount} followers for @{display_name} (pk={user_id})")
        followers = _fetch_followers(cl, user_id, amount)

        result = []
        for user in followers:
            pk = getattr(user, "pk", None)
            result.append({
                "user_id": str(pk) if pk is not None else "",
                "username": getattr(user, "username", ""),
                "full_name": getattr(user, "full_name", "") or "",
                "profile_pic_url": str(getattr(user, "profile_pic_url", "") or "") or None,
            })

        if not result and expected_followers > 0:
            privacy_hint = "Le compte est probablement privé ou non accessible depuis la session active." if is_private else "Instagram limite ou bloque temporairement l'accès à la liste des abonnés."
            raise HTTPException(
                status_code=409,
                detail=f"Instagram n'a renvoyé aucun abonné pour @{display_name} alors que le compte affiche environ {expected_followers} abonnés. {privacy_hint}",
            )

        logger.info(f"[FOLLOWERS] Got {len(result)} followers")
        return {"followers": result, "total": len(result)}
    except HTTPException:
        raise
    except Exception as exc:
        detail = summarize_instagram_error(exc, context="followers")
        logger.error(f"[FOLLOWERS] Error: {exc}")
        raise HTTPException(status_code=429 if is_rate_limited(exc) else 503, detail=detail)


class ToggleRequest(BaseModel):
    is_active: bool


class SavePasswordRequest(BaseModel):
    username: str
    password: str


@router.post("/save-password")
def save_password(req: SavePasswordRequest):
    """Save/update encrypted password for an existing account (for auto-reconnect)."""
    from encryption import encrypt_password
    username = req.username.strip().lstrip("@").lower()
    account = db_proxy.select_first("bot_accounts", {"username": username})
    if not account:
        raise HTTPException(status_code=404, detail=f"Account @{username} not found in database")
    encrypted = encrypt_password(req.password)
    db_proxy.update("bot_accounts", account["id"], {"encrypted_password": encrypted})
    logger.info(f"[ACCOUNT] Saved encrypted password for @{username}")
    return {"success": True, "message": f"Mot de passe chiffré sauvegardé pour @{username}"}


@router.patch("/{username}/toggle")
def toggle_account(username: str, req: ToggleRequest):
    username = username.strip().lstrip("@").lower()

    account = db_proxy.select_first("bot_accounts", {"username": username})
    if not account:
        raise HTTPException(status_code=404, detail=f"Account @{username} not found")

    db_proxy.update("bot_accounts", account["id"], {"is_active": req.is_active})

    return {
        "success": True,
        "message": f"@{username} {'activé' if req.is_active else 'désactivé'}",
        "username": username,
        "is_active": req.is_active,
    }


@router.delete("/{username}")
def remove_account(username: str):
    username = username.strip().lstrip("@").lower()
    return account_manager.remove_account(username)
