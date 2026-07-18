# PRD — AI-Powered Restaurant Ordering System
### *Capstone Portfolio Project*

**File Location:** `About/PRD.md`

**Last Updated:** July 2026

**Status:** Draft v2.0

---

## Table of Contents

1. [Project Overview & Goal](#1-project-overview--goal)
2. [Target User Personas](#2-target-user-personas)
3. [Core Features](#3-core-features)
4. [Out of Scope](#4-out-of-scope)
5. [Success Metrics](#5-success-metrics)

---

## 1. Project Overview & Goal

### What is this project?

This is an **AI-powered restaurant ordering system** — a web application where customers can walk up to a digital interface (or open it on their phone/laptop), have a natural conversation with an AI assistant to browse the menu and place an order, and then have that order reviewed and approved by a real human manager before it is confirmed.

Think of it like chatting with a knowledgeable waiter who never gets an order wrong, but still has a human supervisor double-checking everything before the kitchen fires up the stove.

### The Core Idea

```
Customer chats with AI  →  AI builds the order  →  Manager reviews & approves  →  Order is confirmed
```

The unique part of this system is the **Human-in-the-Loop (HITL)** flow. Rather than immediately sending an order straight to the kitchen after the AI confirms it, the order first lands on a **Manager Dashboard** for a human to approve or reject. This adds a layer of accountability and control — a smart safeguard for the restaurant.

### Why are we building this?

- To demonstrate a real-world, practical use of an **AI agent** with strict guardrails in a business context.
- To showcase a full-stack portfolio project covering frontend, backend, database, authentication, and AI integration.
- To explore the **Human-in-the-Loop** design pattern — an increasingly important concept in responsible AI deployment.

### Tech Stack at a Glance

| Layer | Technology |
|---|---|
| **Frontend** | React + Tailwind CSS |
| **Charts** | Recharts (React charting library) |
| **Backend** | FastAPI (Python) |
| **Database** | SQLite via SQLAlchemy ORM |
| **Authentication** | Supabase |
| **Rate Limiting** | Redis / Upstash |
| **AI Model** | GPT-4o-mini (via OpenAI API) |

### Design Language

The UI follows a **simple dark theme** with a **minimalist layout**, using an **Everforest / nature-inspired green color palette**. The goal is a calm, clean, and readable interface — like a cozy restaurant that takes pride in simplicity over flash.

---

## 2. Target User Personas

There are two main types of people who will use this system.

---

### Persona A — The Customer (Alex)

> *"I just want to order my food quickly without waiting for a waiter."*

**Who they are:**
Alex is a dine-in or takeaway customer at the restaurant. They are comfortable using apps on their phone or laptop, but they are **not** technically savvy. They expect things to "just work."

**What they want:**
- To browse the menu without having to flag down a waiter.
- To ask questions about menu items naturally (e.g., *"Is the pasta vegetarian?"*).
- To easily add or remove items before confirming their order.
- To get a clear summary of what they ordered and how much it will cost.
- To be able to cancel or modify their order after placing it (within a reasonable window).

**Their frustrations:**
- Confusing or cluttered ordering interfaces.
- AI that confidently makes up menu items that don't exist.
- Unexpected price changes between what they saw and what they're charged.
- No way to fix an accidental order.

**Their technical level:** Low to medium. They use apps daily but don't think about how they work.

---

### Persona B — The Restaurant Manager (Jordan)

> *"I need to see every order before it goes to the kitchen. I want control."*

**Who they are:**
Jordan is a shift manager or restaurant owner. They are responsible for the smooth operation of the restaurant during their shift. They use a tablet or desktop computer behind the counter.

**What they want:**
- A real-time feed of incoming orders that need their attention.
- To quickly read each order — what was ordered, by whom, and the total cost.
- A simple one-click **Approve** or **Reject** action for each order.
- To add a short reason if they reject an order (e.g., "Item temporarily unavailable").
- A history log of past orders so they can review what went out.

**Their frustrations:**
- Cluttered dashboards with too much information.
- Slow or laggy interfaces — they need to act fast during a busy service.
- No ability to push back on an incorrect order.

**Their technical level:** Medium. Comfortable with point-of-sale systems and tablet apps, but not developers.

---

## 3. Core Features

Features are split into two areas: what the **customer** experiences and what the **manager** experiences.

---

### 3.1 Customer-Facing Features

#### F-C1: AI Chat Ordering Interface

The heart of the system. Customers interact with an AI assistant through a simple chat window to build their order.

- The AI greets the customer and offers to help them order.
- Customers can ask about menu items in plain English (e.g., *"What burgers do you have?"*, *"Does the Caesar salad have anchovies?"*).
- The AI can **only** recommend and add items that currently exist in the **active SQLite menu**. It will never make up items or prices.
- The AI confirms the running order total before the customer submits.
- The AI uses structured **tools** (not free-form guessing) to look up menu items, add items to the order, and calculate totals. This is what keeps it accurate and trustworthy.

#### F-C2: Menu Awareness (No Hallucinations)

A strict guardrail on the AI's behavior.

- The AI agent queries the live SQLite database for the current menu before recommending anything.
- If an item is marked as **inactive** or **unavailable** in the database, the AI will not suggest or add it.
- If a customer asks for something not on the menu, the AI politely says it's not available — it will never invent a dish or a price.

#### F-C3: Order Review & Confirmation

Before the order is sent to the manager, the customer sees a clear summary.

- A clean order summary screen shows: each item, quantity, price per item, and the **final total**.
- The customer confirms the order with a single button.
- Once confirmed, the order is submitted and the customer is told it's pending manager approval.

#### F-C4: Order Modification

Customers can make changes to their order while still in the chat.

- Add more of an item.
- Remove an item from the cart.
- Change the quantity of an existing item.
- The AI handles these requests conversationally (e.g., *"Actually, make it two burgers instead of one"*).

#### F-C5: Order Cancellation

Customers can cancel their order after submission, but only while it is still in a **Pending** state (i.e., the manager has not yet approved it).

- A "Cancel Order" button is available on the order status screen.
- Once the manager has approved or rejected the order, cancellation is no longer possible.
- The customer receives a clear message confirming their cancellation.

#### F-C6: Customer Authentication

Customers log in before ordering so their order history is tracked.

- Authentication is handled via **Supabase** (email/password or magic link).
- A guest ordering flow is **out of scope** for this phase.

#### F-C7: Rate Limiting

To prevent abuse (e.g., a bot spamming the AI chat endpoint):

- API calls to the AI chat endpoint are **rate limited** using **Redis / Upstash**.
- Limits are applied per user session.
- Customers who hit the limit see a friendly message asking them to wait before sending more messages.

#### F-C8: Rewards & Loyalty System

Customers earn points for every order they place, which they can later redeem for free items or discounts.

- **Earning points:** Every completed and approved order automatically awards the customer between **10 and 50 reward points**, calculated dynamically based on the order's total price and the number of items ordered. Bigger orders earn more points.
- **Point balance:** The AI is aware of the customer's current point balance and can tell them how many points they have at any time (e.g., *"You currently have 120 points!"*).
- **Redeeming points:** Customers can ask the AI to redeem their points during an order. Specific rewards (such as a free drink or a free appetizer) are available at set point costs defined in the system.
- **AI-driven redemption:** The AI handles the redemption conversationally (e.g., *"Would you like to use your 100 points for a free lemonade?"*) and applies the reward to the current order before it is submitted.
- **Point history:** Customers can view their total accumulated points and a log of when points were earned or redeemed.

---

### 3.2 Manager-Facing Features

#### F-M1: Manager Dashboard

A dedicated, protected web page only accessible to users with the **Manager** role.

- Displays a real-time list of all **Pending** orders waiting for review.
- Each order card shows: customer name, list of items ordered, and the total price.
- Orders are sorted by time — oldest first, so nothing gets missed.

#### F-M2: Order Approval

The manager can approve a pending order with a single click.

- Clicking **Approve** changes the order status to `Approved`.
- The customer's order status screen updates to reflect the approval.
- The approved order moves out of the pending queue.

#### F-M3: Order Rejection

The manager can reject an order with an optional reason.

- Clicking **Reject** opens a small input field for a rejection reason (optional but encouraged).
- The order status is updated to `Rejected`.
- The rejection reason (if provided) is stored and shown to the customer.

#### F-M4: Order History Log

The manager can view a log of past orders (approved and rejected).

- Filterable by status: All, Approved, Rejected, Cancelled.
- Shows timestamp, customer name, items, total, and outcome.
- No editing of past records — this is read-only.

#### F-M5: Manager Authentication & Role Guard

The manager dashboard is protected by role-based access.

- Authentication is handled via **Supabase**.
- Only users with the `manager` role assigned in the database can access the dashboard.
- Attempting to visit the manager dashboard as a regular customer redirects to the customer ordering page.

#### F-M6: Inventory & Menu Management

Managers can view and manage the full restaurant menu directly from their dashboard — no need to touch the database manually.

- **View menu:** See all menu items (both active and inactive) in a clean table or card layout.
- **Add item:** A simple form to create a new menu item with a name, description, category, price, dietary tags (vegetarian, vegan, gluten-free), and an initial stock quantity.
- **Edit item:** Update the name, description, price, or any other details of an existing item.
- **Update stock quantity:** Quickly adjust how many units of an item are currently available (e.g., "Only 5 portions of the salmon left today"). When stock hits zero, the item is automatically marked inactive so the AI stops recommending it.
- **Deactivate / Reactivate item:** Toggle an item on or off without deleting it permanently. Deactivated items are invisible to the AI and to customers.
- **Delete item:** Permanently remove a menu item. This action requires a confirmation step to prevent accidental deletion.
- **Instant effect:** Any change made here is immediately reflected in the AI agent's data — no restart or manual sync required.

#### F-M7: Dashboard Analytics & Data Visualization

The Manager Dashboard includes a dedicated analytics section that turns raw order data into easy-to-read charts — giving the manager a quick visual snapshot of how the restaurant is performing.

- **Revenue Line Chart:** A line chart showing total approved revenue over time (e.g., by day or by week). The manager can see at a glance whether sales are growing, flat, or declining.
- **Top-Selling Items Pie Chart:** A pie (or donut) chart showing which menu items have been ordered the most, broken down by percentage of total orders. Helps the manager know what's popular.
- **Inventory Breakdown Chart:** A bar chart showing current stock levels for each active menu item. Items with low stock are highlighted so the manager knows what to restock.
- **Data source:** All chart data is calculated and aggregated by the **FastAPI backend** before being sent to the frontend. The frontend simply renders the numbers — it never does the math itself.
- **Charting library:** Charts are rendered using **Recharts**, a React-native charting library that is lightweight, easy to use, and fits the Everforest dark theme with custom color configuration.

---

## 4. Out of Scope

The following features are **intentionally not included** in this first version of the project. They may be added in a future phase, but building them now would add unnecessary complexity to what is a focused capstone demo.

| # | Feature | Reason for Exclusion |
|---|---|---|
| 1 | **Real-time kitchen display / printer integration** | Requires physical hardware or complex WebSocket kitchen systems. |
| 2 | **Payment processing** (Stripe, PayPal, etc.) | Payment gateways add compliance and security complexity (PCI-DSS). |
| 3 | **Guest checkout (no login required)** | Requires session management without auth; adds complexity to order tracking. |
| 4 | **Multi-restaurant / multi-location support** | This is a single-restaurant system. Multi-tenancy is a future concern. |
| 5 | **Mobile native app** (iOS / Android) | The web app is designed to be mobile-responsive, but native apps are out of scope. |
| 6 | **AI voice ordering** | Voice interfaces (e.g., speech-to-text) are not included in this phase. |
| 7 | **Push notifications / SMS alerts** | Order status updates are shown in-app only; no push/SMS notifications. |

---

## 5. Success Metrics

These are the measurable signals that tell us the project is working correctly and achieving its goals. Since this is a portfolio/capstone project (not a live product with thousands of users), the metrics focus on **technical correctness**, **user experience quality**, and **demonstrating the HITL flow**.

---

### 5.1 Technical Correctness

| Metric | Target | Notes |
|---|---|---|
| AI Menu Accuracy | 100% | The AI must never recommend or add an item not in the active menu database. |
| Order Total Accuracy | 100% | The final price shown to the customer must always match the database-calculated total. |
| HITL Flow Completion | 100% | Every submitted order must pass through the manager approval/rejection step without exception. |
| Authentication Success Rate | > 99% | Supabase login/logout must work reliably for both customer and manager roles. |
| Role Guard Effectiveness | 100% | Customers must never be able to access the manager dashboard. |
| Reward Points Calculation Accuracy | 100% | Points awarded per order must always fall within the 10–50 range and correctly reflect the order's price and item count. No points should be awarded for cancelled or rejected orders. |
| Inventory Update Reliability | 100% | When a manager edits a menu item's stock or price, the change must be immediately visible in the AI's menu tool data with zero errors or stale reads. |
| Analytics Chart Accuracy | 100% | Revenue totals and item counts displayed in charts must exactly match the values calculated from the `orders` and `order_items` tables. Charts must only count `APPROVED` orders toward revenue. |

---

### 5.2 User Experience Quality

| Metric | Target | Notes |
|---|---|---|
| AI Response Time | < 5 seconds | Each AI chat response should feel fast and not make the user wait awkwardly. |
| Order Placement Time | < 3 minutes | A customer should be able to go from greeting to order submission in under 3 minutes. |
| Manager Review Time | < 30 seconds per order | The dashboard must make it fast and obvious for a manager to approve or reject an order. |
| Mobile Responsiveness | Fully responsive | The customer chat UI must be usable on a smartphone screen without horizontal scrolling. |

---

### 5.3 Capstone / Portfolio Demonstration Goals

These are softer goals that demonstrate the educational and portfolio value of the project.

| Goal | Description |
|---|---|
| **HITL Pattern Demonstrated** | The project clearly shows a working Human-in-the-Loop approval loop with real state changes visible on both the customer and manager views. |
| **AI Guardrails in Action** | The demo can clearly show the AI refusing to hallucinate a menu item and only working with live database data. |
| **Full-Stack Coverage** | The project uses a distinct frontend, backend API, database, and third-party auth service — demonstrating end-to-end software architecture skills. |
| **Clean Code & Documentation** | The codebase is organized, commented, and accompanied by an `About/` folder with project documentation (including this PRD). |
| **Rate Limiting Visible** | The project can demonstrate the rate limiter triggering under repeated rapid requests, showing awareness of production-level concerns. |

---

*End of PRD v3.0*
