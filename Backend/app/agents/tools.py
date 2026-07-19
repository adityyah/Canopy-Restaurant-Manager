# backend/app/agents/tools.py
# ==============================================================================
# AI Agent Tool Functions — Canopy Restaurant Manager
# ==============================================================================
# These are the 9 pure Python functions that back the LangGraph @tool wrappers
# in agent.py.  They query/mutate the SQLAlchemy database and return plain
# dicts that LangGraph serialises back to the LLM as ToolMessage content.
#
# Architecture note:
#   - tools.py  → pure logic, takes a `db: Session` argument (testable)
#   - agent.py  → @tool wrappers that inject `SessionLocal()` + bind to LLM
#
# Rules enforced here (RULES.md):
#   A-1 / A-2 — only live DB data, never invented data
#   A-3        — stock check before every add/cart op
#   D-1        — CHECK (stock_quantity >= 0) enforced in application layer too
#   D-5        — unit_price snapshotted at add-to-cart time (not at approval)
#   A-7        — stock restoration on modification (PENDING_APPROVAL and APPROVED)
#
# Adapted from the original tools.py (7 tools) with:
#   - Updated model API  (Menu → MenuItem, available_qty → stock_quantity,
#     order_id → id,  customer_thread_id → customer_id,  items JSON → OrderItem rows)
#   - Two new tools:  get_reward_balance, redeem_reward
# ==============================================================================

from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.menu_item import MenuItem
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.reward_point import RewardPoint

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Reward catalogue — point costs for redeemable items
# ---------------------------------------------------------------------------
# Defined here as a central source of truth.  Phase 5 / 6 can expose this via
# a dedicated endpoint; the AI uses it in redeem_reward.
#
# Format:  "item name as it appears in menu_items.name" → point cost (int)
REWARD_CATALOGUE: dict[str, int] = {
    "Lemonade":       100,
    "Masala Chai":    80,
    "Fresh Lime Soda": 120,
    "Garlic Bread":   150,
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_menu_item(db: Session, item_name: str) -> MenuItem | None:
    """
    Case-insensitive exact lookup against active menu items with stock > 0.

    Returns None if the item doesn't exist, is inactive, or is out of stock.
    Enforces Rules A-2 and A-3.
    """
    return (
        db.query(MenuItem)
        .filter(
            MenuItem.name.ilike(item_name),
            MenuItem.is_active.is_(True),
            MenuItem.stock_quantity > 0,
        )
        .first()
    )


def _get_draft_order(db: Session, customer_id: str) -> Order | None:
    """Return the customer's current DRAFT order, or None if none exists."""
    return (
        db.query(Order)
        .filter(
            Order.customer_id == customer_id,
            Order.status == OrderStatus.DRAFT.value,
        )
        .order_by(Order.created_at.desc())
        .first()
    )


def _get_or_create_draft_order(db: Session, customer_id: str) -> Order:
    """
    Return the existing DRAFT order or create a new one.

    A customer can only have one active DRAFT at a time.  If one already
    exists, we reuse it so the cart persists across messages in a session.
    """
    order = _get_draft_order(db, customer_id)
    if order is None:
        order = Order(
            customer_id=customer_id,
            status=OrderStatus.DRAFT.value,
            total_amount=None,
            created_at=datetime.now(timezone.utc),
        )
        db.add(order)
        db.flush()  # Assigns order.id without committing
    return order


# ---------------------------------------------------------------------------
# 1. get_menu_items
# ---------------------------------------------------------------------------

def get_menu_items(
    db: Session,
    category: str | None = None,
    vegetarian_only: bool = False,
    vegan_only: bool = False,
    gluten_free_only: bool = False,
) -> list[dict[str, Any]]:
    """
    Fetch all active, in-stock menu items with optional filters.

    Args:
        category:         If provided, only items in this category.
        vegetarian_only:  If True, only vegetarian items.
        vegan_only:       If True, only vegan items.
        gluten_free_only: If True, only gluten-free items.

    Returns:
        List of dicts with keys: id, name, description, category,
        price, stock_quantity, is_vegetarian, is_vegan, is_gluten_free.
    """
    q = db.query(MenuItem).filter(
        MenuItem.is_active.is_(True),
        MenuItem.stock_quantity > 0,
    )

    if category:
        q = q.filter(MenuItem.category.ilike(category))
    if vegetarian_only:
        q = q.filter(MenuItem.is_vegetarian.is_(True))
    if vegan_only:
        q = q.filter(MenuItem.is_vegan.is_(True))
    if gluten_free_only:
        q = q.filter(MenuItem.is_gluten_free.is_(True))

    items = q.order_by(MenuItem.category, MenuItem.name).all()

    return [
        {
            "id":              item.id,
            "name":            item.name,
            "description":     item.description,
            "category":        item.category,
            "price":           float(item.price),
            "stock_quantity":  item.stock_quantity,
            "is_vegetarian":   item.is_vegetarian,
            "is_vegan":        item.is_vegan,
            "is_gluten_free":  item.is_gluten_free,
        }
        for item in items
    ]


# ---------------------------------------------------------------------------
# 2. get_item_by_name
# ---------------------------------------------------------------------------

def get_item_by_name(db: Session, item_name: str) -> dict[str, Any]:
    """
    Look up a single active, in-stock menu item by name.

    The AI MUST call this before adding an item to the cart.  If it returns
    {"found": False}, the AI must NOT add the item (Rules A-2, A-3).

    Args:
        item_name: The name as spoken/typed by the customer.

    Returns:
        {"found": True, ...item details...}  or  {"found": False, "reason": str}
    """
    item = _get_menu_item(db, item_name)

    if item is None:
        # Check if it exists but is inactive/out-of-stock (better error message)
        inactive = (
            db.query(MenuItem)
            .filter(MenuItem.name.ilike(item_name))
            .first()
        )
        if inactive and not inactive.is_active:
            return {
                "found":  False,
                "reason": f"'{item_name}' is currently unavailable.",
            }
        if inactive and inactive.stock_quantity == 0:
            return {
                "found":  False,
                "reason": f"'{item_name}' is sold out for today.",
            }
        return {
            "found":  False,
            "reason": f"'{item_name}' is not on the menu.",
        }

    return {
        "found":           True,
        "id":              item.id,
        "name":            item.name,
        "description":     item.description,
        "category":        item.category,
        "price":           float(item.price),
        "stock_quantity":  item.stock_quantity,
        "is_vegetarian":   item.is_vegetarian,
        "is_vegan":        item.is_vegan,
        "is_gluten_free":  item.is_gluten_free,
    }


# ---------------------------------------------------------------------------
# 3. add_item_to_cart
# ---------------------------------------------------------------------------

def add_item_to_cart(
    db: Session,
    customer_id: str,
    item_name: str,
    quantity: int,
) -> dict[str, Any]:
    """
    Add `quantity` units of `item_name` to the customer's DRAFT order.

    This function:
      1. Validates the item exists and has sufficient stock (Rules A-2, A-3).
      2. Uses with_for_update() to prevent race conditions (from original tools.py).
      3. Snapshots unit_price from the live menu price (Rule D-5).
      4. If the item is already in the cart, increments quantity.
      5. Does NOT deduct stock here — stock is deducted at submit_order time.

    Args:
        customer_id: The authenticated user's UUID.
        item_name:   Item name as verified by get_item_by_name.
        quantity:    Number of units to add (must be >= 1).

    Returns:
        {"success": bool, "cart_item_id": int | None, "error": str | None}
    """
    if quantity < 1:
        return {"success": False, "cart_item_id": None, "error": "Quantity must be at least 1."}

    # Row-level lock (from original tools.py) — prevents concurrent sessions
    # from adding the same item twice beyond available stock.
    menu_item = (
        db.query(MenuItem)
        .filter(
            MenuItem.name.ilike(item_name),
            MenuItem.is_active.is_(True),
        )
        .with_for_update()
        .first()
    )

    if menu_item is None:
        return {
            "success":      False,
            "cart_item_id": None,
            "error":        f"'{item_name}' is not on the menu or is currently unavailable.",
        }

    if menu_item.stock_quantity < quantity:
        return {
            "success":      False,
            "cart_item_id": None,
            "error": (
                f"Only {menu_item.stock_quantity} unit(s) of '{menu_item.name}' "
                f"available, but {quantity} requested."
            ),
        }

    # Get or create the DRAFT order
    order = _get_or_create_draft_order(db, customer_id)

    # Check if this item is already in the cart
    existing_item = (
        db.query(OrderItem)
        .filter(
            OrderItem.order_id == order.id,
            OrderItem.menu_item_id == menu_item.id,
        )
        .first()
    )

    if existing_item:
        # Verify combined quantity doesn't exceed stock
        new_total_qty = existing_item.quantity + quantity
        if menu_item.stock_quantity < new_total_qty:
            db.rollback()
            return {
                "success":      False,
                "cart_item_id": None,
                "error": (
                    f"Cannot add {quantity} more '{menu_item.name}'. "
                    f"You already have {existing_item.quantity} in your cart "
                    f"and only {menu_item.stock_quantity} are available."
                ),
            }
        existing_item.quantity = new_total_qty
        existing_item.subtotal = float(
            Decimal(str(menu_item.price)) * new_total_qty
        )
        db.commit()
        db.refresh(existing_item)
        return {
            "success":      True,
            "cart_item_id": existing_item.id,
            "error":        None,
        }

    # New line item — snapshot the price (Rule D-5)
    unit_price = float(menu_item.price)
    subtotal   = float(Decimal(str(unit_price)) * quantity)

    cart_item = OrderItem(
        order_id     = order.id,
        menu_item_id = menu_item.id,
        quantity     = quantity,
        unit_price   = unit_price,
        subtotal     = subtotal,
    )
    db.add(cart_item)
    db.commit()
    db.refresh(cart_item)

    logger.info(
        "Added %dx '%s' (₹%.2f each) to cart for customer %s (order %d)",
        quantity, menu_item.name, unit_price, customer_id, order.id,
    )

    return {"success": True, "cart_item_id": cart_item.id, "error": None}


# ---------------------------------------------------------------------------
# 4. remove_item_from_cart
# ---------------------------------------------------------------------------

def remove_item_from_cart(
    db: Session,
    customer_id: str,
    item_name: str,
    quantity: int | None = None,
) -> dict[str, Any]:
    """
    Remove or reduce an item in the customer's DRAFT cart.

    If `quantity` is None or >= the current quantity, the item is fully
    removed.  Otherwise, the quantity is reduced by `quantity`.

    Args:
        customer_id: The authenticated user's UUID.
        item_name:   The item to remove.
        quantity:    Units to remove.  None = remove all.

    Returns:
        {"success": bool, "removed_quantity": int, "error": str | None}
    """
    order = _get_draft_order(db, customer_id)
    if order is None:
        return {"success": False, "removed_quantity": 0, "error": "No active cart found."}

    menu_item = (
        db.query(MenuItem)
        .filter(MenuItem.name.ilike(item_name))
        .first()
    )
    if menu_item is None:
        return {"success": False, "removed_quantity": 0, "error": f"'{item_name}' not found."}

    cart_item = (
        db.query(OrderItem)
        .filter(
            OrderItem.order_id    == order.id,
            OrderItem.menu_item_id == menu_item.id,
        )
        .first()
    )
    if cart_item is None:
        return {
            "success":          False,
            "removed_quantity": 0,
            "error":            f"'{menu_item.name}' is not in your cart.",
        }

    if quantity is None or quantity >= cart_item.quantity:
        removed = cart_item.quantity
        db.delete(cart_item)
        db.commit()
        return {"success": True, "removed_quantity": removed, "error": None}

    cart_item.quantity -= quantity
    cart_item.subtotal  = float(
        Decimal(str(cart_item.unit_price)) * cart_item.quantity
    )
    db.commit()
    return {"success": True, "removed_quantity": quantity, "error": None}


# ---------------------------------------------------------------------------
# 5. get_cart_summary
# ---------------------------------------------------------------------------

def get_cart_summary(db: Session, customer_id: str) -> dict[str, Any]:
    """
    Return the customer's current DRAFT cart contents and grand total.

    Per Rule A-4: the AI MUST call this and present the full summary to the
    customer before calling submit_order().

    Returns:
        {
            "order_id":    int | None,
            "items":       [{"name", "quantity", "unit_price", "subtotal"}, ...],
            "grand_total": float,
            "item_count":  int,
        }
        or {"order_id": None, "items": [], "grand_total": 0.0, "item_count": 0}
        if the cart is empty.
    """
    order = _get_draft_order(db, customer_id)
    if order is None or not order.order_items:
        return {"order_id": None, "items": [], "grand_total": 0.0, "item_count": 0}

    items_out = []
    grand_total = Decimal("0.00")

    for oi in order.order_items:
        subtotal = Decimal(str(oi.subtotal))
        grand_total += subtotal
        items_out.append({
            "name":       oi.menu_item.name,
            "quantity":   oi.quantity,
            "unit_price": float(oi.unit_price),
            "subtotal":   float(subtotal),
        })

    return {
        "order_id":    order.id,
        "items":       items_out,
        "grand_total": float(grand_total),
        "item_count":  len(items_out),
    }


# ---------------------------------------------------------------------------
# 6. clear_cart
# ---------------------------------------------------------------------------

def clear_cart(db: Session, customer_id: str) -> dict[str, Any]:
    """
    Delete all items from the customer's DRAFT cart (but keep the order record).

    Returns:
        {"success": bool, "removed_count": int, "error": str | None}
    """
    order = _get_draft_order(db, customer_id)
    if order is None:
        return {"success": True, "removed_count": 0, "error": None}

    count = len(order.order_items)
    for oi in order.order_items:
        db.delete(oi)
    db.commit()

    return {"success": True, "removed_count": count, "error": None}


# ---------------------------------------------------------------------------
# 7. submit_order
# ---------------------------------------------------------------------------

def submit_order(db: Session, customer_id: str) -> dict[str, Any]:
    """
    Finalise the DRAFT cart: deduct stock and move the order to PENDING_APPROVAL.

    This is the gateway to the HITL flow.  After this call, the manager
    will see the order on their dashboard (Phase 5).

    Steps (per ARCHITECTURE.md § 4, Step 5 and RULES.md § D-1):
      1. Validate the cart is not empty.
      2. Re-validate every item with with_for_update() (belt-and-suspenders).
      3. Deduct stock_quantity for each item.
      4. Set is_active = False for any item that just hit 0 stock (Rule D-1).
      5. Snapshot total_amount.
      6. Set status → PENDING_APPROVAL and submitted_at timestamp.

    Returns:
        {"success": bool, "order_id": int | None, "total_amount": float | None,
         "error": str | None}
    """
    order = _get_draft_order(db, customer_id)
    if order is None or not order.order_items:
        return {
            "success":      False,
            "order_id":     None,
            "total_amount": None,
            "error":        "Your cart is empty. Add items before submitting.",
        }

    errors: list[str] = []
    grand_total = Decimal("0.00")

    # Re-validate with row locks (from original tools.py pattern)
    for oi in order.order_items:
        menu_item = (
            db.query(MenuItem)
            .filter(
                MenuItem.id == oi.menu_item_id,
                MenuItem.is_active.is_(True),
            )
            .with_for_update()
            .first()
        )
        if menu_item is None:
            errors.append(f"'{oi.menu_item.name}' is no longer available.")
            continue
        if menu_item.stock_quantity < oi.quantity:
            errors.append(
                f"'{menu_item.name}': only {menu_item.stock_quantity} left "
                f"but you requested {oi.quantity}."
            )

    if errors:
        db.rollback()
        return {
            "success":      False,
            "order_id":     None,
            "total_amount": None,
            "error":        "Stock check failed: " + "; ".join(errors),
        }

    # Deduct stock and auto-deactivate at zero (Rule D-1)
    for oi in order.order_items:
        menu_item = (
            db.query(MenuItem)
            .filter(MenuItem.id == oi.menu_item_id)
            .with_for_update()
            .first()
        )
        menu_item.stock_quantity -= oi.quantity
        if menu_item.stock_quantity == 0:
            menu_item.is_active = False
            logger.info(
                "Auto-deactivated '%s' (stock hit 0)", menu_item.name
            )
        grand_total += Decimal(str(oi.subtotal))

    # Transition order state (Rule D-2: must pass through PENDING_APPROVAL)
    order.status       = OrderStatus.PENDING_APPROVAL.value
    order.total_amount = float(grand_total)
    order.submitted_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(order)

    logger.info(
        "Order #%d submitted by customer %s — total ₹%.2f, %d item(s)",
        order.id, customer_id, order.total_amount, len(order.order_items),
    )

    return {
        "success":      True,
        "order_id":     order.id,
        "total_amount": float(order.total_amount),
        "error":        None,
    }


# ---------------------------------------------------------------------------
# 8. get_reward_balance  (NEW)
# ---------------------------------------------------------------------------

def get_reward_balance(db: Session, customer_id: str) -> dict[str, Any]:
    """
    Calculate the customer's current loyalty point balance.

    Per ARCHITECTURE.md § 3 Table 5 and PRD § F-C8:
        Balance = SUM(points_change) for all rows in reward_points
        where customer_id matches.

    There is NO single balance column — the balance is always calculated from
    the full ledger history.  This makes the record auditable.

    Returns:
        {"balance": int, "transaction_count": int}
    """
    result = (
        db.query(func.sum(RewardPoint.points_change))
        .filter(RewardPoint.customer_id == customer_id)
        .scalar()
    )
    balance = int(result or 0)

    count = (
        db.query(func.count(RewardPoint.id))
        .filter(RewardPoint.customer_id == customer_id)
        .scalar()
    )

    return {
        "balance":           balance,
        "transaction_count": int(count or 0),
        "available_rewards": [
            {"name": item, "point_cost": cost}
            for item, cost in REWARD_CATALOGUE.items()
            if cost <= balance
        ],
    }


# ---------------------------------------------------------------------------
# 9. redeem_reward  (NEW)
# ---------------------------------------------------------------------------

def redeem_reward(
    db: Session,
    customer_id: str,
    reward_item_name: str,
) -> dict[str, Any]:
    """
    Redeem loyalty points for a free menu item and add it to the DRAFT cart.

    Per ARCHITECTURE.md § 4 Step 4A:
      1. Verify the reward exists in REWARD_CATALOGUE.
      2. Check the customer has enough points.
      3. Verify the item exists and is active in menu_items.
      4. Add the item to the DRAFT cart with unit_price = 0.
      5. Insert a NEGATIVE reward_points ledger entry (points deducted).
         Both steps must succeed or both roll back (atomicity).

    Points rules (PRD § F-C8):
      - Negative entries represent redemptions.
      - The balance is always re-summed — never a single column.

    Args:
        customer_id:      The authenticated customer's UUID.
        reward_item_name: The name of the item to redeem (must be in REWARD_CATALOGUE).

    Returns:
        {"success": bool, "points_spent": int, "remaining_balance": int,
         "item_added": str | None, "error": str | None}
    """
    # Step 1 — Check reward catalogue
    # Case-insensitive match against catalogue keys
    matched_key: str | None = None
    for key in REWARD_CATALOGUE:
        if key.lower() == reward_item_name.strip().lower():
            matched_key = key
            break

    if matched_key is None:
        return {
            "success":           False,
            "points_spent":      0,
            "remaining_balance": None,
            "item_added":        None,
            "error": (
                f"'{reward_item_name}' is not available as a reward. "
                f"Available rewards: {list(REWARD_CATALOGUE.keys())}"
            ),
        }

    point_cost = REWARD_CATALOGUE[matched_key]

    # Step 2 — Check balance (RULES.md Rule D-4 companion: points must be real)
    balance_data = get_reward_balance(db, customer_id)
    current_balance: int = balance_data["balance"]

    if current_balance < point_cost:
        return {
            "success":           False,
            "points_spent":      0,
            "remaining_balance": current_balance,
            "item_added":        None,
            "error": (
                f"Insufficient points. '{matched_key}' costs {point_cost} points "
                f"but you only have {current_balance}."
            ),
        }

    # Step 3 — Verify item exists in menu (even reward items must be real)
    menu_item = (
        db.query(MenuItem)
        .filter(
            MenuItem.name.ilike(matched_key),
            MenuItem.is_active.is_(True),
        )
        .first()
    )
    if menu_item is None:
        return {
            "success":           False,
            "points_spent":      0,
            "remaining_balance": current_balance,
            "item_added":        None,
            "error": (
                f"'{matched_key}' is currently unavailable even as a reward. "
                f"Please choose another."
            ),
        }

    # Step 4 — Add item to cart at ₹0 (free!)
    order = _get_or_create_draft_order(db, customer_id)

    # Check if item already in cart as a redemption
    existing_redeemed = (
        db.query(OrderItem)
        .filter(
            OrderItem.order_id    == order.id,
            OrderItem.menu_item_id == menu_item.id,
            OrderItem.unit_price  == 0,
        )
        .first()
    )

    if existing_redeemed:
        return {
            "success":           False,
            "points_spent":      0,
            "remaining_balance": current_balance,
            "item_added":        None,
            "error":             f"You have already redeemed a free '{matched_key}' for this order.",
        }

    # Add the free item (unit_price = 0, subtotal = 0)
    redeemed_cart_item = OrderItem(
        order_id     = order.id,
        menu_item_id = menu_item.id,
        quantity     = 1,
        unit_price   = 0.0,
        subtotal     = 0.0,
    )
    db.add(redeemed_cart_item)
    db.flush()  # Get ID without committing

    # Step 5 — Deduct points from ledger (negative entry)
    ledger_entry = RewardPoint(
        customer_id   = customer_id,
        order_id      = order.id,
        points_change = -point_cost,
        reason        = f"Redeemed for free {matched_key} — Order #{order.id}",
        created_at    = datetime.now(timezone.utc),
    )
    db.add(ledger_entry)
    db.commit()

    new_balance = current_balance - point_cost

    logger.info(
        "Reward redeemed: customer %s got free '%s' for %d points (balance: %d → %d)",
        customer_id, matched_key, point_cost, current_balance, new_balance,
    )

    return {
        "success":           True,
        "points_spent":      point_cost,
        "remaining_balance": new_balance,
        "item_added":        matched_key,
        "error":             None,
    }
