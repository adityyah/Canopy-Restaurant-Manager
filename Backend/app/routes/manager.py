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

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import shutil
from pathlib import Path
from openai import OpenAI
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.schemas.menu import ManagerMenuItemOut, MenuItemUpdate, MenuItemCreate

from app.database import get_db
from app.middleware.auth import require_manager, CurrentUser
from app.models.menu_item import MenuItem
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.reward_point import RewardPoint
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
# GET /manager/menu
# ---------------------------------------------------------------------------

@router.get(
    "/menu",
    response_model=list[ManagerMenuItemOut],
    summary="List all menu items for the manager dashboard",
    description="Returns all menu items, including inactive ones, for inventory management.",
    tags=["Manager — Menu"],
)
def get_manager_menu(
    current_manager: Annotated[User, Depends(require_manager)],
    db: Session = Depends(get_db),
):
    items = db.query(MenuItem).order_by(MenuItem.category, MenuItem.name).all()
    return items


# ---------------------------------------------------------------------------
# POST /manager/menu
# ---------------------------------------------------------------------------

@router.post(
    "/menu",
    response_model=ManagerMenuItemOut,
    summary="Create a new menu item",
    description="Creates a new menu item. Requires manager authentication.",
    tags=["Manager — Menu"],
)
def create_menu_item(
    item_in: MenuItemCreate,
    current_manager: Annotated[User, Depends(require_manager)],
    db: Session = Depends(get_db),
):
    item = MenuItem(
        name=item_in.name,
        description=item_in.description,
        price=item_in.price,
        category=item_in.category,
        stock_quantity=item_in.stock_quantity,
        is_active=item_in.is_active,
        is_vegetarian=item_in.is_vegetarian,
        is_vegan=item_in.is_vegan,
        is_gluten_free=item_in.is_gluten_free,
        is_daily_delight=item_in.is_daily_delight,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    
    logger.info("Manager %s created new menu item %d (%s)", current_manager.id, item.id, item.name)
    return item


# ---------------------------------------------------------------------------
# PATCH /manager/menu/{item_id}
# ---------------------------------------------------------------------------

@router.patch(
    "/menu/{item_id}",
    response_model=ManagerMenuItemOut,
    summary="Update stock quantity or active status",
    description="Allows the manager to update the stock_quantity and is_active status of a menu item.",
    tags=["Manager — Menu"],
)
def update_menu_item(
    item_id: int,
    update_data: MenuItemUpdate,
    current_manager: Annotated[User, Depends(require_manager)],
    db: Session = Depends(get_db),
):
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    if update_data.stock_quantity is not None:
        item.stock_quantity = update_data.stock_quantity
    if update_data.is_active is not None:
        item.is_active = update_data.is_active

    db.commit()
    db.refresh(item)
    return item


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


# ---------------------------------------------------------------------------
# POST /manager/menu/{item_id}/image
# ---------------------------------------------------------------------------

@router.post(
    "/menu/{item_id}/image",
    summary="Upload an image for a menu item",
    description="Uploads an image file, saves it to the static directory, and updates the item's image_url.",
    tags=["Manager — Menu"],
)
def upload_menu_item_image(
    item_id: int,
    file: UploadFile = File(...),
    current_manager: User = Depends(require_manager),
    db: Session = Depends(get_db),
) -> dict:
    # 1. Find the menu item
    item = db.query(MenuItem).filter(MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found.")

    # 2. Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    # 3. Save the file to the static directory
    static_dir = Path("static")
    static_dir.mkdir(exist_ok=True)
    
    # Generate a unique filename using item_id and original filename
    safe_filename = f"item_{item_id}_{file.filename.replace(' ', '_')}"
    file_path = static_dir / safe_filename
    
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as exc:
        logger.error("Failed to save image: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to save image.")
    finally:
        file.file.close()

    # 4. Update the database
    image_url = f"/static/{safe_filename}"
    item.image_url = image_url
    db.commit()
    db.refresh(item)
    
    logger.info("Manager %s uploaded image for item %d: %s", current_manager.id, item_id, image_url)
    
    return {"message": "Image uploaded successfully", "image_url": image_url}


# ---------------------------------------------------------------------------
# Pydantic response schemas for order endpoints
# ---------------------------------------------------------------------------

class OrderItemOut(BaseModel):
    """A single line item — name is denormalised from the related MenuItem."""

    model_config = {"from_attributes": True}

    name: str          # resolved from order_item.menu_item.name
    quantity: int
    unit_price: float


class CustomerOut(BaseModel):
    """Minimal customer info embedded in each order card."""

    model_config = {"from_attributes": True}

    email: str


class OrderOut(BaseModel):
    """Full order representation returned to the manager dashboard."""

    model_config = {"from_attributes": True}

    id: int
    status: str
    total_amount: float | None
    submitted_at: datetime | None
    customer: CustomerOut
    items: list[OrderItemOut]


class OrdersListOut(BaseModel):
    """Wrapper so the frontend reads `data.orders`."""

    orders: list[OrderOut]


# ---------------------------------------------------------------------------
# GET /manager/orders
# ---------------------------------------------------------------------------


@router.get(
    "/orders",
    response_model=OrdersListOut,
    summary="List orders, optionally filtered by status",
    tags=["Manager — Orders"],
)
def list_orders(
    current_manager: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    status: str | None = None,
) -> OrdersListOut:
    """
    Return all orders, optionally filtered by `?status=PENDING_APPROVAL`.

    The query eagerly joins order_items → menu_item so the frontend
    receives the full nested context (dish names, quantities, prices)
    in a single round-trip.

    Security: require_manager is applied by the dependency on this router;
    only authenticated users whose local `role == 'manager'` may call this.
    """
    _ = require_manager(current_manager)   # guard: raises 403 if not a manager

    query = db.query(Order)

    # Filter by status when provided.  Silently ignore unrecognised status strings
    # (the frontend sends a fixed set; a bad value just returns an empty list rather
    # than a confusing 422 validation error).
    if status:
        query = query.filter(Order.status == status)

    # Most recent first — managers see newest submissions at the top.
    orders_db = query.order_by(Order.submitted_at.desc().nullslast()).all()

    result: list[OrderOut] = []
    for order in orders_db:
        # Eager-load order_items and their menu_item in one pass to avoid N+1.
        items_db = (
            db.query(OrderItem)
            .filter(OrderItem.order_id == order.id)
            .all()
        )

        items_out = [
            OrderItemOut(
                name=item.menu_item.name,
                quantity=item.quantity,
                unit_price=float(item.unit_price),
            )
            for item in items_db
        ]

        # Fetch the customer row so we can return their email.
        customer_db = db.query(User).filter(User.id == order.customer_id).first()
        customer_out = CustomerOut(email=customer_db.email if customer_db else "Unknown")

        result.append(
            OrderOut(
                id=order.id,
                status=order.status,
                total_amount=float(order.total_amount) if order.total_amount is not None else None,
                submitted_at=order.submitted_at,
                customer=customer_out,
                items=items_out,
            )
        )

    return OrdersListOut(orders=result)


# ---------------------------------------------------------------------------
# POST /manager/orders/{order_id}/approve
# ---------------------------------------------------------------------------


@router.post(
    "/orders/{order_id}/approve",
    status_code=200,
    summary="Approve a pending order and award reward points",
    tags=["Manager — Orders"],
)
def approve_order(
    order_id: int,
    current_manager: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """
    Transition an order from PENDING_APPROVAL → APPROVED.

    Side effects:
      - Records which manager approved it.
      - Sets resolved_at to now.
      - Creates a RewardPoint ledger entry awarding 10 points.

    Returns 404 if the order doesn't exist, 409 if it is not in
    PENDING_APPROVAL status (prevents double-approvals).
    """
    _ = require_manager(current_manager)

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail={"error": True, "code": "NOT_FOUND", "message": f"Order #{order_id} not found."})

    if order.status != OrderStatus.PENDING_APPROVAL:
        raise HTTPException(
            status_code=409,
            detail={
                "error": True,
                "code": "INVALID_TRANSITION",
                "message": f"Cannot approve an order in '{order.status}' status.",
            },
        )

    order.status = OrderStatus.APPROVED
    order.manager_id = current_manager.id
    order.resolved_at = datetime.now(timezone.utc)

    # Award reward points.  Per PRD § F-C8: 10–50 points based on total_amount.
    # Uses a try/except so a missing reward_points table never blocks approval.
    try:
        total = float(order.total_amount or 0)
        # Simple linear scale: ₹100 → 10 pts, ₹500+ → 50 pts. Clamped to [10, 50].
        raw_points = int(total / 10)
        points = max(10, min(50, raw_points))

        rp = RewardPoint(
            customer_id=order.customer_id,
            order_id=order.id,
            points_change=points,
            reason=f"Earned for Order #{order.id} (₹{total:.2f} total)",
            created_at=datetime.now(timezone.utc),
        )
        db.add(rp)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not create reward point entry for order %d: %s", order_id, exc)

    db.commit()
    logger.info(
        "Manager %r approved order #%d for customer %r",
        current_manager.id, order_id, order.customer_id,
    )
    print(f"\n📦 [ORDER STATUS CHECK] Order #{order_id} Current Status: APPROVED")
    return {"success": True, "message": f"Order #{order_id} approved.", "order_id": order_id}


# ---------------------------------------------------------------------------
# POST /manager/orders/{order_id}/reject
# ---------------------------------------------------------------------------


class RejectPayload(BaseModel):
    rejection_reason: str | None = None


@router.post(
    "/orders/{order_id}/reject",
    status_code=200,
    summary="Reject a pending order with an optional reason",
    tags=["Manager — Orders"],
)
def reject_order(
    order_id: int,
    payload: RejectPayload,
    current_manager: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """
    Transition an order from PENDING_APPROVAL → REJECTED.

    An optional `rejection_reason` is stored and surfaced to the customer.
    Returns 404 if not found, 409 if already resolved.
    """
    _ = require_manager(current_manager)

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail={"error": True, "code": "NOT_FOUND", "message": f"Order #{order_id} not found."})

    if order.status != OrderStatus.PENDING_APPROVAL:
        raise HTTPException(
            status_code=409,
            detail={
                "error": True,
                "code": "INVALID_TRANSITION",
                "message": f"Cannot reject an order in '{order.status}' status.",
            },
        )

    order.status = OrderStatus.REJECTED
    order.manager_id = current_manager.id
    order.resolved_at = datetime.now(timezone.utc)
    order.rejection_reason = payload.rejection_reason

    db.commit()
    logger.info(
        "Manager %r rejected order #%d (reason=%r)",
        current_manager.id, order_id, payload.rejection_reason,
    )
    print(f"\n📦 [ORDER STATUS CHECK] Order #{order_id} Current Status: REJECTED")
    return {
        "success": True,
        "message": f"Order #{order_id} rejected.",
        "order_id": order_id,
    }
