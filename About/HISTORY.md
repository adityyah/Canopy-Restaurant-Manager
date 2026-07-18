# HISTORY.md — Project History & Status
### *AI-Powered Restaurant Ordering System — Capstone Project*

**File Location:** `About/HISTORY.md`

**Last Updated:** July 2026

**Status:** Active — Phase 0 Complete → Phase 1 Starting

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

### Phase: **0 — Planning & Documentation Complete**
### Next Phase: **1 — Foundation & Database** *(not yet started)*

```
[x] Phase 0 — Planning & Documentation
[ ] Phase 1 — Foundation & Database
[ ] Phase 2 — Authentication & Security
[ ] Phase 3 — The AI Brain
[ ] Phase 4 — Frontend Skeleton & Routing
[ ] Phase 5 — The Manager Experience
[ ] Phase 6 — The Customer Experience
[ ] Phase 7 — Polish & Deployment
```

**As of this writing:** The entire project has been planned in detail. All documentation files have been written and are stored in the `About/` folder. No production code has been written yet. The project is ready to begin Phase 1.

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

---

## 4. Next Immediate Steps

These are the very first coding tasks to execute when starting Phase 1. Complete them in order.

**Step 1 — Initialize the Repository**
- Create the project root folder (if not already done).
- Run `git init` and create an initial commit with just the `About/` documentation folder.
- Create a `.gitignore` file and add: `.env`, `__pycache__/`, `*.db`, `node_modules/`, `dist/`.

**Step 2 — Set Up the Backend Skeleton**
- Create the `backend/` directory.
- Set up a Python virtual environment inside `backend/`: `python -m venv venv`
- Install core dependencies: `fastapi uvicorn sqlalchemy python-dotenv pydantic`
- Create `backend/app/main.py` with a minimal FastAPI app and a health check route (`GET /health`).
- Confirm the server starts: `uvicorn app.main:app --reload`

**Step 3 — Set Up the Database Models**
- Create `backend/app/database.py` to configure the SQLAlchemy engine pointing to `restaurant.db`.
- Create the `backend/app/models/` directory.
- Write all 6 SQLAlchemy models: `user.py`, `menu_item.py`, `order.py`, `order_item.py`, `reward_point.py`, `chat_session.py`.
- Call `Base.metadata.create_all()` on startup and verify all tables are created.

**Step 4 — Seed the Database**
- Write `backend/seed.py` with at least 12 menu items across 4 categories.
- Run the seed script and confirm data appears in the `restaurant.db` file.

> For full task details for each step, see `About/PHASES.md` → Phase 1.

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

---

*End of HISTORY.md — Update this file whenever the project status changes.*
