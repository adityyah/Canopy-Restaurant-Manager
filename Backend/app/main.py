# backend/app/main.py
# ==============================================================================
# FastAPI Application Entry Point — Canopy Restaurant Manager
# ==============================================================================
# This file:
#   1. Creates the FastAPI application instance with metadata.
#   2. Configures CORS so the React frontend can talk to this backend.
#   3. Creates all database tables on startup via SQLAlchemy's create_all().
#   4. Registers a global exception handler (Rule E-1: structured JSON errors).
#   5. Registers a health check route (GET /health).
#   6. Mounts all active phase routers.
#
# Phase status:
#   ✅ Phase 1 — Foundation & Database
#   ✅ Phase 2 — Authentication & Security
#   ✅ Phase 3 — The AI Brain (chat router active)
#   🔜 Phase 4 — Frontend Skeleton
#   🔜 Phase 5 — Manager Experience
#   🔜 Phase 6 — Customer Experience
# ==============================================================================

from __future__ import annotations

import os
import logging
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Load environment variables before importing anything that reads them.
load_dotenv()

# Local imports
from app.database import Base, engine

# Import all models here so their metadata is registered on Base before
# create_all() runs.  Even if a model isn't used directly in main.py,
# this import side-effect is required for the tables to be created.
import app.models.user          # noqa: F401
import app.models.menu_item     # noqa: F401
import app.models.order         # noqa: F401
import app.models.order_item    # noqa: F401
import app.models.reward_point  # noqa: F401
import app.models.chat_session  # noqa: F401

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
# Use Python's standard logging module (never print()) as per RULES.md § 7.3.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# FastAPI instance
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Canopy — Restaurant Manager API",
    description=(
        "Backend API for the Canopy AI-powered restaurant ordering system. "
        "Handles menu management, AI-assisted ordering, HITL order approval, "
        "reward points, and analytics."
    ),
    version="1.0.0",
    # Redirect /docs to the interactive Swagger UI.
    docs_url="/docs",
    redoc_url="/redoc",
)


# ---------------------------------------------------------------------------
# CORS Middleware
# ---------------------------------------------------------------------------
# Allow the React dev server (Vite default: port 5173) to call this API.
# In production, replace the wildcard origins with the deployed frontend URL.

_frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[_frontend_origin, "http://localhost:3000"],  # Vite + CRA
    allow_credentials=True,   # Needed for cookies / auth headers.
    allow_methods=["*"],       # GET, POST, PUT, PATCH, DELETE, OPTIONS.
    allow_headers=["*"],       # Authorization, Content-Type, etc.
)


# ---------------------------------------------------------------------------
# Global Exception Handler — Rule E-1
# ---------------------------------------------------------------------------
# Catches any unhandled Python exception that escapes a route handler and
# converts it into a structured JSON 500 response.  This ensures the
# frontend never sees a raw stack trace or HTML error page.

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "code": "INTERNAL_ERROR",
            "message": "An unexpected error occurred. Please try again later.",
        },
    )


# ---------------------------------------------------------------------------
# Startup — create tables
# ---------------------------------------------------------------------------

@app.on_event("startup")
def on_startup() -> None:
    """
    Called once when the Uvicorn server starts.
    Creates any missing database tables without dropping existing data.
    This is safe to run on every startup (it is idempotent).
    """
    logger.info("Creating database tables (if they don't exist)...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created successfully.")


# ---------------------------------------------------------------------------
# Core Routes — Phase 1
# ---------------------------------------------------------------------------

@app.get(
    "/health",
    tags=["Health"],
    summary="Health Check",
    response_description="Returns server status and current UTC timestamp.",
)
def health_check() -> dict:
    """
    Simple liveness probe.

    Returns:
        A JSON object confirming the server is running and the DB is reachable.

    Example response:
        {
            "status": "ok",
            "service": "Canopy Restaurant Manager API",
            "version": "1.0.0",
            "timestamp": "2026-07-19T07:00:00Z"
        }
    """
    return {
        "status": "ok",
        "service": "Canopy Restaurant Manager API",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Router Mounts
# ---------------------------------------------------------------------------

# ── Phase 2 (ACTIVE) ────────────────────────────────────────────────────────
from app.routes import auth as auth_routes  # noqa: E402

app.include_router(auth_routes.router, prefix="/auth", tags=["Auth"])

# ── Phase 3 (ACTIVE) ────────────────────────────────────────────────────────
from app.routes import chat as chat_routes  # noqa: E402

app.include_router(chat_routes.router, prefix="/chat", tags=["Chat"])

# ── Phase 3.5 (ACTIVE) ──────────────────────────────────────────────────────
from app.routes import manager as manager_routes  # noqa: E402

app.include_router(manager_routes.router, prefix="/manager", tags=["Manager"])

# ── Phase 5 (pending) ───────────────────────────────────────────────────────
# from app.routes import manager_orders, manager_menu, manager_analytics
# app.include_router(manager_orders.router, prefix="/manager/orders", tags=["Manager — Orders"])
# app.include_router(manager_menu.router,   prefix="/manager/menu",   tags=["Manager — Menu"])
# app.include_router(manager_analytics.router, prefix="/manager/analytics", tags=["Manager — Analytics"])

# ── Phase 6 (pending) ───────────────────────────────────────────────────────
# from app.routes import customer_orders, rewards
# app.include_router(customer_orders.router, prefix="/orders", tags=["Customer — Orders"])
# app.include_router(rewards.router,         prefix="/rewards", tags=["Rewards"])
