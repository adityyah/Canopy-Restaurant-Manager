# backend/app/middleware/rate_limit.py
# ==============================================================================
# Rate Limiting Middleware — Canopy Restaurant Manager
# ==============================================================================
# Provides a FastAPI dependency:
#
#   rate_limit(current_user, response)
#       Checks the authenticated user's request count against Upstash Redis.
#       Allows up to 30 requests per 60-second window.
#       Raises 429 with a Retry-After header if the limit is exceeded.
#
# Rules enforced (RULES.md):
#   Rule E-2  — 429 Too Many Requests with error code RATE_LIMIT_EXCEEDED.
#   Rule E-3  — Response MUST include a Retry-After header (in seconds).
#
# Per PHASES.md § 2.4:
#   "Limits are applied per user session [user ID]. Allows up to 30 messages
#    per minute. Returns a 429 Too Many Requests response with a Retry-After
#    header if the limit is exceeded."
#
# Adapted from Snippet B (user-provided) into the modular architecture.
# The dependency is applied to POST /chat/message in Phase 3.
# ==============================================================================

from __future__ import annotations

import logging
import math
import os
from typing import Annotated

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Response

from app.middleware.auth import CurrentUser, get_current_user
from app.models.user import User

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Upstash Redis + Ratelimit setup
# ---------------------------------------------------------------------------
# The upstash-redis and upstash-ratelimit libraries read UPSTASH_REDIS_REST_URL
# and UPSTASH_REDIS_REST_TOKEN from the environment automatically when you call
# Redis.from_env().
#
# We rename our .env keys to match the library's expected names.
# In .env:
#   UPSTASH_REDIS_REST_URL  = https://your-db.upstash.io
#   UPSTASH_REDIS_REST_TOKEN = your-upstash-token-here

_RATE_LIMIT_ENABLED: bool = bool(
    os.getenv("UPSTASH_REDIS_REST_URL") or os.getenv("UPSTASH_REDIS_URL")
)

# Lazy-initialise the ratelimit client so the server starts cleanly even if
# Upstash credentials are not yet configured (Phase 1/2 dev setup).
_ratelimit = None


def _get_ratelimit():
    """Return a cached Ratelimit instance, creating it on first call."""
    global _ratelimit
    if _ratelimit is None:
        try:
            from upstash_redis import Redis
            from upstash_ratelimit import FixedWindow, Ratelimit

            # Map our .env variable names to what the library expects.
            # upstash_redis reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
            # We support both naming conventions.
            url = os.getenv("UPSTASH_REDIS_REST_URL") or os.getenv("UPSTASH_REDIS_URL", "")
            token = (
                os.getenv("UPSTASH_REDIS_REST_TOKEN")
                or os.getenv("UPSTASH_REDIS_TOKEN", "")
            )

            if not url or not token:
                raise RuntimeError("Upstash Redis credentials not found in environment.")

            redis = Redis(url=url, token=token)

            _ratelimit = Ratelimit(
                redis=redis,
                # FixedWindow: 30 requests per 60-second window per user.
                # "Fixed" means the window resets hard at each 60s boundary,
                # not rolling. Simple and predictable for end users.
                limiter=FixedWindow(max_requests=30, window=60),
                # Prefix namespaces our keys from any other Upstash consumers.
                prefix="canopy:chat",
            )
        except Exception as exc:
            logger.error(
                "Failed to initialise Upstash Ratelimit client: %s. "
                "Rate limiting is DISABLED — configure UPSTASH_REDIS_REST_URL "
                "and UPSTASH_REDIS_REST_TOKEN to enable it.",
                exc,
            )
            # Return None; the dependency will skip limiting gracefully.
            return None

    return _ratelimit


# ---------------------------------------------------------------------------
# rate_limit — FastAPI dependency
# ---------------------------------------------------------------------------

def rate_limit(
    current_user: CurrentUser,
    response: Response,
) -> User:
    """
    Enforce a per-user rate limit of 30 requests per 60 seconds.

    This dependency is designed to be applied to the POST /chat/message
    endpoint (Phase 3) but can be reused on any expensive endpoint.

    How it works:
      1. Uses current_user.id as the Redis key (one counter per user).
      2. Calls Upstash FixedWindow.limit() — atomic, server-side counter.
      3. Attaches X-RateLimit-* headers to every response for the frontend.
      4. If the limit is exceeded, raises 429 with a Retry-After header
         (RULES.md § E-3).

    If Upstash is not configured (e.g. local dev without credentials),
    the dependency logs a warning and passes through without limiting.

    Args:
        current_user: The authenticated user (from get_current_user).
        response:     FastAPI's Response object — used to set headers.

    Returns:
        User — the current user (passed through for route handlers).

    Raises:
        HTTPException 429 — if the user has exceeded the rate limit.
    """
    limiter = _get_ratelimit()

    if limiter is None:
        # Upstash not configured — pass through without limiting.
        logger.debug(
            "Rate limiter not configured; skipping limit check for user %r.",
            current_user.id,
        )
        return current_user

    # Use the user's UUID as the rate limit key.
    identifier: str = current_user.id

    try:
        result = limiter.limit(identifier)
    except Exception as exc:
        # If Redis is unreachable, fail open (allow the request) to avoid
        # blocking all users during a Redis outage. Log loudly.
        logger.error(
            "Upstash Redis error during rate limit check for user %r: %s. "
            "Allowing request (fail-open).",
            current_user.id,
            exc,
        )
        return current_user

    # ------------------------------------------------------------------
    # Attach informational headers — good practice for API clients.
    # ------------------------------------------------------------------
    response.headers["X-RateLimit-Limit"] = "30"
    response.headers["X-RateLimit-Remaining"] = str(result.remaining)

    # `result.reset` is a Unix timestamp (ms or s depending on library version).
    # We expose it as seconds-until-reset for the Retry-After header.
    retry_after_seconds: int = _compute_retry_after(result.reset)
    response.headers["X-RateLimit-Reset"] = str(result.reset)

    if not result.allowed:
        # RULES.md § E-2: 429 with RATE_LIMIT_EXCEEDED code.
        # RULES.md § E-3: MUST include Retry-After header.
        logger.warning(
            "Rate limit exceeded for user %r. Retry-After: %ds.",
            current_user.id,
            retry_after_seconds,
        )
        raise HTTPException(
            status_code=429,
            detail={
                "error": True,
                "code": "RATE_LIMIT_EXCEEDED",
                "message": (
                    f"You're sending messages too quickly. "
                    f"Please wait {retry_after_seconds} seconds before trying again."
                ),
            },
            headers={
                # Standard header — tells clients exactly when to retry.
                "Retry-After": str(retry_after_seconds),
            },
        )

    return current_user


def _compute_retry_after(reset_value: int | float) -> int:
    """
    Convert the Upstash reset timestamp into a Retry-After value in seconds.

    Upstash may return reset as a Unix timestamp in milliseconds or seconds
    depending on the library version.  We normalise both cases.

    Args:
        reset_value: The reset timestamp from upstash_ratelimit.

    Returns:
        Seconds until the rate limit window resets (minimum 1).
    """
    import time

    now_ms = time.time() * 1000

    # Heuristic: if reset_value is larger than 1e12, it's in milliseconds.
    if reset_value > 1_000_000_000_000:
        remaining_ms = reset_value - now_ms
        seconds = math.ceil(remaining_ms / 1000)
    else:
        # Already in seconds (Unix timestamp).
        seconds = math.ceil(reset_value - time.time())

    return max(1, seconds)


# ---------------------------------------------------------------------------
# Type alias — for clean route signatures in Phase 3
# ---------------------------------------------------------------------------
# Usage:
#   @router.post("/chat/message")
#   def send_message(user: RateLimitedUser, ...):
#       ...  # user is the authenticated, rate-limited User object

RateLimitedUser = Annotated[User, Depends(rate_limit)]
