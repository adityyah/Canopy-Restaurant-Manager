# backend/app/models/order.py
# ==============================================================================
# SQLAlchemy Model — `orders` Table
# ==============================================================================
# Per ARCHITECTURE.md § 3 (Table 3) and PHASES.md § 1.4:
#
#   "Stores every order placed by a customer, from the moment the cart is
#    created to the final manager decision."
#
# Order Status Lifecycle (RULES.md § D-2 — THE CORE HITL GUARANTEE):
#
#   DRAFT  →  PENDING_APPROVAL  →  APPROVED
#                              ↘  REJECTED
#   DRAFT or PENDING_APPROVAL  →  CANCELLED  (customer cancels)
#
# Invalid transitions (must be rejected with 409 Conflict):
#   - DRAFT → APPROVED    (must pass through PENDING_APPROVAL)
#   - DRAFT → REJECTED    (must pass through PENDING_APPROVAL)
#   - APPROVED → any      (except modifications which reset to PENDING_APPROVAL)
#   - REJECTED → any      (final state)
#   - CANCELLED → any     (final state)
#
# The status lifecycle is enforced in the service layer (Phase 5 / 6), but the
# OrderStatus enum is defined here and imported by all other layers.
# ==============================================================================

from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ---------------------------------------------------------------------------
# Order Status Enum
# ---------------------------------------------------------------------------
# Using a proper Python Enum (str subclass) so that:
#   1. Pydantic schemas can use it directly as a type.
#   2. SQLAlchemy stores the string value in the DB (not the int ordinal).
#   3. Route handlers and the AI agent can compare with e.g.
#      `order.status == OrderStatus.PENDING_APPROVAL`
#
# Adapted from the original schemas.py — DELIVERED is removed because the
# docs define the final states as APPROVED / REJECTED / CANCELLED (PRD § 3.1.F-C5).

class OrderStatus(str, enum.Enum):
    DRAFT            = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED         = "APPROVED"
    REJECTED         = "REJECTED"
    CANCELLED        = "CANCELLED"


# Ordered list used to validate forward-only state transitions in services.
# (RULES.md § D-2)
VALID_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.DRAFT:            {OrderStatus.PENDING_APPROVAL, OrderStatus.CANCELLED},
    OrderStatus.PENDING_APPROVAL: {OrderStatus.APPROVED, OrderStatus.REJECTED, OrderStatus.CANCELLED},
    OrderStatus.APPROVED:         set(),   # Terminal — modifications handled separately (Rule A-7)
    OrderStatus.REJECTED:         set(),   # Terminal
    OrderStatus.CANCELLED:        set(),   # Terminal
}


class Order(Base):
    """
    Represents a customer's order from cart creation through manager decision.

    An order starts as DRAFT while the customer is building it via the AI chat.
    It transitions to PENDING_APPROVAL when the customer confirms, then to
    APPROVED or REJECTED when the manager acts.  The customer may cancel at
    any point before the manager acts.

    Per RULES.md § D-2: every order MUST pass through PENDING_APPROVAL before
    reaching APPROVED or REJECTED — this is the HITL guarantee.
    """

    __tablename__ = "orders"

    # --------------------------------------------------------------------------
    # Columns
    # --------------------------------------------------------------------------

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Auto-incremented order ID",
    )

    # FK to users.id (Supabase UUID string)
    customer_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),  # Don't cascade-delete orders
        nullable=False,
        index=True,
        comment="The customer who placed this order (FK → users.id)",
    )

    # Stored as a string matching OrderStatus enum values.
    status: Mapped[str] = mapped_column(
        SAEnum(OrderStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=OrderStatus.DRAFT.value,
        index=True,
        comment="Current lifecycle state of the order (see OrderStatus enum)",
    )

    # Calculated at the time of submission and snapshotted.
    # Per RULES.md § D-5: never recalculate from current menu prices.
    total_amount: Mapped[float | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,  # Null while order is in DRAFT (not yet submitted)
        comment="Grand total snapshotted at PENDING_APPROVAL time",
    )

    # The manager's optional explanation for a rejection.
    # Per PRD § 3.2 F-M3: "optional but encouraged"
    rejection_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Manager's optional reason for rejecting the order",
    )

    # FK to users.id — which manager approved or rejected this order.
    # Nullable because it is set only after a manager acts.
    manager_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="The manager who acted on this order (FK → users.id)",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp when the DRAFT order was first created",
    )

    # Set when the customer clicks "Confirm Order" (DRAFT → PENDING_APPROVAL).
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="UTC timestamp when the customer submitted the order",
    )

    # Set when the manager approves or rejects (or customer cancels).
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="UTC timestamp when the order reached its final state",
    )

    # --------------------------------------------------------------------------
    # Relationships
    # --------------------------------------------------------------------------

    customer: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User",
        back_populates="orders",
        foreign_keys=[customer_id],
        lazy="select",
    )

    manager: Mapped["User | None"] = relationship(  # type: ignore[name-defined]
        "User",
        back_populates="managed_orders",
        foreign_keys=[manager_id],
        lazy="select",
    )

    order_items: Mapped[list["OrderItem"]] = relationship(  # type: ignore[name-defined]
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="select",
    )

    reward_points: Mapped[list["RewardPoint"]] = relationship(  # type: ignore[name-defined]
        "RewardPoint",
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="select",
    )

    chat_sessions: Mapped[list["ChatSession"]] = relationship(  # type: ignore[name-defined]
        "ChatSession",
        back_populates="order",
        lazy="select",
    )

    # --------------------------------------------------------------------------
    # Repr
    # --------------------------------------------------------------------------

    def __repr__(self) -> str:
        return (
            f"<Order id={self.id} customer={self.customer_id!r} "
            f"status={self.status!r} total={self.total_amount}>"
        )
