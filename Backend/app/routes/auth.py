# backend/app/routes/auth.py
# ==============================================================================
# Auth Routes — Canopy Restaurant Manager
# ==============================================================================
# Thin proxy routes that wrap Supabase's auth REST API.
#
# Endpoints:
#   POST /auth/signup  — Register a new customer account via Supabase.
#   POST /auth/login   — Exchange email+password for a Supabase JWT.
#   POST /auth/logout  — Invalidate the current session token.
#   GET  /auth/me      — Return the current user's local profile (protected).
#
# Design decisions:
#   - These routes are a PROXY — they call Supabase on behalf of the frontend,
#     keeping the SUPABASE_ANON_KEY server-side (never exposed to the browser).
#   - After a successful signup, we auto-create a corresponding row in the
#     local `users` table so get_current_user() can look the user up.
#   - Login errors return a deliberately vague 401 message (RULES.md § E-4):
#     "Invalid email or password." — never "Email not found" or "Wrong password".
#   - All error responses follow the structured format (RULES.md § E-1).
#
# Adapted from Snippet A into the APIRouter pattern.
# ==============================================================================

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Annotated

import requests as http
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import CurrentUser
from app.models.user import User

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")

_SUPABASE_HEADERS = {
    "apikey": SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
}

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter()

# ---------------------------------------------------------------------------
# Pydantic Schemas (auth-specific — kept local to avoid premature abstraction)
# ---------------------------------------------------------------------------


class AuthRequest(BaseModel):
    """Request body for signup and login."""

    email: EmailStr = Field(
        ...,
        description="User's email address",
        examples=["customer@example.com"],
    )
    password: str = Field(
        ...,
        min_length=6,
        description="Password (minimum 6 characters — enforced by Supabase too)",
    )


class LogoutRequest(BaseModel):
    """Request body for logout — requires the current JWT to revoke."""

    access_token: str = Field(
        ...,
        description="The JWT access token to invalidate",
    )


class UserProfile(BaseModel):
    """Response shape for GET /auth/me."""

    model_config = {"from_attributes": True}

    id: str
    email: str
    role: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Helper — raise structured HTTP error
# ---------------------------------------------------------------------------

def _http_error(status_code: int, code: str, message: str) -> None:
    raise HTTPException(
        status_code=status_code,
        detail={"error": True, "code": code, "message": message},
    )


# ---------------------------------------------------------------------------
# POST /auth/signup
# ---------------------------------------------------------------------------

@router.post(
    "/signup",
    status_code=201,
    summary="Register a new customer account",
    tags=["Auth"],
)
def signup(
    payload: AuthRequest,
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """
    Register a new user via Supabase, then mirror the user in the local DB.

    Flow:
      1. POST to Supabase /auth/v1/signup.
      2. On success, extract the user's UUID from the response.
      3. Insert a corresponding row into the local `users` table (role=customer).
      4. Return a safe subset of the Supabase response (no raw password/token).

    The local row is required so that get_current_user() can look up the user
    after they log in and present their JWT.
    """
    if not SUPABASE_URL:
        _http_error(500, "INTERNAL_ERROR", "Authentication service is not configured.")

    url = f"{SUPABASE_URL}/auth/v1/signup"

    try:
        resp = http.post(
            url,
            headers=_SUPABASE_HEADERS,
            json={"email": payload.email, "password": payload.password},
            timeout=10,
        )
    except http.exceptions.RequestException as exc:
        logger.error("Supabase signup request failed: %s", exc)
        _http_error(500, "INTERNAL_ERROR", "Could not reach the authentication service.")

    if resp.status_code not in (200, 201):
        # Supabase returns 400 for duplicate email, weak password, etc.
        # Per Rule E-4 we return a generic message, not Supabase's detail.
        logger.warning(
            "Supabase signup rejected (HTTP %d): %s",
            resp.status_code,
            resp.text[:200],
        )
        _http_error(
            400,
            "VALIDATION_ERROR",
            "Could not create account. Check that your email is valid and "
            "your password is at least 6 characters.",
        )

    data = resp.json()

    # Extract the Supabase user object from the response.
    # Supabase may nest it under 'user' or return it at the top level.
    supabase_user = data.get("user") or data
    user_id: str | None = supabase_user.get("id")
    user_email: str | None = supabase_user.get("email")

    if not user_id or not user_email:
        logger.error("Supabase signup response missing 'id' or 'email': %s", data)
        _http_error(500, "INTERNAL_ERROR", "Unexpected response from authentication service.")

    # Upsert the user into the local `users` table.
    # We use merge() so re-registering (e.g. in dev) doesn't crash on UNIQUE.
    existing = db.query(User).filter(User.id == user_id).first()
    if existing is None:
        local_user = User(
            id=user_id,
            email=user_email,
            role="customer",  # All self-registered users are customers by default.
            created_at=datetime.now(timezone.utc),
        )
        db.add(local_user)
        try:
            db.commit()
            logger.info("New local user created: id=%r email=%r", user_id, user_email)
        except Exception as exc:
            db.rollback()
            logger.error("Failed to create local user record: %s", exc)
            _http_error(
                500,
                "INTERNAL_ERROR",
                "Account was created in Supabase but local registration failed. "
                "Please contact support.",
            )

    return {
        "message": "Account created successfully. Please check your email to confirm your address.",
        "user_id": user_id,
        "email": user_email,
    }


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------

@router.post(
    "/login",
    summary="Log in and receive a JWT",
    tags=["Auth"],
)
def login(payload: AuthRequest) -> dict:
    """
    Authenticate via Supabase and return the JWT access token.

    The returned `access_token` must be included as a Bearer token in
    the Authorization header of every subsequent protected request.

    Per RULES.md § E-4: login failures ALWAYS return "Invalid email or password."
    regardless of the actual reason (email not found vs wrong password).
    """
    if not SUPABASE_URL:
        _http_error(500, "INTERNAL_ERROR", "Authentication service is not configured.")

    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"

    try:
        resp = http.post(
            url,
            headers=_SUPABASE_HEADERS,
            json={"email": payload.email, "password": payload.password},
            timeout=10,
        )
    except http.exceptions.RequestException as exc:
        logger.error("Supabase login request failed: %s", exc)
        _http_error(500, "INTERNAL_ERROR", "Could not reach the authentication service.")

    if resp.status_code != 200:
        # Rule E-4: same message for every login failure — never reveal why.
        logger.info(
            "Failed login attempt for email=%r (Supabase HTTP %d)",
            payload.email,
            resp.status_code,
        )
        _http_error(401, "UNAUTHORIZED", "Invalid email or password.")

    data = resp.json()

    # Return the tokens and a safe user summary.
    # The frontend stores `access_token` and sends it as `Bearer <token>`.
    return {
        "access_token": data.get("access_token"),
        "refresh_token": data.get("refresh_token"),
        "token_type": data.get("token_type", "bearer"),
        "expires_in": data.get("expires_in"),
        "user": {
            "id": data.get("user", {}).get("id"),
            "email": data.get("user", {}).get("email"),
        },
    }


# ---------------------------------------------------------------------------
# POST /auth/logout
# ---------------------------------------------------------------------------

@router.post(
    "/logout",
    summary="Invalidate the current session",
    tags=["Auth"],
)
def logout(payload: LogoutRequest) -> dict:
    """
    Revoke the JWT by calling Supabase's logout endpoint.

    Supabase invalidates the token on their end, making it unusable even
    before its natural expiry.  The frontend should also clear its local
    copy of the token on logout regardless of this response.
    """
    if not SUPABASE_URL:
        _http_error(500, "INTERNAL_ERROR", "Authentication service is not configured.")

    url = f"{SUPABASE_URL}/auth/v1/logout"

    try:
        resp = http.post(
            url,
            headers={
                **_SUPABASE_HEADERS,
                "Authorization": f"Bearer {payload.access_token}",
            },
            timeout=10,
        )
    except http.exceptions.RequestException as exc:
        logger.error("Supabase logout request failed: %s", exc)
        _http_error(500, "INTERNAL_ERROR", "Could not reach the authentication service.")

    # Supabase returns 204 No Content on success.
    if resp.status_code not in (200, 204):
        logger.warning("Supabase logout returned HTTP %d", resp.status_code)
        # Even if the server-side revocation fails, we treat it as success
        # from the client's perspective — the frontend should clear the token.

    return {"message": "Logged out successfully."}


# ---------------------------------------------------------------------------
# GET /auth/me — protected route example (also useful for role detection)
# ---------------------------------------------------------------------------

@router.get(
    "/me",
    response_model=UserProfile,
    summary="Get the current user's profile",
    tags=["Auth"],
)
def get_me(current_user: CurrentUser) -> User:
    """
    Return the authenticated user's local profile.

    Useful for the frontend to:
      - Determine the user's role (customer vs manager) after login.
      - Display the user's email in the navbar.
      - Verify that the JWT is still valid.

    This route is protected by get_current_user (JWT must be present and valid).
    """
    return current_user
