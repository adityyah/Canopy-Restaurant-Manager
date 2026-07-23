# backend/app/agents/agent.py
# ==============================================================================
# LangGraph Agent — Canopy Restaurant Manager
# ==============================================================================
# Rebuilds the original graph.py architecture for the modular FastAPI structure.
#
# ARCHITECTURE (directly adapted from graph.py):
#
#   START → agent_node ─── (has tool_calls?) ──→ tool_node
#                │                                    │
#                │         (mutation succeeded?)      │
#                │         ┌──────────────────────────┘
#                │         ↓
#                │   manager_review_node   ← interrupt() pauses execution here
#                │         │
#                └─────────┘ (always loops back to agent_node after review)
#              (no tool calls)
#                ↓
#              END
#
# Key decisions preserved from original graph.py:
#   - MemorySaver checkpointing — conversation state persists per thread_id.
#   - interrupt() in manager_review_node — true HITL via LangGraph.
#   - route_after_tool() inspects the ToolMessage to decide if manager review
#     is needed (only for submit_order, not all tool calls).
#   - SystemMessage is injected dynamically per call (not baked into history).
#
# New in Phase 3:
#   - Tools use SessionLocal from database.py (not a global singleton db).
#   - customer_id is threaded through all cart tools (no more customer_thread_id).
#   - All 9 tools are bound (7 original + 2 new reward tools).
#   - `run_agent()` is the single callable used by routes/chat.py.
# ==============================================================================

from __future__ import annotations

import json
import logging
import os
from typing import Annotated, Any, Literal, Optional

from dotenv import load_dotenv
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.types import interrupt
from typing_extensions import TypedDict

from app.agents.system_prompt import SYSTEM_PROMPT
from app.agents.tools import (
    add_item_to_cart as _add_item_to_cart,
    clear_cart as _clear_cart,
    get_cart_summary as _get_cart_summary,
    get_item_by_name as _get_item_by_name,
    get_menu_items as _get_menu_items,
    get_reward_balance as _get_reward_balance,
    redeem_reward as _redeem_reward,
    remove_item_from_cart as _remove_item_from_cart,
    submit_order as _submit_order,
)
from app.database import SessionLocal

load_dotenv(override=True)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# LangGraph State
# ---------------------------------------------------------------------------
# Adapted directly from graph.py — same structure, same field semantics.

class State(TypedDict):
    # Append-only — add_messages deduplicates by message ID on re-runs.
    # This is the full conversation history including system messages.
    messages: Annotated[list[BaseMessage], add_messages]
    # UUID of the authenticated customer making this request.
    # Injected at call time; tools use this to scope DB queries.
    customer_id: str
    # DB primary key of the order currently in scope.
    # Set by route_after_tool when a submit_order succeeds.
    current_order_id: Optional[int]
    # True after submit_order succeeds — triggers manager review routing.
    pending_approval: bool


# ---------------------------------------------------------------------------
# @tool Wrappers — LangGraph requires @tool decorators
# ---------------------------------------------------------------------------
# Each wrapper:
#   1. Creates a fresh SessionLocal() per call (thread-safe, no shared state).
#   2. Delegates to the pure tool function in tools.py.
#   3. Closes the session in a finally block.
#
# Note: customer_id is NOT a parameter of most @tool functions because the LLM
# cannot know it — it's injected via the State in agent_node using a closure.
# We use a module-level variable (_current_customer_id) that is set at the
# start of each run_agent() call and reset after. This is safe because
# LangGraph executes the graph synchronously (no concurrent tool calls within
# a single thread).

_current_customer_id: str = ""  # Set by run_agent() before graph.invoke()


@tool
def get_menu_items(
    category: str = "",
    vegetarian_only: bool = False,
    vegan_only: bool = False,
    gluten_free_only: bool = False,
) -> str:
    """
    Retrieve all active, in-stock menu items. Use optional filters to narrow results.

    Args:
        category:         Filter by category (e.g., 'Starters', 'Mains', 'Desserts', 'Beverages').
        vegetarian_only:  If true, return only vegetarian items.
        vegan_only:       If true, return only vegan items.
        gluten_free_only: If true, return only gluten-free items.
    """
    with SessionLocal() as db:
        items = _get_menu_items(
            db,
            category=category or None,
            vegetarian_only=vegetarian_only,
            vegan_only=vegan_only,
            gluten_free_only=gluten_free_only,
        )
        return json.dumps(items)


@tool
def get_item_by_name(item_name: str) -> dict:
    """
    Look up a single menu item by its exact name (case-insensitive).
    MUST be called before adding any item to the cart to verify it exists and is in stock.

    Args:
        item_name: The name of the item (e.g., 'Butter Chicken').

    Returns:
        {"found": true, ...details...} or {"found": false, "reason": "..."}
    """
    with SessionLocal() as db:
        return _get_item_by_name(db, item_name)


@tool
def add_item_to_cart(item_name: str, quantity: int) -> dict:
    """
    Add a menu item to the customer's cart. Call get_item_by_name() first to verify it exists.

    Args:
        item_name: The exact item name as returned by get_item_by_name().
        quantity:  Number of units to add (must be >= 1).

    Returns:
        {"success": true/false, "cart_item_id": int or null, "error": str or null}
    """
    with SessionLocal() as db:
        return _add_item_to_cart(db, _current_customer_id, item_name, quantity)


@tool
def remove_item_from_cart(item_name: str, quantity: int = 0) -> dict:
    """
    Remove or reduce an item in the cart. If quantity is 0 or omitted, removes the item entirely.

    Args:
        item_name: The item to remove.
        quantity:  Units to remove. 0 means remove all.

    Returns:
        {"success": true/false, "removed_quantity": int, "error": str or null}
    """
    with SessionLocal() as db:
        return _remove_item_from_cart(
            db,
            _current_customer_id,
            item_name,
            quantity if quantity > 0 else None,
        )


@tool
def get_cart_summary() -> dict:
    """
    Return the customer's current cart contents and grand total.
    MUST be called before submit_order() to show the customer a full summary.

    Returns:
        {"order_id": int or null, "items": [...], "grand_total": float, "item_count": int}
    """
    with SessionLocal() as db:
        return _get_cart_summary(db, _current_customer_id)


@tool
def clear_cart() -> dict:
    """
    Remove all items from the customer's cart and start fresh.

    Returns:
        {"success": true/false, "removed_count": int, "error": str or null}
    """
    with SessionLocal() as db:
        return _clear_cart(db, _current_customer_id)


@tool
def submit_order() -> dict:
    """
    Finalise the cart and send the order for manager approval (PENDING_APPROVAL status).
    ONLY call this after showing the cart summary AND receiving explicit customer confirmation.

    Returns:
        {"success": true/false, "order_id": int or null, "total_amount": float or null, "error": str or null}
    """
    with SessionLocal() as db:
        return _submit_order(db, _current_customer_id)


@tool
def get_reward_balance() -> dict:
    """
    Get the customer's current loyalty point balance and list of available rewards.

    Returns:
        {"balance": int, "transaction_count": int, "available_rewards": [{"name", "point_cost"}, ...]}
    """
    with SessionLocal() as db:
        return _get_reward_balance(db, _current_customer_id)


@tool
def redeem_reward(reward_item_name: str) -> dict:
    """
    Redeem loyalty points for a free menu item. Adds the item to the cart at ₹0.
    Call get_reward_balance() first to confirm the customer has enough points.

    Args:
        reward_item_name: The name of the reward item (must be in the available_rewards list).

    Returns:
        {"success": true/false, "points_spent": int, "remaining_balance": int,
         "item_added": str or null, "error": str or null}
    """
    with SessionLocal() as db:
        return _redeem_reward(db, _current_customer_id, reward_item_name)


# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------

ALL_TOOLS = [
    get_menu_items,
    get_item_by_name,
    add_item_to_cart,
    remove_item_from_cart,
    get_cart_summary,
    clear_cart,
    submit_order,
    get_reward_balance,
    redeem_reward,
]

# Tools whose success triggers the manager review node.
# Only submit_order creates a PENDING_APPROVAL event (not modify in Phase 3).
_APPROVAL_TRIGGER_TOOLS = {"submit_order"}

# ---------------------------------------------------------------------------
# LLM setup
# ---------------------------------------------------------------------------

llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0,          # Deterministic — no creative guessing (Rule A-1)
    max_retries=3,
    request_timeout=30,
)

llm_with_tools = llm.bind_tools(ALL_TOOLS)


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

def agent_node(state: State) -> dict[str, Any]:
    """
    The main LLM call node.

    Injects the system prompt dynamically as the first message so it is
    always fresh (the system prompt may be updated between sessions, and
    we don't want a stale version persisted in MemorySaver).

    Bug fix (greeting loop): We now inject a factual TURN_CONTEXT note into
    the system prompt that tells the LLM whether this is the first turn or an
    ongoing conversation. The LLM cannot reliably infer this itself when the
    system message is freshly prepended every call — so we compute it here
    in Python (where we have access to the full state) and pass it in.

    Adapted from graph.py's agent_node.
    """
    # Determine whether any prior AIMessage exists in the conversation.
    # MemorySaver persists messages across calls so prior_ai_turns > 0 means
    # this is NOT the first message in this session.
    prior_ai_turns = sum(1 for m in state["messages"] if isinstance(m, AIMessage) and m.content)

    if prior_ai_turns == 0:
        turn_context = (
            "\n\n[TURN CONTEXT]: This IS the customer's first message. "
            "You should call get_menu_items() to fetch the daily delight and include a warm greeting."
        )
    else:
        turn_context = (
            f"\n\n[TURN CONTEXT]: This is an ONGOING conversation (prior assistant turns: {prior_ai_turns}). "
            "DO NOT output a greeting. Answer the customer's latest message directly. "
            "Only call tools if they are needed to answer the question."
        )

    sys_msg = SystemMessage(content=SYSTEM_PROMPT + turn_context)
    messages_with_system = [sys_msg] + state["messages"]

    logger.debug(
        "agent_node: invoking LLM with %d messages for customer %s (first_turn=%s)",
        len(messages_with_system),
        state.get("customer_id", "?"),
        prior_ai_turns == 0,
    )

    response: AIMessage = llm_with_tools.invoke(messages_with_system)
    return {"messages": [response]}


# Standard LangGraph ToolNode — handles calling the @tool functions.
tool_node = ToolNode(ALL_TOOLS)


def manager_review_node(state: State) -> dict[str, Any]:
    """
    Human-in-the-Loop pause node.

    Uses LangGraph's interrupt() to pause graph execution and surface the
    order to the manager dashboard (Phase 5).  The graph resumes when the
    manager's decision is passed back via graph.invoke() with the resume value.

    Preserved exactly from the original graph.py, adapted for the new order ID
    field name (order.id instead of order.order_id).
    """
    order_id = state.get("current_order_id")

    # Safety net: scan ToolMessages for the order_id if state is missing it.
    if order_id is None:
        for msg in reversed(state["messages"]):
            if isinstance(msg, ToolMessage) and msg.name in _APPROVAL_TRIGGER_TOOLS:
                try:
                    order_id = json.loads(msg.content).get("order_id")
                    break
                except (json.JSONDecodeError, AttributeError):
                    pass

    if order_id is None:
        raise ValueError(
            "Critical Error: Could not find order_id in state or ToolMessages. "
            "This indicates submit_order returned success without an order_id."
        )

    logger.info(
        "manager_review_node: interrupting for Order #%d (customer %s)",
        order_id,
        state.get("customer_id", "?"),
    )

    # This line pauses the graph.  Execution resumes when Phase 5's
    # manager route calls graph.invoke() with the decision.
    manager_input: dict = interrupt(
        {
            "prompt": (
                f"Order #{order_id} is awaiting your approval. "
                'Reply with {"decision": "APPROVED" or "REJECTED", "manager_note": "optional reason"}.'
            ),
            "order_id": order_id,
            "customer_id": state.get("customer_id"),
        }
    )

    decision: str = manager_input.get("decision", "REJECTED").strip().upper()
    note: str      = manager_input.get("manager_note", "") or ""

    # Apply the manager's decision using the submit_order tool's companion logic.
    # We call submit_order's update helper via the DB directly to avoid a circular call.
    from app.agents.tools import _get_or_create_draft_order  # noqa: F401
    from app.models.order import Order as OrderModel, OrderStatus
    from datetime import datetime, timezone

    with SessionLocal() as db:
        order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
        if order:
            order.status      = decision
            order.manager_id  = None     # Will be set properly by Phase 5 service
            order.resolved_at = datetime.now(timezone.utc)
            if decision == "REJECTED":
                order.rejection_reason = note or None
            db.commit()

    # Build a system alert instructing the LLM what to tell the customer.
    if decision == "APPROVED":
        instruction = (
            f"Tell the customer their order #{order_id} has been APPROVED "
            f"and is now being prepared. Congratulate them warmly!"
        )
    else:
        instruction = (
            f"Tell the customer their order #{order_id} has been REJECTED. "
            f"Apologise sincerely. "
            + (f"The manager's note: '{note}'." if note else "")
        )

    # Use HumanMessage (not ToolMessage) to avoid orphaned ToolMessage errors.
    # This is the same pattern from the original graph.py.
    alert = HumanMessage(
        content=(
            f"[SYSTEM ALERT — DO NOT SHOW THIS TO CUSTOMER]: "
            f"Manager has reviewed Order #{order_id}. "
            f"Decision: {decision}. Manager note: '{note}'. "
            f"INSTRUCTION: {instruction}"
        )
    )

    return {
        "messages":          [alert],
        "pending_approval":  False,
        "current_order_id":  order_id,
    }


# ---------------------------------------------------------------------------
# Routing edges
# ---------------------------------------------------------------------------

def route_after_agent(state: State) -> Literal["tool_node", "__end__"]:
    """
    After agent_node: if the LLM made tool calls, run them; otherwise end.
    Preserved from original graph.py.
    """
    last: BaseMessage = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tool_node"
    return END


def route_after_tool(
    state: State,
) -> Literal["manager_review_node", "agent_node"]:
    """
    After tool_node: route to manager review if submit_order succeeded,
    otherwise loop back to agent_node for the LLM to process tool results.

    Adapted from original graph.py — same logic, updated tool name set.
    """
    for msg in reversed(state["messages"]):
        if not isinstance(msg, ToolMessage):
            break  # Hit the AIMessage boundary — stop scanning this turn.

        if msg.name not in _APPROVAL_TRIGGER_TOOLS:
            continue  # Read-only or non-triggering tool — skip.

        try:
            payload = json.loads(msg.content)
        except (json.JSONDecodeError, AttributeError):
            continue

        # Only route to manager if the mutation actually succeeded with an order_id.
        if payload.get("success") is True and payload.get("order_id") is not None:
            # Mutate state in-place (same pattern as original graph.py).
            state["current_order_id"] = payload["order_id"]
            state["pending_approval"] = True
            logger.info(
                "route_after_tool: submit_order succeeded → manager_review_node "
                "(Order #%d)",
                payload["order_id"],
            )
            return "manager_review_node"

    return "agent_node"


# ---------------------------------------------------------------------------
# Graph compilation — singleton built at module import time
# ---------------------------------------------------------------------------

def _build_graph():
    """
    Compile the LangGraph StateGraph with MemorySaver checkpointing.

    Identical structure to the original graph.py build_graph() function.
    MemorySaver stores conversation state in memory — for production use a
    persistent store (e.g., SqliteSaver or a Redis-backed saver) in Phase 6+.
    """
    builder = StateGraph(State)

    builder.add_node("agent_node",          agent_node)
    builder.add_node("tool_node",           tool_node)
    builder.add_node("manager_review_node", manager_review_node)

    builder.add_edge(START, "agent_node")

    builder.add_conditional_edges(
        "agent_node",
        route_after_agent,
        {"tool_node": "tool_node", END: END},
    )

    builder.add_conditional_edges(
        "tool_node",
        route_after_tool,
        {
            "manager_review_node": "manager_review_node",
            "agent_node":          "agent_node",
        },
    )

    # After manager review, the agent always runs again to inform the customer.
    builder.add_edge("manager_review_node", "agent_node")

    checkpointer = MemorySaver()
    return builder.compile(checkpointer=checkpointer, interrupt_before=[])


# Compile once at import time so the graph is ready to serve requests.
graph = _build_graph()


# ---------------------------------------------------------------------------
# run_agent() — the single entry point called by routes/chat.py
# ---------------------------------------------------------------------------

def run_agent(customer_id: str, user_message: str) -> dict[str, Any]:
    """
    Send a user message through the LangGraph agent and return the AI's response.

    This is the only function that routes/chat.py needs to import.

    Args:
        customer_id:  The authenticated customer's Supabase UUID.
                      Used as the LangGraph thread_id (one conversation per user)
                      AND injected into the State for cart tool calls.
        user_message: The raw text the customer typed.

    Returns:
        {
            "response":         str,   — The AI's final reply text.
            "order_id":         int | None,
            "pending_approval": bool,
            "interrupted":      bool,  — True if the graph paused for manager review.
        }
    """
    global _current_customer_id
    _current_customer_id = customer_id  # Thread-scope injection for @tool wrappers

    config = {
        "configurable": {
            # One conversation thread per customer — MemorySaver persists history.
            "thread_id": customer_id,
        },
        "recursion_limit": 10,
    }

    initial_state = {
        "messages":          [HumanMessage(content=user_message)],
        "customer_id":       customer_id,
        "current_order_id":  None,
        "pending_approval":  False,
    }

    try:
        result = graph.invoke(initial_state, config=config)
    except Exception as exc:
        logger.exception(
            "LangGraph agent error for customer %s: %s", customer_id, exc
        )
        return {
            "response":         "I'm sorry, I encountered an error. Please try again.",
            "order_id":         None,
            "pending_approval": False,
            "interrupted":      False,
        }
    finally:
        _current_customer_id = ""  # Always clear after the call

    messages: list[BaseMessage] = result.get("messages", [])

    # Find the last AIMessage — that's the response to show the customer.
    ai_response = "I'm sorry, I didn't produce a response. Please try again."
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and msg.content:
            ai_response = msg.content
            break

    interrupted = result.get("__interrupt__") is not None

    return {
        "response":         ai_response,
        "order_id":         result.get("current_order_id"),
        "pending_approval": result.get("pending_approval", False),
        "interrupted":      interrupted,
    }


def get_conversation_history(customer_id: str) -> list[dict[str, Any]]:
    """
    Retrieve the full conversation history for a customer from MemorySaver.

    Args:
        customer_id: The customer's UUID (used as thread_id).

    Returns:
        List of {"role": str, "content": str} dicts suitable for the frontend.
        Excludes SystemMessages and internal SYSTEM ALERT messages.
    """
    config = {"configurable": {"thread_id": customer_id}}

    try:
        state = graph.get_state(config)
        messages: list[BaseMessage] = state.values.get("messages", [])
    except Exception as exc:
        logger.error("Could not retrieve history for customer %s: %s", customer_id, exc)
        return []

    history = []
    for msg in messages:
        if isinstance(msg, SystemMessage):
            continue  # Never expose system prompts to the frontend
        if isinstance(msg, HumanMessage) and "[SYSTEM ALERT" in msg.content:
            continue  # Never expose internal system alerts to the frontend
        if isinstance(msg, ToolMessage):
            continue  # Raw tool results are internal

        if isinstance(msg, HumanMessage):
            history.append({"role": "user", "content": msg.content})
        elif isinstance(msg, AIMessage) and msg.content:
            history.append({"role": "assistant", "content": msg.content})

    return history
