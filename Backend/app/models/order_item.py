# backend/app/models/order_item.py
# ==============================================================================
# SQLAlchemy Model — `order_items` Table
# ==============================================================================
# Per ARCHITECTURE.md § 3 (Table 4) and PHASES.md § 1.4:
#
#   "Stores the individual line items (each dish) that belong to a specific
#    order. An order can have many order items."
#
# Critical design notes:
#
#   1. unit_price is a PRICE SNAPSHOT (RULES.md § D-5):
#      When the customer submits the order, the CURRENT price from menu_items
#      is copied into unit_price.  If the manager later changes the price of
#      an item, THIS record still holds the price the customer was quoted.
#      Analytics and billing must always read from unit_price — NEVER join
#      back to menu_items.price.
#
#   2. subtotal = quantity × unit_price.
#      This is a derived/computed column stored for convenience and query
#      performance (avoids recomputing in every analytics query).
#      It is set by the service layer when the order_item is created.
#
#   3. CHECK (quantity > 0) — you can't order zero of something.
#
#   4. The FK to menu_items uses ondelete="RESTRICT" (RULES.md § D-6):
#      Never hard-delete a menu item that has been ordered.
# ==============================================================================

from __future__ import annotations

from sqlalchemy import CheckConstraint, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OrderItem(Base):
    """
    A single line item within an Order.

    Each row represents: "N units of MenuItem X were part of Order Y,
    at the price that was current when the order was submitted."

    The `subtotal` column is a stored denormalisation of `quantity × unit_price`
    to simplify analytics queries (RULES.md § D-7).
    """

    __tablename__ = "order_items"

    __table_args__ = (
        # Quantity must be at least 1 — the AI's `add_item_to_cart` tool enforces
        # this at the application level, and this constraint backs it up at DB level.
        CheckConstraint("quantity > 0", name="ck_order_items_qty_positive"),
        # Subtotal must be >= 0 (could be 0 for a redeemed-reward item at ₹0).
        CheckConstraint("subtotal >= 0",  name="ck_order_items_subtotal_non_negative"),
    )

    # --------------------------------------------------------------------------
    # Columns
    # --------------------------------------------------------------------------

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Auto-incremented surrogate key for this line item",
    )

    order_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("orders.id", ondelete="CASCADE"),  # If an order is deleted, its items go too
        nullable=False,
        index=True,
        comment="The parent order (FK → orders.id)",
    )

    menu_item_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("menu_items.id", ondelete="RESTRICT"),  # Can't delete an ordered item
        nullable=False,
        index=True,
        comment="The menu item that was ordered (FK → menu_items.id)",
    )

    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="How many units of this item were ordered",
    )

    # RULES.md § D-5: snapshotted from menu_items.price at submission time.
    unit_price: Mapped[float] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        comment="Price per unit at the time of ordering — immutable snapshot",
    )

    # Stored denormalisation: quantity × unit_price.
    # Set by the service layer; never recomputed at query time.
    subtotal: Mapped[float] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        comment="quantity × unit_price — computed and stored at order creation",
    )

    # --------------------------------------------------------------------------
    # Relationships
    # --------------------------------------------------------------------------

    order: Mapped["Order"] = relationship(  # type: ignore[name-defined]
        "Order",
        back_populates="order_items",
        lazy="select",
    )

    menu_item: Mapped["MenuItem"] = relationship(  # type: ignore[name-defined]
        "MenuItem",
        back_populates="order_items",
        lazy="select",
    )

    # --------------------------------------------------------------------------
    # Repr
    # --------------------------------------------------------------------------

    def __repr__(self) -> str:
        return (
            f"<OrderItem id={self.id} order={self.order_id} "
            f"item={self.menu_item_id} qty={self.quantity} "
            f"unit_price={self.unit_price} subtotal={self.subtotal}>"
        )
