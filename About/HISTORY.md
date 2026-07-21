# HISTORY.md — Project History & Status
### *AI-Powered Restaurant Ordering System — Capstone Project*

**File Location:** `About/HISTORY.md`

**Last Updated:** July 2026

**Status:** Active — Phase 5 Complete → Phase 6 Starting (Manager Dashboard)

---

> **📌 Purpose of this file:** This document is the **living memory** of the project. If you are an AI assistant, a collaborator, or the developer returning after a break, read this file first. It tells you exactly what this project is, what has been decided, what has been built, and what needs to happen next. Do not begin any coding work without reading this file and the documents in the `About/` folder.

---

## Table of Contents

1. [Project Identity](#1-project-identity)
2. [Current Status](#2-current-status)
3. [Completed Milestones](#3-completed-milestones)
4. [Next Immediate Steps](#4-next-immediate-steps)
5. [Change Log](#5-change-log)

---

## 1. Project Identity

### Project Name
**AI-Powered Restaurant Ordering System** *(Capstone Portfolio Project)*

### One-Line Summary
A full-stack web application where customers chat with an AI agent to place food orders, and a human manager must approve every order before it is confirmed — with built-in reward points, inventory management, and data analytics.

### Core Mechanic
```
Customer chats with AI  →  AI builds order using real menu data  →  Manager approves/rejects  →  Order confirmed
```

The defining feature is the **Human-in-the-Loop (HITL)** pattern: no order ever bypasses the manager. Every submitted order sits in a queue until a human reviews it.

### Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18 + Tailwind CSS | Customer chat UI and Manager Dashboard |
| **Charts** | Recharts | Revenue, top-items, and inventory visualizations |
| **Backend** | FastAPI (Python) | REST API, business logic, HITL flow enforcement |
| **Database** | SQLite + SQLAlchemy ORM | All persistent data (menu, orders, rewards, users) |
| **Authentication** | Supabase | User login, JWT issuance, role-based access control |
| **Rate Limiting** | Redis / Upstash | Throttle AI chat endpoint to 30 messages/minute |
| **AI Agent** | GPT-4o-mini (OpenAI API) | Tool-calling agent — reads live menu, manages cart, handles rewards |

### Key Architectural Decisions (already locked in)
- The AI agent is **strictly tool-constrained** — it cannot hallucinate menu items or prices. All data comes from live SQLite queries via defined tool functions.
- The backend **owns all data aggregation** — chart data is pre-calculated on the server and sent as clean JSON to the frontend.
- **Stock is restored** when a customer modifies a submitted or approved order — old quantities go back into inventory before new quantities are deducted, and the order resets to `PENDING_APPROVAL`.
- **Reward points** are calculated as a value between 10–50 per approved order (based on total price and item count) and stored as a ledger of transactions, not a single balance column.
- The **Everforest dark theme** (nature-inspired greens and warm neutrals) governs all visual decisions. Full details in `About/DESIGN.md`.

---

## 2. Current Status

### Phase: **3 — The AI Brain Complete**
### Next Phase: **4 — Frontend Skeleton & Routing** *(starting now)*

```
[x] Phase 0 — Planning & Documentation
[x] Phase 1 — Foundation & Database
[x] Phase 2 — Authentication & Security
[x] Phase 3 — The AI Brain
[x] Phase 3.5 — Daily Delights & AI Insights (Backend Expansion)
[x] Phase 4 — Frontend Skeleton & Routing
[x] Phase 5 — Customer Terminal & AI Chat UI
[ ] Phase 6 — The Manager Dashboard
[ ] Phase 7 — Polish & Deployment
```

**As of this writing:** The Customer Terminal is fully built. Customers land on a premium Everforest-themed page with a Playfair Display hero, a menu grid with category tabs and daily delight ribbons, and a sticky AI chat panel. The chat sends messages to the LangGraph backend via POST /chat/message, renders HITL approval banners when the agent is interrupted, handles rate-limit countdowns, and injects menu card selections directly into the chat input. Phase 6 (Manager Dashboard) begins next.

---

## 3. Completed Milestones

### Milestone 0.1 — Core Documentation Suite Written ✅

The following documents have been finalized and stored in `About/`:

| File | Purpose | Status |
|---|---|---|
| `About/PRD.md` | Product Requirements Document — defines all features, personas, out-of-scope items, and success metrics | ✅ v3.0 Final |
| `About/ARCHITECTURE.md` | Architecture document — system overview, tech stack breakdown, database schema, data flow | ✅ v1.0 Final |
| `About/RULES.md` | Development rules — AI guardrails, error handling standards, data integrity rules | ✅ v2.0 Final |
| `About/PHASES.md` | Project phases — 7 phases with detailed task checklists | ✅ v1.0 Final |
| `About/DESIGN.md` | Design system — color palette, typography, component specs, chart styling | ✅ v1.0 Final |
| `About/HISTORY.md` | This file — project memory and status tracker | ✅ Active |

### Milestone 0.2 — Key Scope Decisions Locked In ✅

The following features were added or adjusted during the planning phase and are now confirmed as in-scope:

- **Rewards & Loyalty System** — promoted from "Out of Scope" to core feature. Dynamic 10–50 points per order, AI-driven redemption, ledger-based balance tracking.
- **Inventory Management UI** — promoted from "Out of Scope" to core manager feature. Full CRUD with stock quantity control and auto-deactivation at zero stock.
- **Order Modification with Stock Restoration** — Rule A-7 updated. Customers can modify submitted or approved orders; backend restores stock and resets manager approval.
- **Analytics Dashboard** — added as manager feature F-M7. Three Recharts charts (revenue line, top-items pie, inventory bar), all data pre-aggregated by the backend.

### Milestone 0.3 — Reference Files Acknowledged ✅

The project directory may contain original Python assignment files from a previous iteration of this project. These files are **reference only** and are not part of the new build. The new application is being built from scratch using the React + FastAPI architecture defined in this documentation.

### Milestone 1.0 — Full FastAPI Backend Complete ✅

The entire Python/FastAPI backend is built and operational across three completed phases:

**Phase 1 — Foundation & Database:**
- Multi-file FastAPI app (`app/main.py`, `app/database.py`) running on Uvicorn.
- Six SQLAlchemy models created: `users`, `menu_items`, `orders`, `order_items`, `reward_points`, `chat_sessions`.
- Critical database constraints in place: `CHECK (stock_quantity >= 0)`, `CHECK (role IN ('customer','manager'))`, foreign key enforcement via `PRAGMA foreign_keys=ON`.
- WAL mode enabled on SQLite for improved concurrency.
- `seed.py` script loads 16 menu items across 4 categories (Starters, Mains, Desserts, Beverages) with varied dietary flags and stock levels.

**Phase 2 — Authentication & Security:**
- `middleware/auth.py`: `get_current_user()` verifies Supabase JWTs via PyJWKClient (JWKS endpoint); `require_manager()` enforces role-based access control (403 on failure). `CurrentUser` and `ManagerUser` type aliases for clean route signatures.
- `middleware/rate_limit.py`: Upstash Redis FixedWindow rate limiter (30 req/60s per user UUID). Returns 429 with `Retry-After` header per RULES.md § E-3. Fail-open design on Redis outage.
- `routes/auth.py`: `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`. Signup auto-creates a local `users` row. Login failures return a generic 401 per RULES.md § E-4.
- Global 500 exception handler in `main.py` per RULES.md § E-1: all unhandled errors return structured `{"error": true, "code": "INTERNAL_ERROR", ...}`.

**Phase 3 — The AI Brain:**
- `agents/tools.py`: 9 pure tool functions (adapted from original assignment + 2 new reward tools). Tools use `with_for_update()` locking on critical stock operations. `unit_price` is snapshotted at add-to-cart time per RULES.md § D-5. `redeem_reward()` is fully atomic (cart add + negative ledger entry in one transaction).
- `agents/system_prompt.py`: Detailed system prompt encoding all 7 AI guardrails (A-1 through A-7) with concrete examples.
- `agents/agent.py`: LangGraph StateGraph with 4 nodes (`agent_node`, `tool_node`, `manager_review_node`, routing edges). MemorySaver checkpointing with `thread_id = customer_id`. `interrupt()` in `manager_review_node` implements the HITL pause. `run_agent()` and `get_conversation_history()` are the public API.
- `routes/chat.py`: `POST /chat/message` (rate-limited + JWT-protected), `GET /chat/history`.

### Milestone 1.1 — Phase 3.5: Daily Delights & AI Insights ✅

**Daily Delight feature:**
- Added `is_daily_delight` boolean column to `MenuItem` model (default `False`, indexed).
- Seed script updated: `Fresh Lime Soda` (stock=100, highest active item) seeded as the default Daily Delight.
- `POST /manager/menu/auto-delight`: atomic bulk-reset + single-item assignment in one transaction. Always picks the active item with the highest `stock_quantity`. Returns the chosen item with a confirmation message.
- System prompt updated: AI is instructed to call `get_menu_items()` at the start of every conversation, identify the Daily Delight item, and include a warm recommendation in the opening greeting.

**AI Insights feature:**
- `GET /manager/insights`: gathers two DB facts (items with `stock_quantity < 5`, count of `PENDING_APPROVAL` orders) and passes them to GPT-4o-mini via a tightly constrained prompt. Returns a 2-sentence managerial advisory *plus* the raw structured data so the frontend can render both.
- Graceful degradation: if the OpenAI call fails, a structured fallback message is returned (no 500 error).

**Infrastructure:**
- `app/routes/manager.py` created as the Phase 3.5 manager utility router.
- Mounted at `/manager` prefix in `main.py` (Phase 3.5 section, separate from the Phase 5 manager routes planned later).

### Milestone 2.0 — Phase 4: Frontend Skeleton & Routing ✅

**Project scaffold:**
- `Frontend/` directory initialised with Vite + React 18 + TypeScript.
- All dependencies installed: `react-router-dom`, `axios`, `recharts`, `@supabase/supabase-js`, `tailwindcss`, `postcss`, `autoprefixer`.

**Tailwind & Design System:**
- `tailwind.config.js`: full Everforest palette (4 backgrounds, 3 text, 5 accents) as named tokens.
- Custom animations: `fade-in`, `dot-bounce`, `skeleton-pulse`.
- `src/index.css`: `@layer components` with `.card`, `.btn-primary/danger/ghost`, 5 `.badge-*` variants, `.input`, `.skeleton`, `.page-container`.
- `index.html`: Inter + JetBrains Mono from Google Fonts.

**Axios Client (`src/api/client.ts`):**
- Single instance at `/api` (proxied to `:8000` by Vite).
- Request interceptor attaches `canopy_jwt` from localStorage as Bearer token.
- Response interceptor translates 9 error codes → user-friendly messages (RULES.md § E-5).
- Dispatches `canopy:session-expired` on 401; typed `api.get/post/put/patch/delete` wrappers.

**Auth Context (`src/context/AuthContext.tsx`):**
- Session restore from localStorage on mount. `login/signup/logout` functions managing `canopy_jwt` + `canopy_user`.

**Routing (`src/App.tsx`):**
- All 8 routes from PHASES.md § 4.4 with correct `ProtectedRoute` guards.
- `HealthCheck` overlay in bottom-right corner (dev mode only).

**Shared Components:** `LoadingSpinner`, `StatusBadge`, `Navbar`, `ProtectedRoute`, `HealthCheck`.
**Chart Components:** `RevenueLineChart`, `TopItemsPieChart`, `InventoryBarChart` (all fully styled).
**8 Page Stubs:** All named and routing correctly.

### Milestone 2.1 — Phase 5: Customer Terminal & AI Chat UI ✅

**Typography update:**
- `index.html`: Added Playfair Display 600/700 to Google Fonts import alongside Inter and JetBrains Mono (DESIGN.md § 3.1).
- `tailwind.config.js`: Added `font-display` family token (`['Playfair Display', 'Georgia', 'serif']`).
- `index.css`: Explicit `h1, .display-heading { font-family: Playfair Display }` rule per DESIGN.md § 3.1.

**`components/customer/ChatInterface.tsx` (new):**
- Manages full message history in local state (user + assistant turns).
- Sends `POST /chat/message` via the Axios client; renders optimistic user bubble immediately.
- Customer bubbles: right-aligned, `rgba(167,192,128,0.13)` faint green tint, `border-radius: 16px 16px 4px 16px`.
- AI bubbles: left-aligned, `bg-surface` background, `border-radius: 16px 16px 16px 4px`.
- Three-dot `LoadingSpinner` typing indicator while awaiting AI response.
- **HITL interrupt banner:** When the backend returns `interrupted: true`, renders an inline `ApprovalBanner` directly below the triggering AI message, using warning-yellow palette.
- **Rate-limit countdown:** On 429, reads `Retry-After` header and shows a live countdown banner; restores the user's unsent message.
- Auto-scrolls to the latest message on every update.
- `injectedMessage` prop: pre-fills the textarea when the user clicks a menu card.
- Textarea: Enter to send, Shift+Enter for newline.

**`components/customer/MenuDisplay.tsx` (new):**
- Fetches `GET /menu` on mount, shows 6 skeleton cards while loading.
- Category filter tabs (All / Starters / Mains / Desserts / Beverages) derived from live data.
- Daily Delight ribbon: `★ TODAY'S DELIGHT` badge on the card's top-right corner.
- Dietary badges: Vegan (accent-green), Veg (accent-teal), Spicy 🌶 (danger-red).
- Low-stock warning (< 5 units): warning-yellow left border accent + "Only X left" text.
- Out-of-stock cards: 55% opacity, "Out of stock" label instead of Add button.
- `onAddToOrder` prop: passes `"I would like to order one [Name]"` string up to parent.
- Sorts items: Daily Delight first, then alphabetical.

**`pages/CustomerTerminal.tsx` (new):**
- Full-page layout composing Navbar + Hero + MenuDisplay + ChatInterface.
- Hero section: radial gradient background, Playfair Display `h1` with italic `Great Mood.`, feature pills.
- Desktop: 60% menu (scrollable) / 40% chat (sticky `top-6`, fixed viewport height).
- Mobile: chat on top (full-width, above fold), menu below.
- `injectedMessage` state bridges MenuDisplay `onAddToOrder` → ChatInterface prop.
- `App.tsx` `/chat` route updated to render `CustomerTerminal`.

---

## 4. Next Immediate Steps

**Step 1 — Backend: Order Management Routes**
- Create `routes/manager_orders.py` with `GET /manager/orders/pending`, `GET /manager/orders`, `POST /manager/orders/{id}/approve` (with reward points calc), `POST /manager/orders/{id}/reject` (with optional reason).
- All routes protected by `require_manager`. Approve: atomic status + reward insert in one transaction (RULES.md § D-4).

**Step 2 — Backend: Menu & Inventory Routes**
- Create `routes/manager_menu.py` with full CRUD: `GET`, `POST`, `PUT`, `PATCH /stock`, `PATCH /toggle`, `DELETE` (soft-delete per RULES.md § D-6).

**Step 3 — Backend: Analytics Routes**
- Create `routes/manager_analytics.py`: revenue by day (last 30/7/90d), top-items, inventory snapshot.
- All aggregation server-side (RULES.md § D-7). Never send raw order dumps to the frontend.

**Step 4 — Frontend: Manager Dashboard**
- `ManagerDashboardPage`: 10-second polling of pending orders, Approve/Reject card actions.
- `ManagerInventoryPage`: sortable table with inline stock edit, toggle switch, CRUD modals.
- `ManagerHistoryPage`: filterable all-orders table with expandable rows.
- `ManagerAnalyticsPage`: all three Recharts charts wired to live data with period toggle.

> For full task details, see `About/PHASES.md` → Phase 6.

---

## 5. Change Log

This table tracks every significant change made to the project — scope additions, rule changes, architectural decisions, and milestone completions. Update this table every time something meaningful changes.

| Date | Change | Author |
|---|---|---|
| July 2026 | Initial documentation suite created: PRD v1.0, ARCHITECTURE v1.0, RULES v1.0, PHASES v1.0 | Aditya |
| July 2026 | PRD updated to v2.0: Added Rewards/Loyalty System (F-C8) and Inventory Management (F-M6) as core features; removed both from Out of Scope | Aditya |
| July 2026 | RULES updated: Rule A-7 replaced — customers may now modify submitted/approved orders with stock restoration and mandatory re-approval | Aditya |
| July 2026 | Analytics feature added: PRD updated to v3.0 (F-M7), ARCHITECTURE updated (Recharts section 2.7, analytics routers), RULES updated (Rule D-7), PHASES updated (sections 5.6, 5.7) | Aditya |
| July 2026 | DESIGN.md created: Full Everforest design system documented including color palette, typography, component specs, and Recharts chart styling | Aditya |
| July 2026 | HISTORY.md created: Project memory file initialized at Phase 0 complete | Aditya |
| July 2026 | **Phase 1 complete:** FastAPI server, SQLAlchemy engine (WAL + FK pragmas), all 6 ORM models with constraints, seed.py (16 items / 4 categories). Backend directory: `Backend/app/` | Aditya |
| July 2026 | **Phase 2 complete:** Supabase JWKS JWT verification (`middleware/auth.py`), role guard (`require_manager`), Upstash Redis rate limiter with `Retry-After` header (`middleware/rate_limit.py`), auth proxy routes (`routes/auth.py`), global 500 exception handler in `main.py` | Aditya |
| July 2026 | **Phase 3 complete:** LangGraph StateGraph agent (4 nodes, MemorySaver, `interrupt()` HITL), all 9 tools with `with_for_update()` locking and price snapshots, system prompt encoding Rules A-1–A-7, chat routes `POST /chat/message` + `GET /chat/history` | Aditya |
| July 2026 | **Phase 3.5 complete:** `is_daily_delight` column added to `MenuItem`; `POST /manager/menu/auto-delight` (atomic highest-stock picker); `GET /manager/insights` (GPT-4o-mini inventory briefing with graceful fallback); system prompt updated with Daily Delight greeting instruction; `routes/manager.py` mounted at `/manager` | Aditya |
| July 2026 | **Phase 4 complete:** Vite + React 18 + TypeScript frontend initialised in `Frontend/`; Tailwind CSS with full Everforest palette; React Router 6 with all 8 routes + ProtectedRoute guards; Axios client with JWT interceptor + error code translation (RULES.md § E-5); AuthContext with localStorage session restore; HealthCheck component confirms live backend connection; all 5 shared components + 3 Recharts chart wrappers + 8 page stubs created | Aditya |
| July 2026 | **Phase 5 complete:** Customer Terminal fully built. `ChatInterface.tsx` — message history, HITL interrupt banner (warning-yellow), rate-limit countdown, injectedMessage prop, typing indicator. `MenuDisplay.tsx` — category tabs, Daily Delight ribbon, dietary badges, low-stock warning, skeleton loaders. `CustomerTerminal.tsx` — Playfair Display hero, 60/40 responsive layout, sticky chat panel. Playfair Display added to fonts and Tailwind config. | Aditya |

---

*End of HISTORY.md — Update this file whenever the project status changes.*
