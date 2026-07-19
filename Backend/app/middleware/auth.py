# backend/app/middleware/auth.py
# ==============================================================================
# Authentication Middleware — Canopy Restaurant Manager
# ==============================================================================
# Provides two FastAPI dependency functions:
#
#   get_current_user(credentials, db)
#       Reads the Bearer token, verifies it via Supabase JWKS, then looks up
#       the user in the local `users` table.  Returns the User ORM object.
#       Raises 401 UNAUTHORIZED on any failure.
#
#   require_manager(current_user)
#       Calls get_current_user, then additionally asserts role == "manager".
#       Raises 403 FORBIDDEN if the user is a customer.
#
# Security rules enforced here (RULES.md):
#   Rule D-3  — Role checks MUST be server-side. This file IS that enforcement.
#   Rule E-1  — All errors returned as structured JSON {error, code, message}.
#   Rule E-2  — 401 for bad/missing JWT; 403 for wrong role.
#   Rule E-4  — Auth errors must not reveal internal details.
#
# Adapted from Snippet A (user-provided) into the modular architecture.
# ==============================================================================

from __future__ import annotations

import logging
import os
from typing import Annotated

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Supabase / JWKS config — read once at module import time
# ---------------------------------------------------------------------------

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")

if not SUPABASE_URL:
    logger.warning(
        "SUPABASE_URL is not set in .env. "
        "JWT verification will fail. Set it before running in production."
    )

# The JWKS endpoint exposes Supabase's public signing keys.
# PyJWKClient caches them automatically between requests.
JWKS_URL: str = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"

# Supabase issues JWTs with audience "authenticated" for logged-in users.
SUPABASE_AUDIENCE: str = "authenticated"

# Lazy-initialised so the module can be imported even if SUPABASE_URL is blank
# (useful during tests or Phase 1 server startup before Phase 2 is configured).
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    """Return a cached PyJWKClient instance, creating it on first call."""
    global _jwks_client
    if _jwks_client is None:
        if not SUPABASE_URL:
            raise HTTPException(
                status_code=500,
                detail={
                    "error": True,
                    "code": "INTERNAL_ERROR",
                    "message": "Authentication service is not configured.",
                },
            )
        _jwks_client = PyJWKClient(JWKS_URL)
    return _jwks_client


# ---------------------------------------------------------------------------
# HTTPBearer scheme — extracts the token from "Authorization: Bearer <token>"
# ---------------------------------------------------------------------------
# auto_error=False means FastAPI will not raise its own exception when the
# header is missing; we raise our own structured 401 instead (Rule E-1).

bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# _raise_unauthorized — centralised 401 factory (Rule E-1 + E-4)
# ---------------------------------------------------------------------------

def _raise_unauthorized(detail: str = "Invalid or missing authentication token.") -> None:
    """
    Raise a structured 401 Unauthorized exception.

    Deliberately generic — per RULES.md § E-4, we must NOT reveal whether
    the token is missing, expired, or has a bad signature.
    """
    raise HTTPException(
        status_code=401,
        detail={
            "error": True,
            "code": "UNAUTHORIZED",
            "message": "Invalid or missing authentication token.",
        },
        headers={"WWW-Authenticate": "Bearer"},
    )


# ---------------------------------------------------------------------------
# get_current_user — primary auth dependency
# ---------------------------------------------------------------------------

def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """
    Verify the Bearer JWT and return the corresponding local User record.

    Steps (per PHASES.md § 2.2):
      1. Check the Authorization header is present.
      2. Fetch the matching public key from Supabase JWKS.
      3. Decode and validate the JWT (expiry, audience, signature).
      4. Extract the `sub` claim (Supabase user UUID).
      5. Look up that UUID in the local `users` table.
      6. Return the User ORM object.

    Raises:
        HTTPException 401 — if any step above fails.

    Returns:
        User — the authenticated user's local database record.
    """
    # Step 1 — header must exist
    if credentials is None:
        _raise_unauthorized()

    token: str = credentials.credentials  # type: ignore[union-attr]

    # Step 2+3 — JWKS verification
    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        payload: dict = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience=SUPABASE_AUDIENCE,
        )
    except jwt.ExpiredSignatureError:
        logger.debug("JWT rejected: expired signature")
        _raise_unauthorized()
    except jwt.PyJWTError as exc:
        logger.debug("JWT rejected: %s", exc)
        _raise_unauthorized()
    except Exception as exc:
        # Catch PyJWKClient errors (network issues fetching JWKS, etc.)
        logger.error("Unexpected error during JWT verification: %s", exc)
        _raise_unauthorized()

    # Step 4 — extract subject (Supabase UUID)
    user_id: str | None = payload.get("sub")
    if not user_id:
        logger.debug("JWT has no 'sub' claim")
        _raise_unauthorized()

    # Step 5 — look up user in local DB
    user: User | None = db.query(User).filter(User.id == user_id).first()
    if user is None:
        # The token is valid, but we don't have a local record yet.
        # This can happen if the user signed up via Supabase but was never
        # synced to the local `users` table.  Treat it as unauthorized.
        logger.warning(
            "JWT verified but no local user found for sub=%r. "
            "Did you insert the user row after Supabase signup?",
            user_id,
        )
        _raise_unauthorized()

    return user


# ---------------------------------------------------------------------------
# require_manager — role guard for /manager/* routes
# ---------------------------------------------------------------------------

def require_manager(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """
    Ensure the authenticated user has the 'manager' role.

    This dependency chains off get_current_user, so JWT verification
    has already succeeded by the time this function runs.

    Per RULES.md § D-3:
        "Role-based access control must be enforced by the FastAPI backend
         middleware on every protected route."

    Raises:
        HTTPException 403 — if user.role != 'manager'.

    Returns:
        User — the authenticated manager's local database record.
    """
    if current_user.role != "manager":
        logger.warning(
            "403 Forbidden: user %r (role=%r) attempted to access a manager route.",
            current_user.id,
            current_user.role,
        )
        raise HTTPException(
            status_code=403,
            detail={
                "error": True,
                "code": "FORBIDDEN",
                "message": "You do not have permission to access this resource.",
            },
        )
    return current_user


# ---------------------------------------------------------------------------
# Type aliases — for cleaner route signatures
# ---------------------------------------------------------------------------
# Usage in a route:
#   def my_route(user: CurrentUser):   ...
#   def my_manager_route(user: ManagerUser): ...

CurrentUser = Annotated[User, Depends(get_current_user)]
ManagerUser = Annotated[User, Depends(require_manager)]
