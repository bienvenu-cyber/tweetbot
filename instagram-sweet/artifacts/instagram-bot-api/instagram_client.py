"""
Multi-account Instagram client manager.
Replaces the old singleton `ig_manager` with a manager that handles N accounts.
Passwords are encrypted at rest in the DB. Sessions are persisted in DB.
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

logger = logging.getLogger("instagram_bot")

_proxy_url: Optional[str] = None


def set_global_proxy(proxy: Optional[str]):
    global _proxy_url
    _proxy_url = proxy.strip() if proxy and proxy.strip() else None
    logger.info(f"[PROXY] Proxy configured: {'YES' if _proxy_url else 'NONE'}")


def get_global_proxy() -> Optional[str]:
    return _proxy_url


def _parse_cookie_string(cookie_str: str) -> dict:
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
    """Manages multiple Instagram accounts with in-memory clients + DB persistence."""

    def __init__(self):
        self._clients: Dict[str, Client] = {}  # username -> Client
        self._pending_challenges: Dict[str, Client] = {}  # username -> Client (during challenge)

    # ---- DB helpers ----

    def _get_account(self, username: str):
        from database import SessionLocal, BotAccount
        db = SessionLocal()
        try:
            return db.query(BotAccount).filter(BotAccount.username == username.lower()).first()
        finally:
            db.close()

    def _save_account(self, username: str, client: Client, password: Optional[str] = None):
        from database import SessionLocal, BotAccount
        from encryption import encrypt_password
        db = SessionLocal()
        try:
            username = username.lower()
            account = db.query(BotAccount).filter(BotAccount.username == username).first()
            session_json = json.dumps(client.get_settings(), default=str)

            if account:
                account.session_data = session_json
                account.is_logged_in = True
                account.last_login_at = datetime.now(timezone.utc)
                if password:
                    account.encrypted_password = encrypt_password(password)
            else:
                account = BotAccount(
                    username=username,
                    encrypted_password=encrypt_password(password) if password else None,
                    session_data=session_json,
                    is_logged_in=True,
                    last_login_at=datetime.now(timezone.utc),
                )
                db.add(account)
            db.commit()
            logger.info(f"[ACCOUNT] Saved account {username}")
        finally:
            db.close()

    def _mark_logged_out(self, username: str):
        from database import SessionLocal, BotAccount
        db = SessionLocal()
        try:
            account = db.query(BotAccount).filter(BotAccount.username == username.lower()).first()
            if account:
                account.is_logged_in = False
                account.session_data = None
                db.commit()
        finally:
            db.close()

    def _update_last_action(self, username: str):
        from database import SessionLocal, BotAccount
        db = SessionLocal()
        try:
            account = db.query(BotAccount).filter(BotAccount.username == username.lower()).first()
            if account:
                account.last_action_at = datetime.now(timezone.utc)
                db.commit()
        finally:
            db.close()

    # ---- Session restore ----

    def _restore_session(self, username: str) -> bool:
        """Try to restore a session from DB data."""
        from database import SessionLocal, BotAccount
        db = SessionLocal()
        try:
            account = db.query(BotAccount).filter(BotAccount.username == username.lower()).first()
            if not account or not account.session_data:
                return False
            settings = json.loads(account.session_data)
            cl = _create_client()
            cl.set_settings(settings)
            cl.login(username, "")
            # Verify session is alive
            cl.get_timeline_feed()
            self._clients[username.lower()] = cl
            logger.info(f"[SESSION] Restored session for @{username}")
            return True
        except Exception as e:
            logger.warning(f"[SESSION] Restore failed for @{username}: {e}")
            return False
        finally:
            db.close()

    def _auto_reconnect(self, username: str) -> bool:
        """Try to reconnect using encrypted password from DB."""
        from database import SessionLocal, BotAccount
        from encryption import decrypt_password
        db = SessionLocal()
        try:
            account = db.query(BotAccount).filter(BotAccount.username == username.lower()).first()
            if not account or not account.encrypted_password:
                logger.warning(f"[RECONNECT] No password stored for @{username}")
                return False
            password = decrypt_password(account.encrypted_password)
            cl = _create_client()
            cl.login(username, password)
            self._clients[username.lower()] = cl
            # Update session
            account.session_data = json.dumps(cl.get_settings(), default=str)
            account.is_logged_in = True
            account.last_login_at = datetime.now(timezone.utc)
            db.commit()
            logger.info(f"[RECONNECT] Auto-reconnected @{username}")
            return True
        except Exception as e:
            logger.error(f"[RECONNECT] Failed for @{username}: {e}")
            return False
        finally:
            db.close()

    # ---- Public API ----

    def get_client(self, username: Optional[str] = None) -> Optional[Client]:
        """Get client for a specific account. If none specified, return first active."""
        if username:
            key = username.lower()
            cl = self._clients.get(key)
            if cl:
                return cl
            # Try restore then reconnect
            if self._restore_session(key) or self._auto_reconnect(key):
                return self._clients.get(key)
            return None

        # No username specified → return least-recently-used active client (round-robin)
        if not self._clients:
            return None
        return self._get_least_active_client()

    def _get_least_active_client(self) -> Optional[Client]:
        """Round-robin: pick the account with the oldest last_action_at."""
        from database import SessionLocal, BotAccount
        db = SessionLocal()
        try:
            accounts = (
                db.query(BotAccount)
                .filter(BotAccount.is_active == True, BotAccount.is_logged_in == True)
                .order_by(BotAccount.last_action_at.asc().nullsfirst())
                .all()
            )
            for acct in accounts:
                if acct.username in self._clients:
                    self._update_last_action(acct.username)
                    return self._clients[acct.username]
            return next(iter(self._clients.values()), None)
        finally:
            db.close()

    def list_accounts(self) -> list:
        """List all accounts with their status."""
        from database import SessionLocal, BotAccount
        db = SessionLocal()
        try:
            accounts = db.query(BotAccount).order_by(BotAccount.created_at.asc()).all()
            return [
                {
                    "username": a.username,
                    "is_active": a.is_active,
                    "is_logged_in": a.username in self._clients,
                    "last_login_at": a.last_login_at.isoformat() if a.last_login_at else None,
                    "last_action_at": a.last_action_at.isoformat() if a.last_action_at else None,
                }
                for a in accounts
            ]
        finally:
            db.close()

    def login(self, username: str, password: str) -> dict:
        username = username.strip().lstrip("@").lower()
        logger.info(f"[LOGIN] Login request for '{username}'")

        # Check account limit
        from database import SessionLocal, BotAccount
        db = SessionLocal()
        try:
            count = db.query(BotAccount).count()
            if count >= 20 and not db.query(BotAccount).filter(BotAccount.username == username).first():
                return {"success": False, "message": "Limite de 20 comptes atteinte."}
        finally:
            db.close()

        # Try restoring existing session first
        if self._restore_session(username):
            self._save_account(username, self._clients[username], password)
            return {"success": True, "message": "Session reprise avec succès", "username": username}

        # Fresh login
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

    def logout(self, username: str):
        username = username.lower()
        cl = self._clients.pop(username, None)
        if cl:
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
        """Completely remove an account from DB."""
        self.logout(username)
        from database import SessionLocal, BotAccount
        db = SessionLocal()
        try:
            db.query(BotAccount).filter(BotAccount.username == username.lower()).delete()
            db.commit()
        finally:
            db.close()
        return {"success": True, "message": f"Compte @{username} supprimé"}

    def restore_all_sessions(self):
        """Called on startup to restore all active sessions."""
        from database import SessionLocal, BotAccount
        db = SessionLocal()
        try:
            accounts = db.query(BotAccount).filter(
                BotAccount.is_active == True,
                BotAccount.is_logged_in == True,
            ).all()
            for acct in accounts:
                logger.info(f"[STARTUP] Restoring session for @{acct.username}...")
                if self._restore_session(acct.username):
                    logger.info(f"[STARTUP] ✓ Restored @{acct.username}")
                elif self._auto_reconnect(acct.username):
                    logger.info(f"[STARTUP] ✓ Auto-reconnected @{acct.username}")
                else:
                    logger.warning(f"[STARTUP] ✗ Could not restore @{acct.username}")
        finally:
            db.close()

    def get_auth_status(self, username: Optional[str] = None) -> dict:
        """Get status of one account or all accounts."""
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


# Singleton manager instance
account_manager = MultiAccountManager()
