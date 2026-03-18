"""
Multi-account Instagram client manager — HTTP proxy version.
All DB operations go through db_proxy instead of SQLAlchemy.
"""

import json
import logging
from typing import Optional, Dict
from instagrapi import Client
from instagrapi.exceptions import (
    LoginRequired,
    BadPassword,
    TwoFactorRequired,
    ChallengeRequired,
    ReloginAttemptExceeded,
)
from datetime import datetime, timezone

import db_proxy

logger = logging.getLogger("instagram_bot")

_proxy_url: Optional[str] = None


def set_global_proxy(proxy: Optional[str]):
    global _proxy_url
    _proxy_url = proxy.strip() if proxy and proxy.strip() else None
    logger.info(f"[PROXY] Proxy configured: {'YES' if _proxy_url else 'NONE'}")


def get_global_proxy() -> Optional[str]:
    return _proxy_url


def _parse_cookie_string(cookie_str: str) -> dict:
    """Parse cookies from either standard 'key=val; key=val' format or Netscape HTTP Cookie File format."""
    cookie_str = cookie_str.strip()

    # Detect Netscape format (lines with tab-separated fields, 7 columns)
    if "# Netscape HTTP Cookie File" in cookie_str or "\t" in cookie_str:
        cookies = {}
        for line in cookie_str.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) >= 7:
                name = parts[5].strip()
                value = parts[6].strip()
                if name and value:
                    cookies[name] = value
        if cookies:
            return cookies

    # Standard format: key=value; key=value
    cookies = {}
    for part in cookie_str.split(";"):
        part = part.strip()
        if "=" in part:
            k, _, v = part.partition("=")
            cookies[k.strip()] = v.strip()
    return cookies


def _create_client() -> Client:
    cl = Client()
    cl.delay_range = [1, 3]
    cl.set_locale("fr_BJ")
    cl.set_timezone_offset(3600)
    if _proxy_url:
        cl.set_proxy(_proxy_url)
    return cl


class MultiAccountManager:
    def __init__(self):
        self._clients: Dict[str, Client] = {}
        self._pending_challenges: Dict[str, Client] = {}

    # ---- DB helpers via proxy ----

    def _get_account(self, username: str) -> Optional[dict]:
        return db_proxy.select_first("bot_accounts", {"username": username.lower()})

    def _save_account(self, username: str, client: Client, password: Optional[str] = None):
        from encryption import encrypt_password
        username = username.lower()
        session_json = json.dumps(client.get_settings(), default=str)
        account = self._get_account(username)

        if account:
            fields = {
                "session_data": session_json,
                "is_logged_in": True,
                "last_login_at": datetime.now(timezone.utc).isoformat(),
            }
            if password:
                fields["encrypted_password"] = encrypt_password(password)
            db_proxy.update("bot_accounts", account["id"], fields)
        else:
            row = {
                "username": username,
                "encrypted_password": encrypt_password(password) if password else None,
                "session_data": session_json,
                "is_logged_in": True,
                "last_login_at": datetime.now(timezone.utc).isoformat(),
                "is_active": True,
            }
            db_proxy.insert("bot_accounts", row)
        logger.info(f"[ACCOUNT] Saved account {username}")

    def _mark_logged_out(self, username: str):
        account = self._get_account(username)
        if account:
            db_proxy.update("bot_accounts", account["id"], {
                "is_logged_in": False,
                "session_data": None,
            })

    def _update_last_action(self, username: str):
        account = self._get_account(username)
        if account:
            db_proxy.update("bot_accounts", account["id"], {
                "last_action_at": datetime.now(timezone.utc).isoformat(),
            })

    # ---- Session restore ----

    def _restore_session(self, username: str) -> bool:
        account = self._get_account(username)
        if not account or not account.get("session_data"):
            return False
        try:
            settings = json.loads(account["session_data"])
            cl = _create_client()
            cl.set_settings(settings)
            # Don't call cl.login() — just inject session and verify with a light API call
            cl.init()
            user_info = cl.account_info()
            logger.info(f"[SESSION] Verified session for @{username} (uid={user_info.pk})")
            self._clients[username.lower()] = cl
            # Re-save refreshed session data
            refreshed = json.dumps(cl.get_settings(), default=str)
            db_proxy.update("bot_accounts", account["id"], {
                "session_data": refreshed,
                "is_logged_in": True,
                "last_login_at": datetime.now(timezone.utc).isoformat(),
            })
            logger.info(f"[SESSION] Restored session for @{username}")
            return True
        except Exception as e:
            logger.warning(f"[SESSION] Restore failed for @{username}: {e}")
            return False

    def _auto_reconnect(self, username: str) -> bool:
        from encryption import decrypt_password
        account = self._get_account(username)
        if not account or not account.get("encrypted_password"):
            logger.warning(f"[RECONNECT] No password stored for @{username}")
            return False
        try:
            password = decrypt_password(account["encrypted_password"])
            cl = _create_client()
            cl.login(username, password)
            self._clients[username.lower()] = cl
            db_proxy.update("bot_accounts", account["id"], {
                "session_data": json.dumps(cl.get_settings(), default=str),
                "is_logged_in": True,
                "last_login_at": datetime.now(timezone.utc).isoformat(),
            })
            logger.info(f"[RECONNECT] Auto-reconnected @{username}")
            return True
        except Exception as e:
            logger.error(f"[RECONNECT] Failed for @{username}: {e}")
            return False

    # ---- Public API ----

    def get_client(self, username: Optional[str] = None) -> Optional[Client]:
        if username:
            key = username.lower()
            cl = self._clients.get(key)
            if cl:
                return cl
            if self._restore_session(key) or self._auto_reconnect(key):
                return self._clients.get(key)
            return None

        if not self._clients:
            return None
        return self._get_least_active_client()

    def _get_least_active_client(self) -> Optional[Client]:
        accounts = db_proxy.select("bot_accounts", filters={
            "is_active": "true",
            "is_logged_in": "true",
        }, order="last_action_at.asc")
        for acct in accounts:
            if acct["username"] in self._clients:
                self._update_last_action(acct["username"])
                return self._clients[acct["username"]]
        return next(iter(self._clients.values()), None)

    def list_accounts(self) -> list:
        accounts = db_proxy.select("bot_accounts", order="created_at.asc")
        return [
            {
                "username": a.get("username"),
                "is_active": a.get("is_active"),
                "is_logged_in": a.get("username") in self._clients,
                "last_login_at": a.get("last_login_at"),
                "last_action_at": a.get("last_action_at"),
            }
            for a in accounts
        ]

    def login(self, username: str, password: str) -> dict:
        username = username.strip().lstrip("@").lower()
        logger.info(f"[LOGIN] Login request for '{username}'")

        # Check account limit
        total = db_proxy.count("bot_accounts")
        if total >= 20:
            existing = self._get_account(username)
            if not existing:
                return {"success": False, "message": "Limite de 20 comptes atteinte."}

        if self._restore_session(username):
            self._save_account(username, self._clients[username], password)
            return {"success": True, "message": "Session reprise avec succès", "username": username}

        cl = _create_client()
        try:
            cl.login(username, password)
            self._clients[username] = cl
            self._save_account(username, cl, password)
            logger.info(f"[LOGIN] SUCCESS for {username}")
            return {"success": True, "message": "Connecté avec succès", "username": username}

        except TwoFactorRequired:
            return {"success": False, "message": "2FA activé — désactive-le temporairement.", "username": username, "requires_2fa": True}

        except BadPassword:
            return {"success": False, "message": "Mot de passe incorrect.", "username": username}

        except ChallengeRequired:
            self._pending_challenges[username] = cl
            challenge_type = "approve"
            try:
                last_json = cl.last_json if hasattr(cl, "last_json") and cl.last_json else {}
                cl.challenge_resolve(last_json)
                challenge_type = "code"
            except Exception:
                pass
            return {
                "success": False,
                "message": "Instagram bloque la connexion. Approuve depuis l'app OU importe tes cookies.",
                "username": username,
                "challenge": True,
                "challenge_type": challenge_type,
                "geo_blocked": not bool(_proxy_url),
            }

        except ReloginAttemptExceeded:
            return {"success": False, "message": "Trop de tentatives. Attends quelques minutes.", "username": username}

        except Exception as e:
            err_str = str(e)
            logger.error(f"[LOGIN] Error: {type(e).__name__}: {err_str}")
            return {"success": False, "message": err_str, "username": username}

    def submit_challenge_code(self, username: str, code: str) -> dict:
        username = username.lower()
        cl = self._pending_challenges.get(username)
        if not cl:
            return {"success": False, "message": "Aucun challenge en attente pour ce compte."}
        try:
            cl.challenge_resolve(cl.last_json, code)
            self._clients[username] = cl
            self._save_account(username, cl)
            del self._pending_challenges[username]
            return {"success": True, "message": "Code accepté — connecté avec succès.", "username": username}
        except Exception as e:
            return {"success": False, "message": f"Code invalide ou expiré: {e}"}

    def login_with_cookies(
        self,
        cookie_string: Optional[str] = None,
        sessionid: Optional[str] = None,
        csrftoken: Optional[str] = None,
        ds_user_id: Optional[str] = None,
        mid: Optional[str] = None,
        ig_did: Optional[str] = None,
        rur: Optional[str] = None,
        username: Optional[str] = None,
    ) -> dict:
        cookies: dict = {}
        if cookie_string:
            cookies = _parse_cookie_string(cookie_string)
        else:
            if sessionid: cookies["sessionid"] = sessionid
            if csrftoken: cookies["csrftoken"] = csrftoken
            if ds_user_id: cookies["ds_user_id"] = ds_user_id
            if mid: cookies["mid"] = mid

        if not cookies.get("sessionid"):
            return {"success": False, "message": "Le cookie 'sessionid' est requis."}

        cl = _create_client()
        settings = cl.get_settings()
        settings["cookies"] = cookies
        if mid: settings["mid"] = mid
        if ig_did:
            settings["uuids"] = settings.get("uuids", {})
            settings["uuids"]["ig_did"] = ig_did
        if rur: settings["ig_u_rur"] = rur

        try:
            cl.set_settings(settings)
            cl.login(username or cookies.get("ds_user_id", ""), "")
        except Exception:
            pass

        try:
            user_info = cl.account_info()
            actual_username = user_info.username.lower()
            self._clients[actual_username] = cl
            self._save_account(actual_username, cl)
            return {
                "success": True,
                "message": f"Connecté via cookies (@{actual_username})",
                "username": actual_username,
            }
        except Exception as e:
            return {"success": False, "message": f"Cookies invalides ou expirés: {e}"}

    def logout(self, username: str, hard: bool = False):
        """Soft logout by default — only clears local state without calling Instagram's logout API.
        Hard logout actually invalidates the session on Instagram (kills cookies permanently)."""
        username = username.lower()
        cl = self._clients.pop(username, None)
        if cl and hard:
            try:
                cl.logout()
            except Exception:
                pass
        self._mark_logged_out(username)
        self._pending_challenges.pop(username, None)
        return {"success": True, "message": f"@{username} déconnecté"}

    def logout_all(self):
        for username in list(self._clients.keys()):
            self.logout(username)
        return {"success": True, "message": "Tous les comptes déconnectés"}

    def remove_account(self, username: str):
        self.logout(username)
        account = self._get_account(username)
        if account:
            db_proxy.delete("bot_accounts", account["id"])
        return {"success": True, "message": f"Compte @{username} supprimé"}

    def restore_all_sessions(self):
        accounts = db_proxy.select("bot_accounts", filters={
            "is_active": "true",
            "is_logged_in": "true",
        })
        for acct in accounts:
            uname = acct.get("username")
            logger.info(f"[STARTUP] Restoring session for @{uname}...")
            if self._restore_session(uname):
                logger.info(f"[STARTUP] ✓ Restored @{uname}")
            elif self._auto_reconnect(uname):
                logger.info(f"[STARTUP] ✓ Auto-reconnected @{uname}")
            else:
                logger.warning(f"[STARTUP] ✗ Could not restore @{uname}")

    def get_auth_status(self, username: Optional[str] = None) -> dict:
        if username:
            username = username.lower()
            cl = self._clients.get(username)
            if not cl:
                return {"logged_in": False, "username": username}
            try:
                user = cl.account_info()
                return {
                    "logged_in": True,
                    "username": user.username,
                    "full_name": user.full_name,
                    "profile_pic_url": str(user.profile_pic_url) if user.profile_pic_url else None,
                    "followers": user.follower_count,
                    "following": user.following_count,
                }
            except Exception:
                self._clients.pop(username, None)
                return {"logged_in": False, "username": username}
        else:
            return {"accounts": self.list_accounts(), "total": len(self._clients)}


account_manager = MultiAccountManager()
