# backend/app/routes/chat.py
# ==============================================================================
# Chat Routes — Canopy Restaurant Manager
# ==============================================================================
# Endpoints:
#   POST /chat/message  — Send a message to the AI agent.
#   GET  /chat/history  — Retrieve the current user's conversation history.
#
# Dependencies applied per PHASES.md § 3.5 and RULES.md § E-2/E-3:
#   - get_current_user → 401 if not authenticated.
#   - rate_limit       → 429 with Retry-After if over 30 req/60s.
#
# The chat route does NOT persist messages to chat_sessions (the SQLite table).
# LangGraph's MemorySaver is the source of truth for conversation history
# during Phase 3.  Persisting to the DB (for the manager dashboard) is a
# Phase 5 concern when real order data needs to be surfaced.
# ==============================================================================

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.agents.agent import get_conversation_history, run_agent
from app.database import get_db
from app.middleware.auth import CurrentUser
from app.middleware.rate_limit import rate_limit
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class MessageRequest(BaseModel):
    """Request body for POST /chat/message."""

    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The customer's message to the AI assistant.",
        examples=["What's on the menu today?"],
    )


class MessageResponse(BaseModel):
    """Response body for POST /chat/message."""

    response: str = Field(description="The AI assistant's reply.")
    order_id: int | None = Field(
        default=None,
        description="The current order ID if an order is active.",
    )
    pending_approval: bool = Field(
        default=False,
        description="True if the order has been submitted and is awaiting manager approval.",
    )
    interrupted: bool = Field(
        default=False,
        description="True if the graph paused for manager review (HITL interrupt triggered).",
    )


class HistoryItem(BaseModel):
    """A single message in the conversation history."""

    role: str = Field(description="'user' or 'assistant'")
    content: str = Field(description="The message text.")


class HistoryResponse(BaseModel):
    """Response body for GET /chat/history."""

    customer_id: str
    messages: list[HistoryItem]
    message_count: int


# ---------------------------------------------------------------------------
# POST /chat/message
# ---------------------------------------------------------------------------

@router.post(
    "/message",
    response_model=MessageResponse,
    summary="Send a message to the AI ordering assistant",
    description=(
        "Sends a customer message through the LangGraph AI agent. "
        "The agent uses the customer's UUID as the thread_id, so conversation "
        "history is automatically preserved across requests. "
        "Protected by JWT authentication and rate limiting (30 msg/60s)."
    ),
    tags=["Chat"],
)
def send_message(
    body: MessageRequest,
    # get_current_user is chained inside rate_limit — both are enforced.
    current_user: Annotated[User, Depends(rate_limit)],
) -> MessageResponse:
    """
    Route a customer message through the LangGraph agent.

    Flow:
      1. rate_limit dependency verifies JWT and checks Upstash Redis counter.
      2. run_agent() is called with the customer's UUID and message text.
      3. The agent invokes tools, builds a response, and returns.
      4. If submit_order() succeeded, the graph pauses at manager_review_node
         (interrupted=True in the response).

    The frontend should:
      - Display response.response as the AI's chat bubble.
      - If pending_approval=True, show an "Order submitted — awaiting approval" UI state.
      - If interrupted=True, poll GET /orders/{order_id}/status for updates.
    """
    logger.info(
        "POST /chat/message — customer=%r message_len=%d",
        current_user.id,
        len(body.message),
    )

    result = run_agent(
        customer_id  = current_user.id,
        user_message = body.message,
    )

    return MessageResponse(
        response         = result["response"],
        order_id         = result.get("order_id"),
        pending_approval = result.get("pending_approval", False),
        interrupted      = result.get("interrupted", False),
    )


# ---------------------------------------------------------------------------
# GET /chat/order/{order_id}/status
# ---------------------------------------------------------------------------

@router.get(
    "/order/{order_id}/status",
    summary="Poll the status of an order",
    description="Allows a customer to poll the status of their order during the HITL pause.",
    tags=["Chat"],
)
def get_order_status(
    order_id: int,
    current_user: CurrentUser,
    db: Session = Depends(get_db),
):
    from app.models.order import Order
    order = db.query(Order).filter(Order.id == order_id, Order.customer_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    print(f"\n📦 [ORDER STATUS CHECK] Order #{order_id} Current Status: {order.status}")
    return {"status": order.status}


# ---------------------------------------------------------------------------
# GET /chat/history
# ---------------------------------------------------------------------------

@router.get(
    "/history",
    response_model=HistoryResponse,
    summary="Retrieve the current user's conversation history",
    description=(
        "Returns all user and assistant messages from the current session. "
        "System prompts, tool call messages, and internal system alerts are filtered out. "
        "Protected by JWT authentication (no rate limit on reads)."
    ),
    tags=["Chat"],
)
def get_history(current_user: CurrentUser) -> HistoryResponse:
    """
    Return the customer's conversation history from LangGraph's MemorySaver.

    This is useful for:
      - Restoring the chat UI when a customer refreshes the page.
      - The manager dashboard to read context behind an order decision.
    """
    logger.info(
        "GET /chat/history — customer=%r",
        current_user.id,
    )

    messages = get_conversation_history(current_user.id)

    return HistoryResponse(
        customer_id   = current_user.id,
        messages      = [HistoryItem(**m) for m in messages],
        message_count = len(messages),
    )
