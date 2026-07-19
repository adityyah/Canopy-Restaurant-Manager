# backend/app/models/menu_item.py
# ==============================================================================
# SQLAlchemy Model — `menu_items` Table
# ==============================================================================
# Per ARCHITECTURE.md § 3 (Table 2) and PHASES.md § 1.4:
#
#   "Stores every dish or drink the restaurant offers, along with its current
#    availability and stock."
#
# Critical requirements from the docs:
#   1. CHECK (stock_quantity >= 0)  — RULES.md § D-1 and PHASES.md § 1.4:
#      "Add a database-level constraint: CHECK (stock_quantity >= 0)"
#      Stock must NEVER go below zero. Enforced at the DB level here AND
#      at the application level in route handlers.
#
#   2. is_active auto-set to False when stock_quantity reaches 0.
#      This logic lives in the service layer (not the model), but is noted here
#      for clarity.  RULES.md § D-1: "When stock_quantity reaches 0, the
#      is_active flag for that item must be automatically set to false."
#
#   3. name is UNIQUE — the AI tool `get_item_by_name` relies on this to do
#      a deterministic single-row lookup.
#
#   4. updated_at uses `onupdate` to auto-refresh whenever a row is changed.
#      This is used by the AI tools to detect stale reads (RULES.md § D-1).
# ==============================================================================

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Integer,
    Numeric,
    String,
    Text,
    event,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MenuItem(Base):
    """
    Represents a single dish, drink, or food item on the restaurant's menu.

    Dietary flags (is_vegetarian, is_vegan, is_gluten_free) are queried by the
    AI agent's `get_menu_items` tool when a customer asks for dietary-specific
    options (e.g. "show me vegan options").

    When `stock_quantity` hits 0, the service layer sets `is_active = False`
    so the AI stops recommending the item (RULES.md § A-2 and § D-1).
    """

    __tablename__ = "menu_items"

    __table_args__ = (
        # CRITICAL: Rule D-1 — stock can never go negative.
        # This is the database-level enforcement (application-level check
        # is in the route handler / service layer as a belt-and-suspenders
        # approach).
        CheckConstraint("stock_quantity >= 0", name="ck_menu_items_stock_non_negative"),
    )

    # --------------------------------------------------------------------------
    # Columns
    # --------------------------------------------------------------------------

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Auto-incremented surrogate key",
    )

    name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        unique=True,  # Enables deterministic lookup in get_item_by_name()
        index=True,
        comment="Display name of the menu item — must be unique across the menu",
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Short description shown to the customer and used by the AI",
    )

    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,  # The AI filters by category; index speeds this up.
        comment="Menu category e.g. Starters, Mains, Desserts, Beverages",
    )

    # Using Numeric(10, 2) for money — avoids floating-point imprecision.
    # RULES.md § D-5: "prices must be snapshotted at time of order" — the
    # current price here can change; the snapshot lives in order_items.unit_price.
    price: Mapped[float] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        comment="Current selling price in local currency (INR assumed)",
    )

    # stock_quantity is guarded by the CHECK constraint above.
    stock_quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Units currently in stock. Auto-deactivates when it reaches 0.",
    )

    # Dietary flags — queried by the AI agent's get_menu_items tool.
    is_vegetarian: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="True if the item contains no meat or fish",
    )

    is_vegan: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="True if the item contains no animal products at all",
    )

    is_gluten_free: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="True if the item is safe for customers with gluten intolerance",
    )

    # is_active = False hides the item from the AI and customers.
    # RULES.md § A-2: AI must never recommend inactive items.
    # RULES.md § D-6: prefer soft-delete (is_active=False) over hard DELETE.
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
        comment="False = hidden from AI and customers (soft delete or out-of-stock)",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp when this item was added to the menu",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp of the last edit — auto-updated on every change",
    )

    # --------------------------------------------------------------------------
    # Relationships
    # --------------------------------------------------------------------------

    # An item can appear on many order line items (but the unit_price is
    # snapshotted on order_items, so changing price here doesn't affect history).
    order_items: Mapped[list["OrderItem"]] = relationship(  # type: ignore[name-defined]
        "OrderItem",
        back_populates="menu_item",
        lazy="select",
    )

    # --------------------------------------------------------------------------
    # Repr
    # --------------------------------------------------------------------------

    def __repr__(self) -> str:
        return (
            f"<MenuItem id={self.id} name={self.name!r} "
            f"category={self.category!r} price={self.price} "
            f"stock={self.stock_quantity} active={self.is_active}>"
        )
