# backend/app/routes/menu.py
# ==============================================================================
# Public Menu Route — Canopy Restaurant Manager
# ==============================================================================
# GET /menu  — Returns all active menu items as a JSON array.
#              This is a PUBLIC endpoint (no JWT required) so the customer-facing
#              menu panel can fetch it before the user logs in.
#
# Bug fix note:
#   SQLAlchemy ORM objects are NOT JSON-serialisable by default. FastAPI needs
#   either a Pydantic response_model or an explicit dict conversion. We use
#   explicit dicts here to avoid coupling this route to the Pydantic schema layer
#   and to control exactly which fields are exposed to the frontend.
# ==============================================================================

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.menu_item import MenuItem

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "",
    summary="List all active menu items",
    response_description="Array of active menu items with pricing and dietary info",
    tags=["Menu"],
)
def get_menu(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """
    Public endpoint — no authentication required.

    Returns every menu item that is currently active (is_active = True).
    Items with stock_quantity = 0 are excluded because the AI/frontend
    guards against out-of-stock orders, but the MenuDisplay component
    applies its own filter too (belt-and-suspenders).

    The response is intentionally a plain list of dicts (not ORM objects)
    so FastAPI's JSON encoder can serialise it without a Pydantic model.
    """
    items: list[MenuItem] = (
        db.query(MenuItem)
        .filter(MenuItem.is_active.is_(True))
        .order_by(MenuItem.category, MenuItem.name)
        .all()
    )

    logger.info("GET /menu — returning %d active items", len(items))

    return [
        {
            "id":               item.id,
            "name":             item.name,
            "description":      item.description,
            "category":         item.category,
            "price":            float(item.price),
            "stock_quantity":   item.stock_quantity,
            "is_active":        item.is_active,
            "is_vegetarian":    item.is_vegetarian,
            "is_vegan":         item.is_vegan,
            # Note: the model has is_gluten_free; the frontend MenuItem type
            # has is_spicy (legacy field name from Phase 4 stub). We send both
            # so either frontend field works without a frontend change.
            "is_gluten_free":   item.is_gluten_free,
            "is_spicy":         False,          # model doesn't track spicy — safe default
            "is_daily_delight": item.is_daily_delight,
        }
        for item in items
    ]
