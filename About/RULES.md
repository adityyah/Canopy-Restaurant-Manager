# RULES.md — Development Rules & Guardrails
### *AI-Powered Restaurant Ordering System — Capstone Project*

**File Location:** `About/RULES.md`

**Last Updated:** July 2026

**Status:** v1.0

---

> These are the non-negotiable rules that govern how this application is built and how it behaves. Think of this document as the "law book" for the project. Every developer (or AI assistant) working on this codebase must follow these rules to keep the system safe, predictable, and trustworthy.

---

## Table of Contents

1. [AI Agent Guardrails](#1-ai-agent-guardrails)
2. [Error Handling Boundaries](#2-error-handling-boundaries)
3. [Data Integrity Rules](#3-data-integrity-rules)

---

## 1. AI Agent Guardrails

These rules apply to GPT-4o-mini and the way it is configured and used in this project. The goal is to make the AI safe, honest, and predictable — not clever or surprising.

---

### Rule A-1 — The AI Must Only Use Approved Tools

**✅ Must Do:**
The AI agent is given a fixed list of tools it is allowed to call. Every piece of information it uses — menu items, prices, cart contents, reward balances — must come from one of these tools, which in turn fetch real data from the database.

**❌ Must NOT Do:**
The AI must never answer a question about the menu, prices, stock, or reward points from "memory" or general knowledge. It must always call a tool first.

> **Example of what is forbidden:**
> Customer: *"How much is the pasta?"*
> ❌ Bad AI response: *"The pasta is usually around ₹250."* ← This is a guess. Never allowed.
> ✅ Good AI response: Calls `get_item_by_name("pasta")` → gets real price from database → responds with the actual price.

---

### Rule A-2 — The AI Must Never Hallucinate Menu Items

**✅ Must Do:**
Before confirming that any item can be added to an order, the AI must call `get_item_by_name()` or `get_menu_items()` to verify the item exists **and** is currently active (i.e., `is_active = true` and `stock_quantity > 0`).

**❌ Must NOT Do:**
The AI must never add an item to the cart that it has not first confirmed exists in the live database. It must never invent a dish, a category, a price, a dietary label, or a description.

> **What happens when an item doesn't exist:**
> Customer: *"Can I get a Truffle Risotto?"*
> ✅ Correct response: The tool returns no result → AI says *"Sorry, I don't see Truffle Risotto on our current menu. Here's what we do have in Mains: [list from tool]."*

---

### Rule A-3 — The AI Must Check Stock Before Confirming Availability

**✅ Must Do:**
When a customer asks for an item, the AI must verify that the item's `stock_quantity` is greater than 0 and `is_active` is true before saying it is available or adding it to the cart.

**❌ Must NOT Do:**
The AI must never add an out-of-stock or deactivated item to the cart, even if the customer explicitly requests it by name.

> **What happens when stock is 0:**
> ✅ Correct response: *"I'm sorry, the Chicken Wings are actually sold out for today. Can I suggest something else from our starters?"*

---

### Rule A-4 — The AI Must Get Explicit Confirmation Before Submitting

**✅ Must Do:**
Before calling `submit_order()`, the AI must:
1. Call `get_cart_summary()` to retrieve the full itemized list and grand total.
2. Present this summary clearly to the customer — every item, every quantity, every price, and the final total.
3. Wait for an **explicit confirmation** from the customer. Words like "yes", "confirm", "place the order", "go ahead", or clicking a Confirm button all count.

**❌ Must NOT Do:**
The AI must **never** call `submit_order()` without first receiving the customer's explicit confirmation. It must not submit because it *assumes* the customer is ready.

---

### Rule A-5 — The AI Must Stay On Topic

**✅ Must Do:**
The AI should politely decline any request that falls outside of:
- Answering questions about the restaurant menu.
- Helping the customer build and manage their order.
- Checking and redeeming reward points.
- Reporting the status of the customer's current or past orders.

**❌ Must NOT Do:**
The AI must not engage with off-topic requests such as general knowledge questions, coding help, personal advice, jokes unrelated to the restaurant, or any harmful, political, or sensitive topics.

> **How to handle off-topic input:**
> Customer: *"Can you write me a poem?"*
> ✅ Correct response: *"I'm your dedicated ordering assistant! I can help you browse the menu, manage your order, or check your reward points. What would you like to eat today?"*

---

### Rule A-6 — The AI Must Handle Toxic or Rude Inputs Gracefully

**✅ Must Do:**
If a customer sends a message that is rude, abusive, or contains profanity, the AI must respond calmly, professionally, and without escalating the situation. It should redirect the conversation back to ordering.

**❌ Must NOT Do:**
The AI must never mirror rude language, never insult the customer back, and never refuse to serve the customer entirely based on a single rude message (unless the message contains genuinely harmful content, in which case the system prompt should instruct it to stop responding).

> **Example:**
> Customer: *"This is [expletive] slow, just add the burger already!"*
> ✅ Correct response: *"I'm sorry for any frustration! Let me get that Burger added for you right away."*

---

### Rule A-7 — Order Modifications Require Stock Restoration & Re-Approval

Customers are allowed to modify their order after it has been submitted, but only under strict conditions. The backend must follow a precise sequence of steps to keep stock levels accurate and ensure a human manager always reviews the final version of every order.

**✅ Must Do — Modifying a PENDING_APPROVAL Order:**

If the order is still in `PENDING_APPROVAL` status (the manager has not acted yet), the customer may request changes through the AI. The backend must:

1. Load the current list of items on the existing order from the `order_items` table.
2. **Restore stock** — for every item currently on the order, add its quantity back to the corresponding `menu_item.stock_quantity`. This undoes the stock reservation made when the order was first submitted.
3. Validate the new set of items — check that each new item exists, is active, and has sufficient stock.
4. Deduct the new quantities from stock.
5. Replace the `order_items` records with the updated list and recalculate the `total_amount`.
6. Keep the order status as `PENDING_APPROVAL` so the manager sees the refreshed version in their dashboard.

**✅ Must Do — Modifying an APPROVED Order:**

If a manager has already approved the order (status is `APPROVED`), a modification is still allowed but the backend must do one extra step:

1. Follow the same stock restoration process as above (restore old quantities, validate and deduct new quantities, update line items and total).
2. **Reset the order status from `APPROVED` back to `PENDING_APPROVAL`** so the manager must review and re-approve the updated order before it proceeds.
3. Clear the `manager_id` and `resolved_at` fields on the order record, as the previous approval decision is now void.
4. **Reverse the reward points** if any were already awarded for this order — insert a correcting negative entry in the `reward_points` ledger. Points will be recalculated and re-awarded when the manager approves the modified order.

**❌ Must NOT Do:**

- The AI or backend must never modify an order that is in `REJECTED` or `CANCELLED` status. These are final states and are immutable.
- Stock must never be double-deducted. The restore step must always happen before new stock is deducted.
- The system must never leave an order in `APPROVED` status after items have changed — manager re-approval is mandatory.

> **Why this matters:** Stock numbers in the database must always reflect reality. If a customer changes "2 Chicken Wings" to "1 Chicken Wing" after approval, that extra Wing must be put back in stock immediately so another customer can order it. And since the order content changed, the manager must see and approve the new version — this is the core HITL guarantee.

---


## 2. Error Handling Boundaries

These rules define how the FastAPI backend must communicate failures back to the frontend. The goal is: **never show an ugly crash to the user; always return a clear, structured error response.**

---

### Rule E-1 — Always Return a Structured JSON Error

**✅ Must Do:**
All error responses from the FastAPI backend must be returned as valid JSON with at least the following fields:

```json
{
  "error": true,
  "code": "ERROR_CODE_HERE",
  "message": "A human-readable explanation of what went wrong."
}
```

**❌ Must NOT Do:**
The backend must never let a raw Python exception (a "500 Internal Server Error" with a stack trace) reach the frontend. All exceptions must be caught and returned as structured responses.

---

### Rule E-2 — Use the Correct HTTP Status Code for Every Situation

The following table defines which status code must be used for each scenario. Using the wrong code is a bug.

| Situation | HTTP Status Code | Error Code (in JSON) |
|---|---|---|
| Request is not authenticated (no JWT or invalid JWT) | `401 Unauthorized` | `UNAUTHORIZED` |
| User is authenticated but lacks the required role (e.g., a customer accessing a manager route) | `403 Forbidden` | `FORBIDDEN` |
| A requested resource does not exist (e.g., order ID not found) | `404 Not Found` | `NOT_FOUND` |
| A submitted field is invalid or missing (e.g., empty order, negative quantity) | `400 Bad Request` | `VALIDATION_ERROR` |
| The requested item is out of stock | `400 Bad Request` | `OUT_OF_STOCK` |
| The customer does not have enough reward points to redeem a reward | `400 Bad Request` | `INSUFFICIENT_POINTS` |
| The operation is not allowed in the current state (e.g., cancelling an already-approved order) | `409 Conflict` | `INVALID_STATE_TRANSITION` |
| The user has exceeded the rate limit on the chat endpoint | `429 Too Many Requests` | `RATE_LIMIT_EXCEEDED` |
| An unexpected server-side error occurred | `500 Internal Server Error` | `INTERNAL_ERROR` |

---

### Rule E-3 — Rate Limit Errors Must Include a Retry Time

**✅ Must Do:**
When returning a `429 Too Many Requests` response, the backend must include a `Retry-After` header (in seconds) telling the client how long to wait before trying again.

```
HTTP/1.1 429 Too Many Requests
Retry-After: 15
Content-Type: application/json

{
  "error": true,
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "You're sending messages too quickly. Please wait 15 seconds before trying again."
}
```

**❌ Must NOT Do:**
Do not return a generic 429 with no guidance. The frontend must know when it is safe to retry.

---

### Rule E-4 — Auth Errors Must Not Leak Sensitive Information

**✅ Must Do:**
When a login fails, return a generic error message that does not tell the user *why* it failed.

> ✅ Correct: *"Invalid email or password."*

**❌ Must NOT Do:**
Never reveal whether the email exists in the system or not. Both "email not found" and "wrong password" should return the exact same message. This prevents attackers from using the login form to guess which emails are registered.

> ❌ Wrong: *"No account found for this email."* ← This tells an attacker the email is not registered.
> ❌ Wrong: *"Incorrect password."* ← This tells an attacker the email IS registered.

---

### Rule E-5 — The Frontend Must Display User-Friendly Error Messages

**✅ Must Do:**
The React frontend must translate every error code into a short, friendly message shown in the UI. It must never display a raw JSON response, error code, or stack trace to the customer or manager.

| Error Code | What the UI Must Show |
|---|---|
| `UNAUTHORIZED` | "Please log in to continue." |
| `FORBIDDEN` | "You don't have permission to do that." |
| `OUT_OF_STOCK` | "Sorry, that item is no longer available." |
| `INSUFFICIENT_POINTS` | "You don't have enough points for that reward." |
| `RATE_LIMIT_EXCEEDED` | "You're going too fast! Please wait a moment." |
| `INVALID_STATE_TRANSITION` | "This order can no longer be changed." |
| `INTERNAL_ERROR` | "Something went wrong on our end. Please try again." |

---

## 3. Data Integrity Rules

These rules protect the accuracy and consistency of the data in the database. A database with bad data is worse than no database at all — it silently gives wrong answers.

---

### Rule D-1 — Stock Quantity Must Never Go Below Zero

**✅ Must Do:**
Before any item is added to an order, the backend must check that `stock_quantity >= requested_quantity`. If not, the request must be rejected with an `OUT_OF_STOCK` error.

After an order is approved, the stock quantity for each ordered item must be decreased by the quantity ordered (e.g., if 2 Chicken Wings were ordered and approved, `stock_quantity` for Chicken Wings decreases by 2).

When `stock_quantity` reaches **0**, the `is_active` flag for that item must be automatically set to `false`. The item will immediately disappear from the AI's tool responses.

**❌ Must NOT Do:**
The database must never have a `stock_quantity` value below 0. This must be enforced with both application-level checks (in the FastAPI route) and a database-level constraint (`CHECK (stock_quantity >= 0)`).

---

### Rule D-2 — Every Order Must Pass Through Manager Approval

**✅ Must Do:**
The only valid order status transitions are:

```
DRAFT → PENDING_APPROVAL   (customer confirms)
PENDING_APPROVAL → APPROVED  (manager approves)
PENDING_APPROVAL → REJECTED  (manager rejects)
DRAFT → CANCELLED            (customer cancels)
PENDING_APPROVAL → CANCELLED  (customer cancels before manager acts)
```

**❌ Must NOT Do:**
No order may ever skip from `DRAFT` directly to `APPROVED` or `REJECTED`. The `PENDING_APPROVAL` step is mandatory for every single order. This rule is the technical implementation of the Human-in-the-Loop guarantee.

If any code path attempts an illegal status transition (e.g., `APPROVED → PENDING_APPROVAL`), the backend must reject the request with a `409 Conflict` error and log the attempt.

---

### Rule D-3 — Role Checks Must Be Enforced Server-Side

**✅ Must Do:**
Role-based access control (RBAC) must be enforced by the **FastAPI backend middleware** on every protected route. The frontend may hide or show UI elements based on role, but this is only a cosmetic convenience — the backend is the real gatekeeper.

Every manager-only route (`/manager/*`) must verify:
1. The request includes a valid JWT token.
2. The JWT decodes to a real user in the database.
3. That user's `role` field is exactly `manager`.

If any of these checks fail, the request is rejected immediately.

**❌ Must NOT Do:**
Never rely on the frontend alone to prevent a customer from accessing manager functionality. A technically savvy user can send HTTP requests directly to the backend, bypassing the UI entirely. The backend must always check.

---

### Rule D-4 — Reward Points Must Only Be Awarded for Approved Orders

**✅ Must Do:**
The `reward_points` ledger entry for an order must only be created **after** the manager has clicked Approve and the order status has been set to `APPROVED`. This must happen in the same database transaction as the status update — both succeed or both are rolled back together.

**❌ Must NOT Do:**
Points must never be awarded for:
- Orders in `DRAFT` or `PENDING_APPROVAL` status.
- Orders that are `REJECTED`.
- Orders that are `CANCELLED`.

If an order is cancelled *after* points were incorrectly awarded (which should not happen but must be defended against), the system must log the anomaly and flag it for manual review.

---

### Rule D-5 — Prices Must Be Snapshotted at Time of Order

**✅ Must Do:**
When a customer's order is submitted (status moves to `PENDING_APPROVAL`), the price of each item at that exact moment must be saved in the `order_items.unit_price` column.

This means that if a manager later raises the price of Chicken Wings from ₹250 to ₹300, **existing submitted orders are not affected** — they retain the price the customer was quoted.

**❌ Must NOT Do:**
The `order_items` table must never look up the current price from `menu_items` at the time of approval or reporting. The price must always be read from the `unit_price` snapshot column on the `order_items` record itself.

---

### Rule D-6 — Deletions Must Be Soft Where Possible

**✅ Must Do:**
When a manager "deletes" a menu item, the preferred approach is to set `is_active = false` (a "soft delete"). This preserves historical integrity — past orders that referenced this item will still have valid foreign key references and accurate records.

Only perform a hard delete (physically removing the row) when explicitly required by a data retention policy. Hard deletes should always require a double confirmation in the UI.

**❌ Must NOT Do:**
Never hard-delete a menu item that has been referenced by any existing order. This would break the relationship between `order_items` and `menu_items` and corrupt historical records.

---

### Rule D-7 — The Backend Must Own All Analytics Aggregation

This rule applies specifically to the data visualization / analytics feature on the Manager Dashboard.

**✅ Must Do:**
All data grouping, summing, averaging, filtering, and sorting required to produce chart data must be performed by the **FastAPI backend** — either using SQLAlchemy query expressions or Python logic on the server side.

The backend must expose clean, pre-aggregated endpoints that return data in the exact shape the frontend chart library (Recharts) needs. For example:

- `GET /manager/analytics/revenue` — returns a list of `{ "date": "...", "revenue": float }` objects, one per day or week, calculated from the `orders` table where `status = APPROVED`.
- `GET /manager/analytics/top-items` — returns a list of `{ "item_name": "...", "total_ordered": int }` objects, sorted by quantity, calculated from the `order_items` table joined with `menu_items`.
- `GET /manager/analytics/inventory` — returns a list of `{ "item_name": "...", "stock_quantity": int, "is_low_stock": bool }` objects derived from the live `menu_items` table.

**❌ Must NOT Do:**
- The frontend must **never** receive a raw dump of order records and calculate revenue totals or item counts itself in JavaScript. This is inefficient, slow for large datasets, and puts sensitive data unnecessarily in the browser.
- Analytics endpoints must never include revenue or order counts from `REJECTED`, `CANCELLED`, or `DRAFT` orders. Only `APPROVED` orders count toward business metrics.
- The frontend must never make multiple separate API calls to join or combine data that the backend could have returned in a single aggregated response.

> **Why this matters:** Imagine if the analytics page had to download 10,000 order records to draw a single line chart. The page would be slow, the browser would do unnecessary work, and the user would be waiting. By doing the math on the server first and sending only the final summary, the chart loads almost instantly and the browser stays snappy.

---

*End of RULES.md v2.0*
