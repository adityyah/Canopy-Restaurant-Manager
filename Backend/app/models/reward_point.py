# backend/app/models/reward_point.py
# ==============================================================================
# SQLAlchemy Model — `reward_points` Table
# ==============================================================================
# Per ARCHITECTURE.md § 3 (Table 5) and PHASES.md § 1.4:
#
#   "Tracks the loyalty point balance and transaction history for each customer."
#
# Critical design decisions:
#
#   1. LEDGER MODEL — there is NO single "balance" column.
#      The current balance is always calculated as:
#          SELECT SUM(points_change) FROM reward_points WHERE customer_id = ?
#      This approach (ARCHITECTURE.md § 3, Table 5 note) keeps records
#      auditable and tamper-evident.  RULES.md § D-4: "The balance is always
#      calculated from the full history."
#
#   2. points_change can be positive (earned) or negative (redeemed).
#      - Positive: awarded after a manager approves an order (Rule D-4).
#      - Negative: deducted when the AI's `redeem_reward` tool is called.
#      - Negative correcting entry: inserted when a modification reverses
#        a previous earn (Rule A-7).
#
#   3. RULES.md § D-4: points are ONLY awarded after status → APPROVED,
#      inside the same DB transaction as the status update.
#      This model does not enforce that rule — it is enforced in the
#      manager_orders service (Phase 5).
#
#   4. order_id is nullable because a redemption might theoretically be
#      recorded without an order context (e.g. a manual adjustment), though in
#      practice every transaction in this system is tied to an order.
# ==============================================================================

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RewardPoint(Base):
    """
    A single ledger entry in the reward points system.

    Every earn or redeem event creates one row here.  The customer's live
    balance is always SUM(points_change) for their customer_id.

    Point calculation (PRD § F-C8, ARCHITECTURE.md § 4 Step 7):
        Points awarded = dynamically calculated value between 10 and 50,
        based on the order's total_amount and number of items ordered.
        Larger orders earn more points.  Never < 10, never > 50.
    """

    __tablename__ = "reward_points"

    # --------------------------------------------------------------------------
    # Columns
    # --------------------------------------------------------------------------

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Auto-incremented surrogate key for this transaction",
    )

    customer_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="The customer this transaction belongs to (FK → users.id)",
    )

    # Nullable because a manual adjustment entry might not reference a specific order.
    order_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="The order that triggered this transaction (FK → orders.id)",
    )

    # Positive = points earned.  Negative = points redeemed or reversed.
    # Constraint: can never be exactly 0 (a zero-change transaction is meaningless).
    points_change: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment=(
            "Points delta for this transaction: "
            "+N = earned (order approved), "
            "-N = redeemed (reward applied) or reversed (order modified)"
        ),
    )

    # Human-readable audit trail — required by RULES.md § D-4 for traceability.
    # Examples:
    #   "Earned for Order #42 (₹620 total, 3 items)"
    #   "Redeemed for free Lemonade — Order #42"
    #   "Points reversed — Order #42 modified by customer"
    reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Human-readable description of why this transaction was recorded",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp when this transaction was recorded",
    )

    # --------------------------------------------------------------------------
    # Relationships
    # --------------------------------------------------------------------------

    customer: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User",
        back_populates="reward_points",
        lazy="select",
    )

    order: Mapped["Order | None"] = relationship(  # type: ignore[name-defined]
        "Order",
        back_populates="reward_points",
        lazy="select",
    )

    # --------------------------------------------------------------------------
    # Repr
    # --------------------------------------------------------------------------

    def __repr__(self) -> str:
        sign = "+" if self.points_change >= 0 else ""
        return (
            f"<RewardPoint id={self.id} customer={self.customer_id!r} "
            f"order={self.order_id} change={sign}{self.points_change} "
            f"reason={self.reason!r}>"
        )
