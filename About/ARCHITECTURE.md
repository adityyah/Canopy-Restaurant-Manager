# ARCHITECTURE.md — AI-Powered Restaurant Ordering System
### *Capstone Portfolio Project*

**File Location:** `About/ARCHITECTURE.md`

**Last Updated:** July 2026

**Status:** v1.0

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack Breakdown](#2-tech-stack-breakdown)
3. [Database Schema](#3-database-schema)
4. [The Core Data Flow](#4-the-core-data-flow)

---

## 1. System Overview

### The Big Picture

Think of this application like a restaurant with three distinct zones: the **dining room**, the **kitchen**, and the **filing cabinet** — plus a smart waiter, a security desk at the door, and a bouncer who controls how fast people can talk.

| Analogy | What it maps to in the app |
|---|---|
| 🍽️ The Dining Room | **React Frontend** — what the customer and manager see and interact with |
| 📊 The Scoreboard | **Recharts** — turns the backend's number summaries into visual charts on the Manager Dashboard |
| 🧠 The Kitchen | **FastAPI Backend** — where all the real work and logic happens |
| 🗄️ The Filing Cabinet | **SQLite Database** — where everything is stored and remembered |
| 🤖 The Smart Waiter | **GPT-4o-mini AI Agent** — takes orders and answers menu questions |
| 🔐 The Security Desk | **Supabase Auth** — checks who you are before letting you in |
| 🚦 The Bouncer | **Redis / Upstash Rate Limiter** — stops people from talking too fast |

### How the Pieces Connect

```
┌─────────────────────────────────────────────────────────────────┐
│                     BROWSER (User's Device)                     │
│                                                                 │
│   ┌──────────────────────────┐  ┌──────────────────────────┐    │
│   │   Customer Chat UI       │  │   Manager Dashboard      │    │
│   │   (React + Tailwind)     │  │   (React + Tailwind)     │    │
│   └────────────┬─────────────┘  └──────────────┬───────────┘    │
│                │                               │                │
└────────────────┼───────────────────────────────┼────────────────┘
                 │        HTTP Requests          │
                 │      (REST API calls)         │
┌────────────────▼───────────────────────────────▼───────────────┐
│                    BACKEND (FastAPI / Python)                  │
│                                                                │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│   │  Auth Routes │  │ Order Routes │  │  Menu / Inventory    │ │
│   │  (Supabase)  │  │  (HITL flow) │  │  Routes (CRUD)       │ │
│   └──────────────┘  └──────────────┘  └──────────────────────┘ │
│                                                                │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │             AI Agent Service (GPT-4o-mini)              │  │
│   │   Uses tools to read the menu, build orders, manage     │  │
│   │   reward points — never guesses, always uses tools      │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                │
│   ┌───────────────────┐        ┌──────────────────────────┐    │
│   │  SQLAlchemy ORM   │        │  Redis / Upstash         │    │
│   │  (talks to SQLite)│        │  (Rate Limiter)          │    │
│   └─────────┬─────────┘        └──────────────────────────┘    │
│             │                                                  │
└─────────────┼──────────────────────────────────────────────────┘
              │
┌─────────────▼──────────────┐       ┌─────────────────────────┐
│   SQLite Database          │       │   Supabase (Auth)       │
│   (Menu, Orders, Users,    │       │   (User accounts, JWTs, │
│    Rewards, Chat Sessions) │       │    role management)     │
└────────────────────────────┘       └─────────────────────────┘
```

The two sides never talk directly to each other. The **Frontend** always talks to the **Backend**, and the **Backend** is the only thing that ever reads from or writes to the **Database**. This is a standard and safe pattern for web applications.

---

## 2. Tech Stack Breakdown

### 2.1 Frontend — React + Tailwind CSS

**What it is:** React is a JavaScript library for building user interfaces. Tailwind CSS is a styling tool that lets you design layouts quickly without writing a lot of custom CSS.

**What it does in this project:**
- Renders the **Customer Chat Interface** — the chat window where customers talk to the AI.
- Renders the **Manager Dashboard** — where managers see pending orders and take action.
- Sends API requests to the FastAPI backend whenever the user does something (sends a message, clicks Approve, etc.).
- Displays real-time order status by periodically asking the backend for updates.

**Key principle:** React handles *how things look and feel*. It does not store any permanent data on its own — all important information lives in the database.

---

### 2.2 Backend — FastAPI (Python)

**What it is:** FastAPI is a modern Python framework for building web APIs. An API (Application Programming Interface) is essentially a set of doors that the frontend can knock on to get things done.

**What it does in this project:**
- Acts as the central hub that connects everything else.
- Receives requests from the frontend (e.g., "the customer sent a message") and decides what to do.
- Talks to the AI agent, the database, and Supabase — and sends results back to the frontend.
- Enforces business rules: for example, making sure a customer cannot approve their own order, or that points are only awarded after a manager approves an order.
- Protects routes so that only logged-in users with the right role can access them.

**The API is organized into logical groups (called "routers"):**

| Router | Handles |
|---|---|
| `/auth` | Login, logout, session management |
| `/chat` | Sending messages to the AI agent |
| `/orders` | Placing, viewing, cancelling, and modifying orders |
| `/manager/orders` | Approving and rejecting orders |
| `/manager/menu` | Adding, editing, and deleting menu items |
| `/manager/analytics` | Aggregated data for revenue, top-selling items, and inventory charts |
| `/rewards` | Checking and redeeming loyalty points |

---

### 2.3 Database — SQLite + SQLAlchemy ORM

**What it is:** SQLite is a simple, file-based database. Instead of running as a separate server, it lives as a single `.db` file inside the project. SQLAlchemy is an ORM (Object-Relational Mapper) — a tool that lets Python code interact with the database using Python objects instead of raw SQL queries.

**Analogy:** Think of SQLite as a very organized spreadsheet file. SQLAlchemy is the assistant who reads and writes to that spreadsheet on your behalf so you don't have to write the raw instructions yourself.

**What it does in this project:**
- Permanently stores all application data: users, menu items, orders, order items, reward points, and chat history.
- Is queried by the FastAPI backend to read or save information.
- Is also queried by the **AI agent's tools** to look up live menu items (this is how the AI avoids hallucinating — it always checks the real database).

---

### 2.4 Authentication — Supabase

**What it is:** Supabase is a managed authentication service. It handles the complex and security-sensitive work of managing user accounts, passwords, and login sessions so we don't have to build that from scratch.

**What it does in this project:**
- Manages **sign-up and login** for both customers and managers.
- When a user logs in, Supabase issues a **JWT (JSON Web Token)** — think of it as a digital badge that proves who you are.
- Every request from the frontend includes this badge. The FastAPI backend checks the badge to verify the user's identity and role before doing anything.
- **Role-based access control (RBAC):** Each user has a `role` field (`customer` or `manager`). The backend reads this role to decide what a user is allowed to do.

---

### 2.5 Rate Limiting — Redis / Upstash

**What it is:** Redis is an extremely fast, in-memory data store. Upstash is a cloud-hosted, serverless version of Redis that is easy to set up. Rate limiting is the practice of restricting how many times someone can do something within a time window.

**What it does in this project:**
- Guards the `/chat/message` endpoint — the most expensive endpoint in the app because it calls the OpenAI API.
- Tracks how many chat messages each user has sent in the last 60 seconds.
- If a user sends more than **30 messages per minute**, they receive an HTTP `429 Too Many Requests` error and are told to slow down.
- This prevents abuse (e.g., someone writing a script to spam the AI) and keeps API costs under control.

**Analogy:** Imagine a restaurant with a policy that each table can only call the waiter 30 times per minute. The bouncer (Redis) keeps count and politely tells the table to wait if they've been calling too often.

---

### 2.6 AI Agent — GPT-4o-mini (OpenAI API)

**What it is:** GPT-4o-mini is a lightweight but capable large language model (LLM) from OpenAI. In this project, it is used as a **tool-calling agent** — meaning it doesn't just chat freely, it is given a specific set of tools it must use to get real data.

**What it does in this project:**
- Conducts the ordering conversation with the customer.
- Uses **defined tools** to look up menu items, manage the cart, check reward point balances, and submit orders. It is not allowed to make anything up.
- Follows a strict system prompt that defines its role, boundaries, and personality.

**The AI's Tool Kit:**

| Tool | What it does |
|---|---|
| `get_menu_items` | Fetches all currently active menu items from the SQLite database |
| `get_item_by_name` | Looks up a single menu item by name to verify it exists |
| `add_item_to_cart` | Adds a verified item and quantity to the customer's current order |
| `remove_item_from_cart` | Removes or reduces an item in the cart |
| `get_cart_summary` | Returns the current cart with a calculated grand total |
| `clear_cart` | Empties the cart entirely |
| `get_reward_balance` | Fetches the customer's current loyalty point balance |
| `redeem_reward` | Applies a reward redemption to the current order |
| `submit_order` | Finalizes the cart and sends the order to the manager dashboard |

**Critical rule:** The AI can only call these tools. It cannot invent menu items, make up prices, or do anything outside this list.

---

### 2.7 Charts — Recharts

**What it is:** Recharts is a charting library built specifically for React. It lets you create interactive charts (line charts, pie charts, bar charts, etc.) using simple React components. It handles all the drawing and layout automatically — you just give it the data.

**What it does in this project:**
- Renders the **Revenue Line Chart** on the Manager Analytics page — showing approved revenue totals grouped by day or week.
- Renders the **Top-Selling Items Pie Chart** — showing which dishes appear most often in approved orders.
- Renders the **Inventory Bar Chart** — showing current stock levels for all active menu items, with low-stock items visually flagged.

**Key principle:** Recharts is a *display tool only*. It never fetches raw database records or calculates anything. The FastAPI backend does all the aggregation (grouping, summing, sorting) and sends Recharts a clean, ready-to-plot array of numbers. For example, instead of sending 500 individual order records, the backend sends:

```json
[
  { "date": "2026-07-10", "revenue": 4820.00 },
  { "date": "2026-07-11", "revenue": 6315.50 },
  { "date": "2026-07-12", "revenue": 5100.00 }
]
```

Recharts receives this and draws the line chart immediately — no extra work on the frontend side.

**Why Recharts over alternatives?** Recharts integrates natively with React's component model, supports dark backgrounds out of the box with custom color props, and requires no external canvas setup. It is the lightest-weight option for a project of this scope.

---

## 3. Database Schema

The database is the long-term memory of the application. Every piece of important data lives here. Below is a plain-English description of the main tables and what each column stores.

> **What is a table?** Think of a database table like a spreadsheet tab. Each row is one record (e.g., one order, one menu item). Each column is a specific piece of information about that record.

---

### Table 1: `users`

Stores a reference to every person who has an account, mirroring the user data managed by Supabase.

| Column | Type | What it stores |
|---|---|---|
| `id` | UUID | A unique ID for the user, provided by Supabase |
| `email` | Text | The user's email address |
| `role` | Text | Either `customer` or `manager` — controls what they can access |
| `created_at` | Timestamp | When the account was created |

---

### Table 2: `menu_items`

Stores every dish or drink the restaurant offers, along with its current availability and stock.

| Column | Type | What it stores |
|---|---|---|
| `id` | Integer | A unique ID for the menu item |
| `name` | Text | The name of the dish (e.g., "Margherita Pizza") |
| `description` | Text | A short description of the item |
| `category` | Text | The category (e.g., Starters, Mains, Desserts, Beverages) |
| `price` | Decimal | The price in local currency |
| `stock_quantity` | Integer | How many units are currently available. When this hits 0, the item is auto-deactivated |
| `is_vegetarian` | Boolean | True if the item is vegetarian |
| `is_vegan` | Boolean | True if the item is vegan |
| `is_gluten_free` | Boolean | True if the item is gluten-free |
| `is_active` | Boolean | True = visible to the AI and customers. False = hidden |
| `created_at` | Timestamp | When the item was added to the menu |
| `updated_at` | Timestamp | When the item was last edited |

---

### Table 3: `orders`

Stores every order placed by a customer, from the moment the cart is created to the final manager decision.

| Column | Type | What it stores |
|---|---|---|
| `id` | Integer | A unique ID for the order |
| `customer_id` | UUID | Links to the `users` table — who placed the order |
| `status` | Text | The current state of the order (see status lifecycle below) |
| `total_amount` | Decimal | The grand total calculated at the time of submission |
| `rejection_reason` | Text | The manager's optional reason if the order was rejected |
| `manager_id` | UUID | Links to the `users` table — which manager acted on the order |
| `created_at` | Timestamp | When the order was first started |
| `submitted_at` | Timestamp | When the customer clicked "Confirm Order" |
| `resolved_at` | Timestamp | When the manager approved or rejected it |

**Order Status Lifecycle:**

```
DRAFT  →  PENDING_APPROVAL  →  APPROVED
                          ↘  REJECTED
         (before manager acts)
DRAFT or PENDING_APPROVAL  →  CANCELLED  (customer cancels)
```

---

### Table 4: `order_items`

Stores the individual line items (each dish) that belong to a specific order. An order can have many order items.

| Column | Type | What it stores |
|---|---|---|
| `id` | Integer | A unique ID for this line item |
| `order_id` | Integer | Links to the `orders` table — which order this belongs to |
| `menu_item_id` | Integer | Links to the `menu_items` table — which dish was ordered |
| `quantity` | Integer | How many of this item were ordered |
| `unit_price` | Decimal | The price of one unit **at the time of ordering** (a snapshot, in case the price changes later) |
| `subtotal` | Decimal | `quantity × unit_price` |

---

### Table 5: `reward_points`

Tracks the loyalty point balance and transaction history for each customer.

| Column | Type | What it stores |
|---|---|---|
| `id` | Integer | A unique ID for this transaction record |
| `customer_id` | UUID | Links to the `users` table — whose points these are |
| `order_id` | Integer | Links to the `orders` table — the order that triggered this transaction |
| `points_change` | Integer | Positive number = points earned. Negative number = points redeemed |
| `reason` | Text | A human-readable note (e.g., "Earned for Order #42" or "Redeemed for free lemonade") |
| `created_at` | Timestamp | When this transaction was recorded |

> **How is the current balance calculated?** The app adds up all `points_change` values for a given customer. There is no single "balance" column — the balance is always calculated from the full history. This makes the records trustworthy and auditable.

---

### Table 6: `chat_sessions`

Stores the full conversation history between the customer and the AI agent for each ordering session.

| Column | Type | What it stores |
|---|---|---|
| `id` | Integer | A unique ID for the chat session |
| `customer_id` | UUID | Links to the `users` table — who was chatting |
| `order_id` | Integer | Links to the `orders` table — the order being built in this session |
| `messages` | JSON | The full back-and-forth conversation stored as a list of messages |
| `created_at` | Timestamp | When the chat session started |
| `updated_at` | Timestamp | When the last message was sent |

---

### Schema Relationships at a Glance

```
users ──────────────────────────────────────┐
  │                                         │
  ├──< orders >─────────────────────────────┤ (manager_id)
  │       │                                 │
  │       ├──< order_items >──< menu_items  │
  │       │                                 │
  │       └──< reward_points               │
  │                                         │
  └──< chat_sessions >──< orders            │
                                            │
  users ──────────────────────────────────── (manager who acted)
```

---

## 4. The Core Data Flow

This section walks through the most important sequence of events in the application: **a customer placing an order and a manager approving it**. This is the heart of the HITL (Human-in-the-Loop) pattern.

Each step below maps to a real action in the system.

---

### Step 1 — The Customer Logs In

1. The customer opens the app in their browser (the React frontend loads).
2. They enter their email and password on the login screen.
3. The frontend sends these credentials to **Supabase**.
4. Supabase verifies the credentials. If correct, it sends back a **JWT token** (a long encrypted string that acts as a digital ID badge).
5. The frontend stores this token and includes it in every future request it makes to the backend.

---

### Step 2 — The Customer Starts a Conversation

1. The customer is now on the chat screen. They type a message like: *"Hi, what do you have for starters?"*
2. The frontend sends this message — along with the JWT token — to the FastAPI backend at the `POST /chat/message` endpoint.
3. The backend first checks the JWT token with Supabase to confirm the customer is logged in.
4. The backend then checks the **Redis rate limiter**. If the customer has sent fewer than 30 messages in the last minute, the request is allowed through. Otherwise, a `429` error is returned.
5. The backend passes the message to the **AI Agent Service**.

---

### Step 3 — The AI Agent Looks Up the Menu

1. The AI agent (GPT-4o-mini) receives the customer's message along with its system prompt and the conversation history so far.
2. The AI decides it needs to look up the menu. It calls its `get_menu_items` tool with a filter for the "Starters" category.
3. The tool executes a real database query against the **SQLite database** via SQLAlchemy.
4. The database returns a list of active starter items with their names, descriptions, and prices.
5. The AI receives this real data and composes a response like: *"We have three starters today: Garlic Bread (₹120), Soup of the Day (₹180), and Chicken Wings (₹250)."*
6. The FastAPI backend sends this response back to the frontend, which displays it as a chat bubble.

> **Why this matters:** At no point does the AI guess or invent anything. Every item name and price came directly from the live database.

---

### Step 4 — The Customer Builds Their Order

1. The customer replies: *"I'll take the Garlic Bread and two Chicken Wings."*
2. The message goes through the same path: Frontend → FastAPI → Rate Limiter check → AI Agent.
3. The AI calls `get_item_by_name("Garlic Bread")` to verify it exists, then calls `add_item_to_cart("Garlic Bread", 1)`.
4. It then calls `get_item_by_name("Chicken Wings")` and `add_item_to_cart("Chicken Wings", 2)`.
5. Each tool call updates the in-progress order in the database (status: `DRAFT`).
6. The AI confirms: *"Got it! I've added 1 Garlic Bread and 2 Chicken Wings. Anything else?"*

#### ↳ Optional Sub-Step 4A — The Customer Redeems Reward Points

This sub-step can happen at any point while the order is still in `DRAFT` — before the customer confirms.

1. The customer asks: *"Can I use my points for a free drink?"*
2. The AI does **not** guess the customer's balance. Instead, it calls `get_reward_balance()`, which queries the `reward_points` table in the database and sums up all past `points_change` values for this customer to calculate their live balance.
3. The database returns, for example, a balance of **120 points**.
4. The AI checks whether the customer has enough points for the requested reward. Each reward has a defined point cost stored in the system (e.g., a free lemonade costs 100 points).
5. If the customer has enough, the AI confirms: *"Great news! You have 120 points. A free Lemonade costs 100 points. Want me to apply that?"*
6. The customer says *"Yes"*.
7. The AI calls `redeem_reward("Lemonade", 100)`. This tool does two things:
   - Adds the free "Lemonade" item to the cart at a ₹0 price.
   - Inserts a **negative** entry in the `reward_points` table (e.g., `points_change = -100`, reason = "Redeemed for free lemonade") to deduct the points from the customer's balance.
8. The AI confirms: *"Done! I've added a free Lemonade to your order and deducted 100 points. Your remaining balance is 20 points."*
9. The order continues as `DRAFT` with the free item now included.

> **Why negative entries?** Instead of updating a single "balance" number (which could become wrong if something goes wrong), the system records every single earn and redeem as its own row. The real balance is always calculated by adding up the full history. This way, nothing is ever silently overwritten.

---

### Step 5 — The Customer Confirms the Order

1. The customer types: *"That's everything. What's my total?"*
2. The AI calls `get_cart_summary()`, which queries the database and returns the itemized list and grand total (now including the ₹0 redeemed item if applicable).
3. The AI presents: *"Here's your order: Garlic Bread × 1 = ₹120, Chicken Wings × 2 = ₹500, Lemonade × 1 = ₹0 (redeemed). Grand Total: ₹620. Shall I place this order?"*
4. The customer says: *"Yes, confirm."*
5. The AI calls `submit_order()`. This tool does three things in the database:
   - Updates the `orders` record status from `DRAFT` → `PENDING_APPROVAL`.
   - Sets the `submitted_at` timestamp.
   - Records the final `total_amount`.
6. The AI responds: *"Your order has been sent to the manager for approval. I'll let you know as soon as it's confirmed!"*

---

### Step 6 — The Manager Reviews the Order

1. On the other side of the restaurant, the manager is logged in on their dashboard.
2. The manager dashboard (React frontend) is regularly asking the backend `GET /manager/orders/pending` — checking if any new orders need attention.
3. The new order appears as a card on the dashboard showing: customer name, items, and the ₹620 total.
4. The manager reviews it and clicks **Approve**.

---

### Step 7 — The Manager Approves the Order

1. The frontend sends a `POST /manager/orders/{order_id}/approve` request to the FastAPI backend, including the manager's JWT token.
2. The backend verifies the JWT and confirms the user has the `manager` role.
3. The backend updates the `orders` record in the database:
   - Status: `PENDING_APPROVAL` → `APPROVED`
   - `manager_id` is set to this manager's user ID.
   - `resolved_at` timestamp is set.
4. **Reward points are calculated and awarded:** The backend calculates the points for this order (based on total price and item count, resulting in a value between 10–50) and inserts a new record in the `reward_points` table.
5. The backend returns a success response to the manager's frontend.

---

### Step 8 — The Customer Sees the Result

1. Back on the customer's screen, the frontend is periodically asking `GET /orders/{order_id}/status`.
2. It now receives the status `APPROVED`.
3. The customer's screen updates to show a success message: *"🎉 Your order has been approved! You also earned 32 reward points."*

---

### Full Flow Summary

```
Customer types message
        │
        ▼
React Frontend
        │  (HTTP POST with JWT)
        ▼
FastAPI Backend
        ├── Supabase: verify token ✓
        ├── Redis: check rate limit ✓
        │
        ▼
AI Agent (GPT-4o-mini)
        ├── Tool: get_menu_items → SQLite DB → real data returned
        ├── Tool: add_item_to_cart → SQLite DB → order saved (DRAFT)
        ├── Tool: get_cart_summary → SQLite DB → total calculated
        └── Tool: submit_order → SQLite DB → status → PENDING_APPROVAL
        │
        ▼
Manager Dashboard polls backend
        │
Manager clicks Approve
        │
        ▼
FastAPI Backend
        ├── SQLite DB: order status → APPROVED
        └── SQLite DB: reward_points record inserted
        │
        ▼
Customer's screen updates
        └── Status: APPROVED ✓ + Points earned displayed
```

---

*End of ARCHITECTURE.md v1.0*
