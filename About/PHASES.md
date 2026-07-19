# PHASES.md — Project Build Phases
### *AI-Powered Restaurant Ordering System — Capstone Project*

**File Location:** `About/PHASES.md`

**Last Updated:** July 2026

**Status:** v1.1 — Phases 1, 2 & 3 Complete

---

> This document breaks the entire project into seven manageable phases. Each phase has a clear goal and a checklist of tasks. Work through them in order — each phase builds on the one before it. Don't move to the next phase until the current one is stable and working.

---

## Table of Contents

1. [Phase 1 — Foundation & Database](#phase-1--foundation--database)
2. [Phase 2 — Authentication & Security](#phase-2--authentication--security)
3. [Phase 3 — The AI Brain](#phase-3--the-ai-brain)
4. [Phase 4 — Frontend Skeleton & Routing](#phase-4--frontend-skeleton--routing)
5. [Phase 5 — The Manager Experience](#phase-5--the-manager-experience)
6. [Phase 6 — The Customer Experience](#phase-6--the-customer-experience)
7. [Phase 7 — Polish & Deployment](#phase-7--polish--deployment)

---

## Phase 1 — Foundation & Database ✅

**Goal:** Get the project structure in place, wire up FastAPI, and build every database model. By the end of this phase you should be able to run the backend server and inspect a working SQLite database with all the right tables.

Think of this phase as laying the concrete foundation before building the walls. Nothing is visible to users yet — but everything that comes later depends on getting this right.

---

### 1.1 — Project Setup

- [x] Create the project root folder and initialize a Git repository.
- [x] Create a `backend/` folder for the FastAPI application.
- [x] Create a `frontend/` folder (will be filled in Phase 4).
- [x] Create an `About/` folder and commit all existing documentation (PRD, ARCHITECTURE, RULES, PHASES).
- [x] Set up a Python virtual environment inside `backend/` and install core dependencies:
  - `fastapi`, `uvicorn` (the server that runs FastAPI)
  - `sqlalchemy` (the ORM that talks to SQLite)
  - `python-dotenv` (to load secret keys from a `.env` file)
  - `pydantic` (for data validation, already bundled with FastAPI)
- [x] Create a `.env` file in `backend/` for all environment variables (database path, API keys, etc.).
- [x] Add `.env` to `.gitignore` immediately — never commit secrets.
- [x] Create a `backend/app/` directory and a `main.py` entry point that starts a basic FastAPI app.
- [x] Confirm the server runs with `uvicorn app.main:app --reload` and the default `/docs` page loads.

---

### 1.2 — Project Folder Structure

- [x] Organize the `backend/app/` folder into the following sub-folders:
  ```
  backend/
  └── app/
      ├── main.py          ← Entry point, FastAPI app instance
      ├── database.py      ← SQLite connection + SQLAlchemy session setup
      ├── models/          ← SQLAlchemy table models (one file per table)
      ├── schemas/         ← Pydantic models for request/response validation
      ├── routes/          ← API route handlers, organized by feature
      ├── services/        ← Business logic (separate from route handlers)
      ├── agents/          ← AI agent setup and tool definitions
      └── middleware/      ← Auth checks and rate limiting
  ```

---

### 1.3 — Database Setup

- [x] Create `database.py` to configure the SQLAlchemy engine pointing to the local `restaurant.db` SQLite file.
- [x] Write a `get_db()` dependency function that opens and closes a database session per request.

---

### 1.4 — SQLAlchemy Models

Create one file per table inside `models/`. Each file defines the columns, data types, and relationships for that table.

- [x] **`models/user.py`** — `users` table
  - Columns: `id` (UUID, primary key), `email`, `role` (`customer` / `manager`), `created_at`

- [x] **`models/menu_item.py`** — `menu_items` table
  - Columns: `id`, `name` (unique), `description`, `category`, `price`, `stock_quantity`, `is_vegetarian`, `is_vegan`, `is_gluten_free`, `is_active`, `created_at`, `updated_at`
  - Add a database-level constraint: `CHECK (stock_quantity >= 0)`

- [x] **`models/order.py`** — `orders` table
  - Columns: `id`, `customer_id` (FK → users), `status` (Enum: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, CANCELLED), `total_amount`, `rejection_reason`, `manager_id` (FK → users, nullable), `created_at`, `submitted_at`, `resolved_at`

- [x] **`models/order_item.py`** — `order_items` table
  - Columns: `id`, `order_id` (FK → orders), `menu_item_id` (FK → menu_items), `quantity`, `unit_price` (price snapshot), `subtotal`

- [x] **`models/reward_point.py`** — `reward_points` table
  - Columns: `id`, `customer_id` (FK → users), `order_id` (FK → orders, nullable), `points_change` (positive = earned, negative = redeemed), `reason`, `created_at`

- [x] **`models/chat_session.py`** — `chat_sessions` table
  - Columns: `id`, `customer_id` (FK → users), `order_id` (FK → orders, nullable), `messages` (JSON column), `created_at`, `updated_at`

- [x] Run `Base.metadata.create_all(bind=engine)` on startup to create all tables.
- [x] Inspect the `restaurant.db` file with a SQLite viewer (e.g., DB Browser for SQLite) to confirm all tables and columns exist correctly.

---

### 1.5 — Seed Data

- [x] Write a `seed.py` script in `backend/` that populates the `menu_items` table with at least 12 sample items across 4 categories (Starters, Mains, Desserts, Beverages).
- [x] Include a mix of vegetarian, vegan, and gluten-free items.
- [x] Set realistic prices and stock quantities (e.g., 20–50 units each).
- [x] Run the seed script and confirm items appear in the database.

---

### ✅ Phase 1 Done When:
- The FastAPI server starts without errors.
- All 6 database tables exist with the correct columns.
- Seed menu data is visible in the database.

---

## Phase 2 — Authentication & Security ✅

**Goal:** Lock down the application. By the end of this phase, only authenticated users can access the API, and only managers can access manager routes. The AI chat endpoint is also protected against spam.

---

### 2.1 — Supabase Setup

- [x] Create a free Supabase project at [supabase.com](https://supabase.com).
- [x] Grab the `SUPABASE_URL` and `SUPABASE_ANON_KEY` from the Supabase dashboard and add them to `.env`.
- [x] Install the Supabase Python client: `pip install supabase`.
- [x] Create two test accounts in Supabase:
  - One with `role = customer` (e.g., `customer@test.com`)
  - One with `role = manager` (e.g., `manager@test.com`)
- [x] Manually insert corresponding rows into the local `users` table for these accounts (matching the Supabase user UUIDs).

---

### 2.2 — JWT Verification Middleware

- [x] Write a `get_current_user()` dependency in `middleware/auth.py` that:
  - Reads the `Authorization: Bearer <token>` header from every incoming request.
  - Calls Supabase to verify the token is valid and not expired.
  - Looks up the user in the local `users` table using the UUID from the token.
  - Returns the user object if valid, or raises a `401 Unauthorized` error if not.
- [x] Write a `require_manager()` dependency that calls `get_current_user()` and additionally checks that `user.role == "manager"`. Raises a `403 Forbidden` error if the check fails.
- [x] Apply `get_current_user` to all customer-facing protected routes.
- [x] Apply `require_manager` to all `/manager/*` routes.

---

### 2.3 — Auth Routes

- [x] Create `routes/auth.py` with the following endpoints, which act as a thin wrapper around Supabase:
  - `POST /auth/signup` — registers a new customer account
  - `POST /auth/login` — logs in and returns the Supabase JWT
  - `POST /auth/logout` — invalidates the session

---

### 2.4 — Redis Rate Limiting

- [x] Create a free Upstash Redis database at [upstash.com](https://upstash.com).
- [x] Add the `UPSTASH_REDIS_URL` to `.env`.
- [x] Install the Redis client: `pip install redis` or `pip install upstash-redis`.
- [x] Write a `rate_limit()` dependency in `middleware/rate_limit.py` that:
  - Uses the authenticated user's ID as the key.
  - Tracks how many chat messages the user has sent in the last 60 seconds.
  - Allows up to 30 messages per minute.
  - Returns a `429 Too Many Requests` response with a `Retry-After` header if the limit is exceeded.
- [x] Apply this middleware specifically to the `POST /chat/message` endpoint (Phase 3).

---

### 2.5 — Test Auth

- [x] Use the FastAPI `/docs` UI (or a tool like Postman / HTTPie) to:
  - [x] Confirm that hitting a protected route without a token returns `401`.
  - [x] Confirm that logging in returns a valid JWT.
  - [x] Confirm that using a customer token on a `/manager/` route returns `403`.
  - [x] Confirm that using a manager token on a `/manager/` route returns `200`.

---

### ✅ Phase 2 Done When:
- Protected routes reject unauthenticated requests.
- Manager routes reject customer tokens.
- The rate limiter correctly blocks and then unblocks after the window resets.

---

## Phase 3 — The AI Brain ✅

**Goal:** Build the AI ordering agent. By the end of this phase, you can send a message to the `/chat/message` endpoint, and the AI will respond using real data from the SQLite database — never making anything up.

---

### 3.1 — OpenAI Setup

- [x] Add `OPENAI_API_KEY` to `.env`.
- [x] Install the OpenAI Python library: `pip install openai`.
- [x] Create `agents/agent.py` — the main file that sets up and runs the GPT-4o-mini agent.

---

### 3.2 — The System Prompt

- [x] Write the system prompt in `agents/system_prompt.py`. This is the set of instructions given to the AI at the start of every conversation. The system prompt must clearly tell the AI:
  - Its role: *"You are a friendly ordering assistant for [Restaurant Name]."*
  - Its constraints: only use the provided tools; never guess menu items or prices.
  - Confirmation rule: always call `get_cart_summary` and show the total before calling `submit_order`.
  - Topic scope: politely decline anything unrelated to ordering, the menu, or reward points.
  - Tone: professional, warm, concise.

---

### 3.3 — Tool Definitions

- [x] Create `agents/tools.py` — define all agent tools as OpenAI function-calling schemas. Each tool needs a name, description, and a list of parameters. Build the following:

  - [x] **`get_menu_items`** — fetches all active items from `menu_items`, optionally filtered by category or dietary flag.
  - [x] **`get_item_by_name`** — looks up a single active item by name; returns its details or a "not found" signal.
  - [x] **`add_item_to_cart`** — adds a verified item and quantity to the DRAFT order in the database.
  - [x] **`remove_item_from_cart`** — removes or reduces an item in the DRAFT order.
  - [x] **`get_cart_summary`** — returns the current DRAFT order contents with a calculated grand total.
  - [x] **`clear_cart`** — empties the current DRAFT order entirely.
  - [x] **`get_reward_balance`** — sums all `points_change` values for the current customer from the `reward_points` table.
  - [x] **`redeem_reward`** — adds the free item at ₹0 to the cart and inserts a negative `reward_points` entry.
  - [x] **`submit_order`** — moves the order from `DRAFT` to `PENDING_APPROVAL` and snaps the final total.

---

### 3.4 — The Agent Loop

- [x] In `agents/agent.py`, build the agent execution loop:
  1. Receive the user's message and the full chat history.
  2. Call the OpenAI API with the system prompt, history, and tool definitions.
  3. If the model returns a tool call, execute the matching Python function (which queries the DB).
  4. Add the tool result to the conversation history and call the model again.
  5. Repeat until the model returns a plain text response with no tool calls.
  6. Return the final text response.

---

### 3.5 — Chat Route

- [x] Create `routes/chat.py` with:
  - `POST /chat/message` — accepts a message string, loads the customer's active chat session from the database, runs the agent loop, saves the updated conversation back to `chat_sessions`, and returns the AI's response.
  - `GET /chat/history/{session_id}` — returns the full message history for a given session.
- [x] Apply the `get_current_user` and `rate_limit` dependencies to `POST /chat/message`.

---

### 3.6 — Test the Agent

- [x] Use the `/docs` UI to send test messages and confirm:
  - [x] The AI lists only active menu items (not inactive ones).
  - [x] The AI refuses to add a made-up item.
  - [x] The AI correctly calculates the cart total.
  - [x] The AI refuses to submit without confirmation.
  - [x] The AI correctly checks and reports the reward point balance.
  - [x] The AI applies a reward redemption and adds the ₹0 item to the cart.

---

### ✅ Phase 3 Done When:
- The chat endpoint responds intelligently using only real database data.
- All 9 tools are working and tested manually.
- The agent never hallucinates a menu item or price.

---

## Phase 4 — Frontend Skeleton & Routing

**Goal:** Create the React app with Tailwind CSS and set up the basic page structure and navigation. No real data yet — just the shell that we'll fill in Phases 5 and 6.

---

### 4.1 — React App Setup

- [ ] Inside the `frontend/` folder, bootstrap a new React app (using Vite for speed):
  ```bash
  npm create vite@latest . -- --template react
  ```
- [ ] Install Tailwind CSS and follow the Vite setup guide to configure it.
- [ ] Install React Router for page navigation: `npm install react-router-dom`.
- [ ] Install Axios for making API calls to the backend: `npm install axios`.
- [ ] Install Recharts for the Manager Analytics charts: `npm install recharts`.
- [ ] Delete the default Vite boilerplate (`App.css`, default content in `App.jsx`).
- [ ] Add the Everforest dark theme color tokens to `tailwind.config.js` as custom colors:
  - `bg-base`: `#2D353B`
  - `bg-surface`: `#343F44`
  - `accent-green`: `#A7C080`
  - `danger-red`: `#E67E80`
  - `warning-yellow`: `#DBBC7F`
  - `text-primary`: `#D3C6AA`
  - `text-muted`: `#9DA9A0`
- [ ] Add the `Inter` font from Google Fonts to `index.html`.
- [ ] Set the default background color and font in `index.css`.

---

### 4.2 — Folder Structure

- [ ] Organize `frontend/src/` into the following sub-folders:
  ```
  src/
  ├── components/     ← Reusable UI pieces (buttons, cards, input fields)
  ├── pages/          ← Full page components (one per route)
  ├── hooks/          ← Custom React hooks (e.g., useAuth, useChat)
  ├── services/       ← Axios API call functions
  ├── context/        ← Global state (auth context, user context)
  └── assets/         ← Images, icons
  ```

---

### 4.3 — Auth Context

- [ ] Install the Supabase JavaScript client: `npm install @supabase/supabase-js`.
- [ ] Create `context/AuthContext.jsx` — a React context that:
  - Holds the logged-in user's data and JWT token.
  - Provides `login()`, `logout()`, and `signup()` functions that call the backend `/auth/` routes.
  - Wraps the entire app so any component can access the current user.
- [ ] Create a protected route wrapper component (`components/ProtectedRoute.jsx`) that redirects unauthenticated users to the login page.
- [ ] Create a manager route wrapper that redirects non-managers to the customer home page.

---

### 4.4 — Pages & Routing

- [ ] Create the following empty page components (placeholder text is fine for now):
  - `pages/LoginPage.jsx` — the login/signup form
  - `pages/CustomerChatPage.jsx` — the main customer chat interface
  - `pages/OrderStatusPage.jsx` — shows the live status of the customer's current order
  - `pages/RewardsPage.jsx` — shows the customer's point balance and history
  - `pages/ManagerDashboardPage.jsx` — the manager's pending orders queue
  - `pages/ManagerInventoryPage.jsx` — the manager's menu management interface
  - `pages/ManagerHistoryPage.jsx` — the manager's past orders log
  - `pages/ManagerAnalyticsPage.jsx` — the manager's charts and data visualization dashboard

- [ ] Wire up all routes in `App.jsx` using React Router:
  ```
  /                    → LoginPage
  /chat                → CustomerChatPage       (protected: customer)
  /order-status        → OrderStatusPage        (protected: customer)
  /rewards             → RewardsPage            (protected: customer)
  /manager             → ManagerDashboardPage   (protected: manager)
  /manager/inventory   → ManagerInventoryPage   (protected: manager)
  /manager/history     → ManagerHistoryPage     (protected: manager)
  /manager/analytics   → ManagerAnalyticsPage   (protected: manager)
  ```

---

### 4.5 — Shared Components

- [ ] Build these small, reusable components that will be used across many pages:
  - `components/Button.jsx` — a styled button with variants (primary/green, danger/red, ghost)
  - `components/StatusBadge.jsx` — a colored pill showing order status (Pending = yellow, Approved = green, Rejected = red, Cancelled = grey)
  - `components/Navbar.jsx` — a simple top navigation bar showing the current user's name and a logout button
  - `components/LoadingSpinner.jsx` — a simple animated spinner for loading states
  - `components/charts/RevenueLineChart.jsx` — a Recharts `LineChart` wrapper component (empty for now; receives data as a prop and renders the chart). Styling with Everforest accent green for the line color.
  - `components/charts/TopItemsPieChart.jsx` — a Recharts `PieChart` wrapper component (empty for now; receives data as a prop).
  - `components/charts/InventoryBarChart.jsx` — a Recharts `BarChart` wrapper component (empty for now; receives data as a prop). Low-stock bars will be rendered in warning yellow.

---

### ✅ Phase 4 Done When:
- The React app starts with `npm run dev`.
- Navigating to each route shows the correct placeholder page.
- Logging in redirects to the right page based on role.
- Logging out clears the session and returns to the login page.
- Recharts is installed and the three chart wrapper components exist (even if they show no data yet).

---

## Phase 5 — The Manager Experience

**Goal:** Build everything the manager sees and interacts with. By the end of this phase, a manager can log in, review orders, approve or reject them, and fully manage the restaurant's menu and inventory — all from the dashboard.

---

### 5.1 — Backend: Order Management Routes

- [ ] Create `routes/manager_orders.py`:
  - [ ] `GET /manager/orders/pending` — returns all orders with status `PENDING_APPROVAL`, sorted oldest first.
  - [ ] `GET /manager/orders` — returns all orders with optional filter by status (query param).
  - [ ] `POST /manager/orders/{order_id}/approve` — approves the order:
    - Sets status to `APPROVED`, records `manager_id` and `resolved_at`.
    - Calculates reward points (10–50 based on total and item count) and inserts into `reward_points`.
  - [ ] `POST /manager/orders/{order_id}/reject` — rejects the order:
    - Accepts an optional `rejection_reason` in the request body.
    - Sets status to `REJECTED`.
  - [ ] Apply the `require_manager` dependency to all routes in this file.

---

### 5.2 — Backend: Inventory & Menu Routes

- [ ] Create `routes/manager_menu.py`:
  - [ ] `GET /manager/menu` — returns all menu items, including inactive ones.
  - [ ] `POST /manager/menu` — creates a new menu item.
  - [ ] `PUT /manager/menu/{item_id}` — updates all fields of an existing menu item.
  - [ ] `PATCH /manager/menu/{item_id}/stock` — updates only the `stock_quantity` for an item. If the new quantity is 0, auto-set `is_active = false`.
  - [ ] `PATCH /manager/menu/{item_id}/toggle` — toggles `is_active` between true and false.
  - [ ] `DELETE /manager/menu/{item_id}` — soft-deletes by setting `is_active = false`. Hard delete only if the item has never been ordered.
  - [ ] Apply the `require_manager` dependency to all routes in this file.

---

### 5.3 — Frontend: Manager Dashboard Page

- [ ] In `ManagerDashboardPage.jsx`, fetch from `GET /manager/orders/pending` on load and every 10 seconds (polling).
- [ ] Display each pending order as a card containing:
  - Customer name and order ID
  - A list of ordered items with quantities and prices
  - The grand total
  - How long ago the order was placed (e.g., "3 minutes ago")
  - **Approve** (green) and **Reject** (red) buttons
- [ ] **Approve flow:** Clicking Approve calls `POST /manager/orders/{id}/approve`, then removes the card from the list.
- [ ] **Reject flow:** Clicking Reject opens a small inline form asking for an optional rejection reason. Submitting calls `POST /manager/orders/{id}/reject` with the reason, then removes the card.
- [ ] Show a friendly empty state message when there are no pending orders: *"All caught up! No orders waiting."*

---

### 5.4 — Frontend: Manager Inventory Page

- [ ] In `ManagerInventoryPage.jsx`, fetch from `GET /manager/menu` on load.
- [ ] Display items in a clean table with columns: Name, Category, Price, Stock, Status (Active/Inactive), Actions.
- [ ] **Add Item:** A button opens a form (modal or inline panel) to create a new menu item with all fields. Submits to `POST /manager/menu`.
- [ ] **Edit Item:** An edit icon on each row opens the same form pre-filled with the item's current data. Submits to `PUT /manager/menu/{id}`.
- [ ] **Update Stock:** A quick-edit field directly in the stock column that submits to `PATCH /manager/menu/{id}/stock` on blur or Enter.
- [ ] **Toggle Active:** A toggle switch in the Status column that calls `PATCH /manager/menu/{id}/toggle`.
- [ ] **Delete:** A delete icon with a confirmation dialog before calling `DELETE /manager/menu/{id}`.
- [ ] Highlight rows where `stock_quantity` is 0 or very low (e.g., ≤ 5) with a warning color.

---

### 5.5 — Frontend: Manager History Page

- [ ] In `ManagerHistoryPage.jsx`, fetch from `GET /manager/orders` on load.
- [ ] Show a filterable table of all orders with columns: Order ID, Customer, Items (collapsed), Total, Status badge, Date.
- [ ] Add filter buttons at the top: All / Approved / Rejected / Cancelled.
- [ ] Clicking a row expands it to show the full item list and the rejection reason (if applicable).

---

### 5.6 — Backend: Analytics Aggregation Routes

All chart data must be pre-calculated by the backend before being sent to the frontend. Create `routes/manager_analytics.py`:

- [ ] `GET /manager/analytics/revenue` — calculates total revenue per day for the past 30 days.
  - Query: join `orders` where `status = 'APPROVED'`, group by the date portion of `submitted_at`, sum `total_amount` per group.
  - Return format: `[{ "date": "2026-07-10", "revenue": 4820.00 }, ...]`
  - Accept an optional query parameter `?period=7d|30d|90d` to control the date range.

- [ ] `GET /manager/analytics/top-items` — finds the most-ordered menu items.
  - Query: join `order_items` with `orders` (where `status = 'APPROVED'`) and `menu_items`, group by `menu_item_id`, sum `quantity` per group, sort descending, return the top 10.
  - Return format: `[{ "item_name": "Chicken Wings", "total_ordered": 142 }, ...]`

- [ ] `GET /manager/analytics/inventory` — returns live stock levels for all active menu items.
  - Query: select `name` and `stock_quantity` from `menu_items` where `is_active = true`, ordered by `stock_quantity` ascending so low-stock items appear first.
  - Flag any item with `stock_quantity <= 5` as `"is_low_stock": true`.
  - Return format: `[{ "item_name": "Garlic Bread", "stock_quantity": 3, "is_low_stock": true }, ...]`

- [ ] Apply the `require_manager` dependency to all three analytics routes.
- [ ] Test each endpoint directly via the `/docs` UI and confirm the numbers match what you can count manually in the database.

---

### 5.7 — Frontend: Manager Analytics Dashboard Page

- [ ] In `ManagerAnalyticsPage.jsx`, build the analytics dashboard:
  - Fetch data from all three analytics endpoints on page load using `Promise.all()` (so all three charts load at the same time instead of one by one).
  - Show a `LoadingSpinner` while data is being fetched.
  - Layout: a 2-column grid on desktop (revenue chart full-width on top, pie and bar charts side-by-side below), single column on mobile.

- [ ] **Revenue Line Chart** — wire up `RevenueLineChart.jsx` with the data from `GET /manager/analytics/revenue`:
  - X-axis: dates. Y-axis: revenue in currency.
  - Line color: Everforest `accent-green` (`#A7C080`).
  - Add a tooltip showing the exact revenue when hovering over a data point.
  - Add period toggle buttons above the chart: **7 Days / 30 Days / 90 Days**. Clicking re-fetches with the appropriate `?period=` query parameter.

- [ ] **Top-Selling Items Pie Chart** — wire up `TopItemsPieChart.jsx` with data from `GET /manager/analytics/top-items`:
  - Each slice represents one menu item. Label each slice with the item name and percentage.
  - Use Everforest palette colors for the slices (cycle through greens and teals).
  - Add a legend below the chart.

- [ ] **Inventory Bar Chart** — wire up `InventoryBarChart.jsx` with data from `GET /manager/analytics/inventory`:
  - X-axis: item names. Y-axis: stock quantity.
  - Default bar color: Everforest `accent-green`.
  - Bars where `is_low_stock = true` must render in Everforest `warning-yellow` (`#DBBC7F`) to visually flag them.
  - Add a dashed horizontal reference line at `stock_quantity = 5` labeled "Low Stock Threshold".

---

### ✅ Phase 5 Done When:
- A manager can log in and see all pending orders in real time.
- Approving an order updates its status and awards reward points.
- Rejecting an order stores the rejection reason.
- A manager can add, edit, update stock, toggle, and delete menu items from the UI.
- All three analytics endpoints return correct, pre-aggregated JSON data.
- The Analytics Dashboard page renders all three charts with real data from the database.

---

## Phase 6 — The Customer Experience

**Goal:** Build the full customer-facing interface. By the end of this phase, a customer can log in, chat with the AI to place an order, track its status, redeem reward points, and modify their order even after submission.

---

### 6.1 — Backend: Customer Order Routes

- [ ] Create `routes/customer_orders.py`:
  - [ ] `GET /orders/me` — returns the current customer's order history.
  - [ ] `GET /orders/{order_id}` — returns the full details of a specific order (customer must own it).
  - [ ] `GET /orders/{order_id}/status` — lightweight endpoint that returns just the current status (used for polling).
  - [ ] `POST /orders/{order_id}/cancel` — cancels the order if it is in `DRAFT` or `PENDING_APPROVAL` status. Returns a `409` error for any other status.
  - [ ] `POST /orders/{order_id}/modify` — the stock restoration and re-approval flow (Rule A-7):
    1. Validate the order is not `REJECTED` or `CANCELLED`.
    2. Restore stock for all current `order_items`.
    3. Validate and deduct stock for the new items.
    4. Replace `order_items`, recalculate total.
    5. If the order was `APPROVED`, reset it to `PENDING_APPROVAL` and reverse any awarded points.
  - [ ] Apply `get_current_user` to all routes.

---

### 6.2 — Backend: Rewards Routes

- [ ] Create `routes/rewards.py`:
  - [ ] `GET /rewards/balance` — returns the customer's current point balance (sum of all `points_change` values).
  - [ ] `GET /rewards/history` — returns a list of all reward transactions for the customer (earned and redeemed entries).

---

### 6.3 — Frontend: Customer Chat Page

- [ ] In `CustomerChatPage.jsx`, build the main chat interface:
  - A scrollable message list showing alternating customer (right-aligned, green tint) and AI (left-aligned, surface color) bubbles.
  - A text input bar at the bottom with a Send button.
  - Timestamps displayed under each message bubble.
  - A loading indicator (typing dots animation) while waiting for the AI to respond.
  - On send, call `POST /chat/message` and append both the user's message and the AI's response to the list.
  - If a `429` error is returned, show a banner: *"Slow down! Please wait [X] seconds."*
- [ ] Display a live **Order Summary Panel** (sidebar on desktop, collapsible drawer on mobile) showing the current cart items and running total, fetched from `GET /cart/summary` or derived from the latest AI response.

---

### 6.4 — Frontend: Order Status Page

- [ ] In `OrderStatusPage.jsx`:
  - Display the current order's status using the `StatusBadge` component.
  - Show the full item list and grand total.
  - Poll `GET /orders/{order_id}/status` every 5 seconds and update the badge automatically.
  - When status changes to `APPROVED`, show a celebration message and the reward points earned.
  - When status changes to `REJECTED`, show the rejection reason from the manager.
  - Show a **Cancel Order** button if the status is `PENDING_APPROVAL`. Hide it once the order is resolved.
  - Show a **Modify Order** button that takes the customer back to the chat screen with the existing order context loaded.

---

### 6.5 — Frontend: Rewards Page

- [ ] In `RewardsPage.jsx`:
  - Display the customer's current point balance prominently (large number, accent green color).
  - List all available rewards and their point costs (e.g., "Free Lemonade — 100 points").
  - Show a transaction history table: Date, Description (earned/redeemed), Points Change.
  - Positive rows in green, negative rows in red/muted.

---

### 6.6 — Order Modification Flow

- [ ] When the customer clicks **Modify Order** on `OrderStatusPage.jsx`:
  - Navigate back to `CustomerChatPage.jsx` with the existing order ID passed as context.
  - The AI chat loads with the existing order items in the cart and a message like: *"I've loaded your existing order. What would you like to change?"*
  - After the customer makes changes and confirms, the frontend calls `POST /orders/{order_id}/modify` with the updated item list.
  - The order status page updates to show the order is pending approval again.

---

### ✅ Phase 6 Done When:
- A customer can have a full conversation with the AI and place an order.
- The order status updates live when the manager approves or rejects.
- Reward points are shown correctly and redeemable via the AI.
- Order modification triggers stock restoration and manager re-approval.
- The Cancel Order button works.

---

## Phase 7 — Polish & Deployment

**Goal:** Make the app feel finished and portfolio-ready. By the end of this phase, the project is visually polished, tested end-to-end, and ready to show to anyone.

---

### 7.1 — End-to-End Testing

- [ ] Walk through the complete customer flow manually:
  - Sign up → Chat → Build cart → Redeem points → Confirm order → Check status → See approval → See points awarded.
- [ ] Walk through the complete manager flow manually:
  - Log in → See pending order → Approve → Reject (with reason) → Manage menu (add/edit/stock/toggle/delete).
- [ ] Test the order modification flow:
  - Place and approve an order → Modify it → Confirm the status resets to Pending → Manager re-approves → Points re-awarded.
- [ ] Test error states:
  - Try to order an out-of-stock item — confirm the AI refuses.
  - Hit the rate limit — confirm the `429` message appears.
  - Try to access the manager dashboard as a customer — confirm redirect.

---

### 7.2 — UI Polish

- [ ] Review all pages on both a desktop (1280px) and mobile (375px) viewport. Fix any layout issues.
- [ ] Add smooth CSS transitions to all interactive elements (buttons, status badge changes, card appearances).
- [ ] Add a subtle fade-in animation to new chat messages as they appear.
- [ ] Add a "skeleton loading" placeholder to the Manager Dashboard while orders are being fetched.
- [ ] Review all error messages in the UI — confirm they are friendly and clear (no raw JSON or error codes shown).
- [ ] Check color contrast on all text to ensure readability against the dark Everforest background.

---

### 7.3 — Code Clean-up

- [ ] Remove all `print()` debug statements from the backend. Replace with structured logging using Python's `logging` module.
- [ ] Remove all `console.log()` debug statements from the frontend.
- [ ] Review all `.env` variables — confirm none are hardcoded anywhere in the source files.
- [ ] Write a docstring comment for every backend route explaining what it does, what it expects, and what it returns.
- [ ] Ensure consistent code formatting (use `black` for Python, `prettier` for JavaScript).

---

### 7.4 — README

- [ ] Write a `README.md` in the project root. It must include:
  - A one-paragraph project description.
  - A screenshot or short screen recording of the chat UI and manager dashboard.
  - A list of every technology used and why it was chosen.
  - Step-by-step setup instructions so anyone can clone and run the project locally.
  - A link to the `About/` folder for full documentation.

---

### 7.5 — Portfolio Preparation

- [ ] Record a 3–5 minute demo video showing the full order flow from customer chat to manager approval. Narrate what is happening at each step and why design decisions were made.
- [ ] Prepare a short "talking points" list for portfolio reviews:
  - What is the HITL pattern and why does it matter?
  - How does the AI stay honest? (Tool-calling architecture, no hallucination)
  - How does the stock restoration logic work?
  - How are reward points calculated and why is the ledger approach used instead of a single balance column?
- [ ] Push the final, clean commit to GitHub with a meaningful commit message.
- [ ] (Optional) Deploy the backend to a free service like Railway or Render, and the frontend to Vercel or Netlify, so the project is live and linkable.

---

### ✅ Phase 7 Done When:
- The complete end-to-end flow works without any errors.
- The app looks polished on both desktop and mobile.
- The README is clear enough for a stranger to set up and run the project.
- A demo video or live link is ready for portfolio sharing.

---

## Summary

| Phase | Focus | Key Outcome |
|---|---|---|
| **Phase 1** ✅ | Foundation & Database | FastAPI running, all 6 DB tables created, seed data loaded |
| **Phase 2** ✅ | Authentication & Security | Supabase auth working, role guards enforced, rate limiter active |
| **Phase 3** ✅ | The AI Brain | GPT-4o-mini agent responding with real menu data, all 9 tools working |
| **Phase 4** | Frontend Skeleton | React app with routing, Everforest theme, auth flow, placeholder pages |
| **Phase 5** | Manager Experience | Full dashboard: approve/reject orders, manage inventory & stock |
| **Phase 6** | Customer Experience | Chat UI, order status, rewards, modification with stock restoration |
| **Phase 7** | Polish & Deployment | End-to-end tested, UI polished, README written, portfolio ready |

---

*End of PHASES.md v1.1 — Updated July 2026: Phases 1, 2 & 3 marked complete.*
