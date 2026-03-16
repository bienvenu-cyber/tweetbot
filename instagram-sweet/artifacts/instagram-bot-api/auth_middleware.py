"""
API authentication middleware.

Supports two modes:
  1. API key via header `X-API-Key`
  2. Bearer JWT token via `Authorization: Bearer <token>`

Set the env var `BOT_API_KEY` to enable API key auth.
Set the env var `BOT_JWT_SECRET` to enable JWT auth.
At least one MUST be configured in production.
"""

import os
import hmac
import hashlib
import logging
from typing import Optional

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

logger = logging.getLogger("instagram_bot")

API_KEY: Optional[str] = os.environ.get("BOT_API_KEY")
JWT_SECRET: Optional[str] = os.environ.get("BOT_JWT_SECRET")

# Paths that don't require authentication
PUBLIC_PATHS = {"/bot-api/health", "/docs", "/openapi.json", "/redoc"}


def _constant_time_compare(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


def _verify_api_key(key: str) -> bool:
    if not API_KEY:
        return False
    return _constant_time_compare(key, API_KEY)


def _verify_jwt(token: str) -> bool:
    """Basic JWT verification. Replace with proper library (PyJWT) in production."""
    if not JWT_SECRET:
        return False
    try:
        import jwt
        jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return True
    except ImportError:
        logger.warning("[AUTH] PyJWT not installed — JWT auth unavailable")
        return False
    except Exception:
        return False


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path

        # Skip auth for public paths and CORS preflight
        if path in PUBLIC_PATHS or request.method == "OPTIONS":
            return await call_next(request)

        # Only protect /bot-api/* endpoints
        if not path.startswith("/bot-api/"):
            return await call_next(request)

        # If no auth is configured at all, warn but allow (dev mode)
        if not API_KEY and not JWT_SECRET:
            logger.warning("[AUTH] No BOT_API_KEY or BOT_JWT_SECRET configured — running in INSECURE dev mode")
            return await call_next(request)

        # Check X-API-Key header
        api_key = request.headers.get("X-API-Key")
        if api_key and _verify_api_key(api_key):
            return await call_next(request)

        # Check Authorization: Bearer <token>
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            if _verify_jwt(token):
                return await call_next(request)

        raise HTTPException(status_code=401, detail="Unauthorized — provide X-API-Key or Bearer token")
