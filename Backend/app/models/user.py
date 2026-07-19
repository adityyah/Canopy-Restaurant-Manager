# backend/app/models/user.py
# ==============================================================================
# SQLAlchemy Model — `users` Table
# ==============================================================================
# Per ARCHITECTURE.md § 3 (Table 1) and PHASES.md § 1.4:
#
#   "Stores a reference to every person who has an account, mirroring the user
#    data managed by Supabase."
#
# Key design decisions:
#   - `id` is a UUID string (not auto-incremented integer) because Supabase
#     manages user creation and issues UUIDs for each user.  We mirror that UUID
#     here as the primary key to join on.  (ARCHITECTURE.md: "A unique ID for
#     the user, provided by Supabase".)
#   - `role` is constrained to exactly two values: "customer" or "manager".
#     This is enforced at the application layer (Pydantic) in Phase 2;  a
#     CheckConstraint is added here as a database-level safety net.
#   - `created_at` defaults to the current UTC time on INSERT.
# ==============================================================================

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    """
    Mirrors a Supabase user in the local SQLite database.

    Every customer and manager has exactly one row here.
    The UUID in this table must match the UUID issued by Supabase so that
    JWT-verified user IDs can be looked up against local records.
    """

    __tablename__ = "users"

    __table_args__ = (
        # Database-level guard: only "customer" or "manager" are valid roles.
        # Per RULES.md § D-3: role checks must be server-side (and DB-level).
        CheckConstraint("role IN ('customer', 'manager')", name="ck_users_role"),
    )

    # --------------------------------------------------------------------------
    # Columns
    # --------------------------------------------------------------------------

    # UUID string provided by Supabase — e.g. "550e8400-e29b-41d4-a716-446655440000"
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        comment="Supabase UUID — must match the UUID in the Supabase auth.users table",
    )

    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
        comment="User's email address — unique across the system",
    )

    role: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="customer",
        comment="Access role: 'customer' or 'manager'",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp when the user account was first created",
    )

    # --------------------------------------------------------------------------
    # Relationships (defined here so SQLAlchemy can build the object graph)
    # --------------------------------------------------------------------------

    # Orders placed by this user (as a customer)
    orders: Mapped[list["Order"]] = relationship(  # type: ignore[name-defined]
        "Order",
        back_populates="customer",
        foreign_keys="Order.customer_id",
        cascade="all, delete-orphan",
        lazy="select",
    )

    # Orders resolved by this user (as a manager)
    managed_orders: Mapped[list["Order"]] = relationship(  # type: ignore[name-defined]
        "Order",
        back_populates="manager",
        foreign_keys="Order.manager_id",
        lazy="select",
    )

    # Reward point transactions for this user
    reward_points: Mapped[list["RewardPoint"]] = relationship(  # type: ignore[name-defined]
        "RewardPoint",
        back_populates="customer",
        cascade="all, delete-orphan",
        lazy="select",
    )

    # Chat sessions for this user
    chat_sessions: Mapped[list["ChatSession"]] = relationship(  # type: ignore[name-defined]
        "ChatSession",
        back_populates="customer",
        cascade="all, delete-orphan",
        lazy="select",
    )

    # --------------------------------------------------------------------------
    # Repr
    # --------------------------------------------------------------------------

    def __repr__(self) -> str:
        return f"<User id={self.id!r} email={self.email!r} role={self.role!r}>"
