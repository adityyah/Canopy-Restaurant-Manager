# backend/app/routes/manager.py
# ==============================================================================
# Manager Utility Routes — Phase 3.5
# ==============================================================================
# Two special manager-only endpoints:
#
#   POST /manager/menu/auto-delight
#       Finds the active menu item with the highest stock_quantity and marks it
#       as today's Daily Delight (is_daily_delight=True), resetting all others
#       to False.  Returns the chosen item.
#       Use case: manager clicks "Pick Today's Special" in the dashboard.
#
#   GET /manager/insights
#       Queries the DB for critically low-stock items (< 5 units) and recent
#       PENDING_APPROVAL orders, then passes that raw context to GPT-4o-mini
#       and returns a 2-sentence managerial advisory.
#       Use case: manager wants a quick AI-generated briefing each morning.
#
# Auth: both routes require `require_manager` — customers cannot access them.
# ==============================================================================

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import require_manager
from app.models.menu_item import MenuItem
from app.models.order import Order, OrderStatus
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()

# OpenAI client — reads OPENAI_API_KEY from the environment.
_openai_client = OpenAI()


# ---------------------------------------------------------------------------
# Pydantic Response Schemas
# ---------------------------------------------------------------------------

class DelightResponse(BaseModel):
    """Response returned after auto-delight assignment."""

    id: int
    name: str
    category: str
    price: float
    stock_quantity: int
    description: str | None
    message: str


class InsightsResponse(BaseModel):
    """Response returned from the AI inventory advisor."""

    summary: str
    low_stock_items: list[dict]
    pending_order_count: int


# ---------------------------------------------------------------------------
# POST /manager/menu/auto-delight
# ---------------------------------------------------------------------------

@router.post(
    "/menu/auto-delight",
    response_model=DelightResponse,
    summary="Automatically assign today's Daily Delight",
    description=(
        "Finds the active menu item with the highest stock_quantity, marks it as "
        "`is_daily_delight = True`, and resets all other items to `False`. "
        "The AI will recommend this item in its greeting. "
        "Requires manager authentication."
    ),
    tags=["Manager — Daily Delight"],
)
def auto_assign_daily_delight(
    current_manager: Annotated[User, Depends(require_manager)],
    db: Session = Depends(get_db),
) -> DelightResponse:
    """
    Pick the highest-stock active item as today's Daily Delight.

    Steps:
      1. Find all active items (is_active=True, stock_quantity > 0).
      2. Sort by stock_quantity descending — highest stock wins.
      3. In a single transaction: reset all items to is_daily_delight=False,
         then set the winner to True.
      4. Return the winner with a confirmation message.

    This is safe to call repeatedly — it is idempotent given the same stock levels.
    """
    # Step 1 & 2: Find winner
    winner = (
        db.query(MenuItem)
        .filter(
            MenuItem.is_active.is_(True),
            MenuItem.stock_quantity > 0,
        )
        .order_by(MenuItem.stock_quantity.desc())
        .first()
    )

    if winner is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error":   True,
                "code":    "NO_ACTIVE_ITEMS",
                "message": "No active menu items with stock > 0 found. Cannot assign a Daily Delight.",
            },
        )

    # Step 3: Atomic reset + assign in one transaction
    db.query(MenuItem).update(
        {MenuItem.is_daily_delight: False},
        synchronize_session="fetch",
    )
    winner.is_daily_delight = True
    db.commit()
    db.refresh(winner)

    logger.info(
        "Daily Delight assigned: '%s' (id=%d, stock=%d) by manager %s",
        winner.name,
        winner.id,
        winner.stock_quantity,
        current_manager.id,
    )

    return DelightResponse(
        id            = winner.id,
        name          = winner.name,
        category      = winner.category,
        price         = float(winner.price),
        stock_quantity = winner.stock_quantity,
        description   = winner.description,
        message=(
            f"✅ Today's Daily Delight is now '{winner.name}' "
            f"({winner.category}, ₹{float(winner.price):.2f}). "
            f"The AI will recommend it to customers in their greeting."
        ),
    )


# ---------------------------------------------------------------------------
# GET /manager/insights
# ---------------------------------------------------------------------------

@router.get(
    "/insights",
    response_model=InsightsResponse,
    summary="AI-generated inventory & order advisory for the manager",
    description=(
        "Queries the database for critically low-stock items (< 5 units) and recent "
        "PENDING_APPROVAL orders, then passes this raw data to GPT-4o-mini and returns "
        "a 2-sentence advisory. Requires manager authentication."
    ),
    tags=["Manager — AI Insights"],
)
def get_ai_insights(
    current_manager: Annotated[User, Depends(require_manager)],
    db: Session = Depends(get_db),
) -> InsightsResponse:
    """
    Generate a quick AI-written briefing for the manager.

    Data gathered from the DB:
      - Items with stock_quantity < 5 (critical low stock).
      - Number of orders currently in PENDING_APPROVAL status.
      - Any order placed in the last 24 hours (to give context on demand).

    The raw data is sent to GPT-4o-mini with a tightly scoped prompt.
    The model returns exactly 2 sentences:
      Sentence 1 — most urgent inventory warning.
      Sentence 2 — actionable recommendation.

    The raw DB data is ALSO returned alongside the AI text so the frontend
    can render it in a structured way (e.g., a table of low-stock items).
    """
    # ── 1. Query low-stock items ────────────────────────────────────────────
    low_stock_items_db = (
        db.query(MenuItem)
        .filter(
            MenuItem.is_active.is_(True),
            MenuItem.stock_quantity < 5,
        )
        .order_by(MenuItem.stock_quantity.asc())
        .all()
    )

    low_stock_list = [
        {
            "name":           item.name,
            "category":       item.category,
            "stock_quantity": item.stock_quantity,
        }
        for item in low_stock_items_db
    ]

    # ── 2. Query pending order count ────────────────────────────────────────
    pending_count: int = (
        db.query(Order)
        .filter(Order.status == OrderStatus.PENDING_APPROVAL.value)
        .count()
    )

    # ── 3. Recent orders (last 24h) for demand context ─────────────────────
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    recent_order_count: int = (
        db.query(Order)
        .filter(Order.created_at >= cutoff)
        .count()
    )

    # ── 4. Build the context string for the LLM ────────────────────────────
    if low_stock_list:
        low_stock_str = "; ".join(
            f"{item['name']} ({item['stock_quantity']} left)"
            for item in low_stock_list
        )
    else:
        low_stock_str = "No items are critically low."

    context_prompt = (
        f"You are a concise restaurant management assistant. "
        f"Write exactly 2 sentences. "
        f"Sentence 1: summarise the most urgent inventory risk based on this data. "
        f"Sentence 2: give one specific, actionable recommendation to the manager.\n\n"
        f"Data:\n"
        f"- Critically low stock (< 5 units): {low_stock_str}\n"
        f"- Orders currently awaiting manager approval: {pending_count}\n"
        f"- Orders placed in the last 24 hours: {recent_order_count}\n"
    )

    # ── 5. Call GPT-4o-mini for the advisory ───────────────────────────────
    try:
        completion = _openai_client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.4,          # Slightly creative but mostly factual
            max_tokens=120,           # 2 sentences = well under 120 tokens
            messages=[
                {
                    "role":    "system",
                    "content": (
                        "You are a restaurant operations advisor. "
                        "Be direct, specific, and professional. "
                        "Write exactly 2 sentences."
                    ),
                },
                {"role": "user", "content": context_prompt},
            ],
        )
        ai_summary: str = completion.choices[0].message.content.strip()
    except Exception as exc:
        logger.error("OpenAI call failed in /manager/insights: %s", exc)
        # Fail gracefully — return a structured fallback instead of a 500.
        ai_summary = (
            f"⚠️ AI summary unavailable (OpenAI error). "
            f"Manual check needed: {len(low_stock_list)} low-stock item(s), "
            f"{pending_count} order(s) pending approval."
        )

    logger.info(
        "AI Insights requested by manager %s — %d low-stock items, %d pending orders",
        current_manager.id,
        len(low_stock_list),
        pending_count,
    )

    return InsightsResponse(
        summary            = ai_summary,
        low_stock_items    = low_stock_list,
        pending_order_count = pending_count,
    )
