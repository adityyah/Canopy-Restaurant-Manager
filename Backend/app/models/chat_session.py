# backend/app/models/chat_session.py
# ==============================================================================
# SQLAlchemy Model — `chat_sessions` Table
# ==============================================================================
# Per ARCHITECTURE.md § 3 (Table 6) and PHASES.md § 1.4:
#
#   "Stores the full conversation history between the customer and the AI agent
#    for each ordering session."
#
# Design notes:
#
#   1. `messages` is a JSON column — it stores the entire message list in the
#      format expected by the OpenAI Chat Completions API:
#          [
#              {"role": "system",    "content": "..."},
#              {"role": "user",      "content": "Hi, what's on the menu?"},
#              {"role": "assistant", "content": "Here are today's starters..."},
#              ...
#          ]
#      The AI agent loop reads this history at the start of each request and
#      appends each new turn before saving it back.  (PHASES.md § 3.4)
#
#   2. `order_id` is nullable because a chat session is created before an order
#      exists (the customer might browse the menu before deciding to order).
#      Once the customer's DRAFT order is created, order_id is populated.
#
#   3. `updated_at` auto-refreshes on every message — this is how the system
#      knows when the last message was sent in a session.
# ==============================================================================

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database import Base


class ChatSession(Base):
    """
    Stores the full conversation history for one ordering session.

    One customer can have many chat sessions (one per ordering session).
    Each session is linked to one Order once the customer starts adding items.

    The `messages` JSON column holds the complete OpenAI message list so the
    AI agent can maintain conversational context across multiple HTTP requests.
    """

    __tablename__ = "chat_sessions"

    # --------------------------------------------------------------------------
    # Columns
    # --------------------------------------------------------------------------

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Auto-incremented surrogate key for this chat session",
    )

    customer_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="The customer in this conversation (FK → users.id)",
    )

    # Nullable: populated once the customer starts building an order.
    order_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="The order being built in this session (FK → orders.id)",
    )

    # Stores the full OpenAI-format message list as a JSON array.
    # Initialised to an empty list; each message turn is appended in the
    # AI agent service (agents/agent.py, Phase 3).
    messages: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        comment=(
            "Full conversation history as a JSON array of OpenAI message objects "
            "[{role, content}, ...]"
        ),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp when this chat session was started",
    )

    # Auto-updated on every save (every AI response appended).
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        comment="UTC timestamp of the last message sent in this session",
    )

    # --------------------------------------------------------------------------
    # Relationships
    # --------------------------------------------------------------------------

    customer: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User",
        back_populates="chat_sessions",
        lazy="select",
    )

    order: Mapped["Order | None"] = relationship(  # type: ignore[name-defined]
        "Order",
        back_populates="chat_sessions",
        lazy="select",
    )

    # --------------------------------------------------------------------------
    # Repr
    # --------------------------------------------------------------------------

    def __repr__(self) -> str:
        msg_count = len(self.messages) if self.messages else 0
        return (
            f"<ChatSession id={self.id} customer={self.customer_id!r} "
            f"order={self.order_id} messages={msg_count}>"
        )
