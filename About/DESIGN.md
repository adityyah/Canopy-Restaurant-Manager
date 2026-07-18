# DESIGN.md — Design System
### *AI-Powered Restaurant Ordering System — Capstone Project*

**File Location:** `About/DESIGN.md`

**Last Updated:** July 2026

**Status:** v1.0

---

> This document is the single source of truth for all visual and UI decisions in the project. Every color, font size, border radius, and component style defined here must be used consistently across the entire application. When in doubt, refer back to this document first.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Color Palette](#2-color-palette)
3. [Typography](#3-typography)
4. [UI Components](#4-ui-components)
5. [Chart Styling](#5-chart-styling)

---

## 1. Design Philosophy

### The Vibe

Think of walking into a quiet, well-lit restaurant at dusk — dark wood tables, soft green plants on the windowsills, warm candlelight. Everything is calm, uncluttered, and intentional. Nothing screams for your attention. That is the feeling this interface should produce.

This is not a flashy food delivery app. It is a focused operational tool for restaurant staff and a simple, friendly chat interface for customers. The design should feel:

- **Calm and focused** — dark backgrounds reduce eye strain during long shifts.
- **Trustworthy** — clean layouts with clear labels make the manager feel in control.
- **Approachable** — soft green accents and rounded corners prevent the UI from feeling cold or intimidating to customers.
- **Minimal, not empty** — whitespace is generous but purposeful. Every element earns its place on the screen.

### Design Principles

| Principle | What it means in practice |
|---|---|
| **Clarity over cleverness** | Labels are plain and obvious. No mystery-meat icons without text. |
| **Consistent spacing** | Use a 4px base unit. Spacing between elements is always a multiple of 4 (8, 12, 16, 24, 32, 48px). |
| **One primary action per screen** | Each page has one obvious next step. The most important button is always the most visually prominent. |
| **Accessible contrast** | All text must meet WCAG AA contrast ratio minimums against its background. |
| **Responsive by default** | Every layout is designed mobile-first and gracefully expands to desktop. |

---

## 2. Color Palette

The palette is based on the **Everforest Dark** theme — a nature-inspired, warm dark color scheme. All colors are derived from or inspired by the official Everforest palette by sainnhe.

### 2.1 Core Backgrounds

These are the foundational layers of every page. Think of them as different depths of the same dark canvas.

| Token Name | Hex | Usage |
|---|---|---|
| `bg-base` | `#2D353B` | The main page background — the deepest layer. Used on `<body>` and full-page wrappers. |
| `bg-surface` | `#343F44` | Cards, panels, modals, sidebars — one step lighter than the page background. |
| `bg-elevated` | `#3D484D` | Hover states on cards, nested panels, dropdown backgrounds — one step above surface. |
| `bg-border` | `#475258` | Dividers, input borders, table row separators. |

### 2.2 Text Colors

| Token Name | Hex | Usage |
|---|---|---|
| `text-primary` | `#D3C6AA` | All main body text, headings, labels. A warm off-white — not stark white, which causes fatigue. |
| `text-muted` | `#9DA9A0` | Timestamps, placeholder text, secondary labels, footnotes. |
| `text-heading` | `#E9DFC1` | Page-level H1 and H2 headings where extra warmth and brightness is needed. |

### 2.3 Accent Colors

These are the colors that carry meaning. Use them sparingly and consistently — each one has one job.

| Token Name | Hex | Meaning | Usage |
|---|---|---|---|
| `accent-green` | `#A7C080` | Positive, primary action, confirmed | Approve buttons, active status badges, chart lines, primary CTAs, points earned |
| `accent-teal` | `#83C092` | Secondary highlight, informational | Links, hover states on green elements, secondary accent in charts |
| `warning-yellow` | `#DBBC7F` | Caution, pending, low stock | Pending status badges, low-stock chart bars, rate limit warnings |
| `danger-red` | `#E67E80` | Negative, destructive, rejected | Reject buttons, error messages, cancelled status badges, delete confirmations |
| `accent-blue` | `#7FBBB3` | Neutral informational | Informational toasts, help text callouts (use rarely) |

### 2.4 Full Palette Reference

```
Background Stack (darkest → lightest):
  #2D353B  bg-base
  #343F44  bg-surface
  #3D484D  bg-elevated
  #475258  bg-border

Text Stack (brightest → most muted):
  #E9DFC1  text-heading
  #D3C6AA  text-primary
  #9DA9A0  text-muted

Accents:
  #A7C080  accent-green    (primary)
  #83C092  accent-teal     (secondary)
  #DBBC7F  warning-yellow  (caution)
  #E67E80  danger-red      (error / destructive)
  #7FBBB3  accent-blue     (informational)
```

### 2.5 Tailwind Config Mapping

Add these to `tailwind.config.js` under `theme.extend.colors`:

```js
colors: {
  'bg-base':        '#2D353B',
  'bg-surface':     '#343F44',
  'bg-elevated':    '#3D484D',
  'bg-border':      '#475258',
  'text-primary':   '#D3C6AA',
  'text-muted':     '#9DA9A0',
  'text-heading':   '#E9DFC1',
  'accent-green':   '#A7C080',
  'accent-teal':    '#83C092',
  'warning-yellow': '#DBBC7F',
  'danger-red':     '#E67E80',
  'accent-blue':    '#7FBBB3',
}
```

---

## 3. Typography

### 3.1 Font Families

Two fonts are used in the project. Both are loaded from **Google Fonts**.

| Role | Font | Why |
|---|---|---|
| **UI / Body** | [Inter](https://fonts.google.com/specimen/Inter) | The gold standard for readable digital interfaces. Clean, neutral, highly legible at small sizes. Used for all body text, labels, buttons, inputs, and navigation. |
| **Display / Restaurant Headings** | [Playfair Display](https://fonts.google.com/specimen/Playfair+Display) | A elegant serif that adds a touch of warmth and restaurant character. Used sparingly — only for the app name/logo, major page titles (H1), and the chat greeting message. |

Add to `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
```

Set in `index.css`:
```css
body {
  font-family: 'Inter', system-ui, sans-serif;
  background-color: #2D353B;
  color: #D3C6AA;
}

h1, .display-heading {
  font-family: 'Playfair Display', Georgia, serif;
  color: #E9DFC1;
}
```

### 3.2 Type Scale

| Element | Font | Size | Weight | Color Token |
|---|---|---|---|---|
| App Name / Logo | Playfair Display | 28px | 700 | `text-heading` |
| Page Title (H1) | Playfair Display | 24px | 600 | `text-heading` |
| Section Header (H2) | Inter | 18px | 600 | `text-primary` |
| Card Title (H3) | Inter | 15px | 600 | `text-primary` |
| Body / Default | Inter | 14px | 400 | `text-primary` |
| Secondary / Caption | Inter | 13px | 400 | `text-muted` |
| Tiny / Timestamp | Inter | 12px | 400 | `text-muted` |
| Button Label | Inter | 14px | 500 | (varies by button type) |
| Input Text | Inter | 14px | 400 | `text-primary` |
| Badge / Pill Label | Inter | 12px | 600 | (varies by badge type) |

### 3.3 Line Height & Letter Spacing

- **Body text line height:** `1.6` — comfortable reading rhythm.
- **Headings line height:** `1.25` — tighter for display text.
- **Badge / button letter spacing:** `0.025em` — slight tracking improves legibility on short, uppercase-ish labels.

---

## 4. UI Components

### 4.1 Borders & Corners

Consistency in border radius creates a coherent, premium feel.

| Component | Border Radius | Notes |
|---|---|---|
| Cards / Panels | `12px` | The standard container shape. Noticeable but not bubbly. |
| Buttons (solid & ghost) | `8px` | Slightly rounded — professional, not pill-shaped. |
| Input fields | `8px` | Matches button radius for visual harmony. |
| Status badges / Pills | `999px` (full pill) | Fully rounded to distinguish them from buttons. |
| Modals / Dialogs | `16px` | Larger radius to feel elevated above the page. |
| Chart containers | `12px` | Same as cards — charts live inside card wrappers. |
| Tooltips | `6px` | Small, tight radius for compact elements. |
| Table rows | `0px` | No border radius on rows; the table container has `12px`. |

---

### 4.2 Buttons

Three button variants, each with a clear purpose. Never mix them on the same call-to-action.

#### Solid Button (Primary Action)
- **Background:** `accent-green` (`#A7C080`)
- **Text:** `#2D353B` (dark, for contrast on the green background)
- **Font weight:** 600
- **Padding:** `10px 20px`
- **Border radius:** `8px`
- **Hover state:** Background lightens slightly (use `opacity: 0.9` or a tinted green like `#B8CF94`). Add `box-shadow: 0 2px 8px rgba(167, 192, 128, 0.3)` for a soft green glow.
- **Transition:** `all 150ms ease`
- **Use for:** Confirm Order, Approve, Save Changes, Login

#### Danger Button (Destructive Action)
- **Background:** `danger-red` (`#E67E80`)
- **Text:** `#2D353B` (dark, for contrast)
- **Font weight:** 600
- **Padding:** `10px 20px`
- **Border radius:** `8px`
- **Hover state:** Background darkens slightly.
- **Transition:** `all 150ms ease`
- **Use for:** Reject Order, Cancel Order, Delete Item

#### Ghost Button (Secondary / Low-Priority Action)
- **Background:** Transparent
- **Text:** `text-muted` (`#9DA9A0`)
- **Border:** `1px solid bg-border` (`#475258`)
- **Font weight:** 500
- **Padding:** `10px 20px`
- **Border radius:** `8px`
- **Hover state:** Background becomes `bg-elevated` (`#3D484D`). Text becomes `text-primary`.
- **Transition:** `all 150ms ease`
- **Use for:** Cancel, Go Back, Close modal, secondary options

---

### 4.3 Cards & Panels

All content containers follow the same basic visual grammar.

- **Background:** `bg-surface` (`#343F44`)
- **Border:** `1px solid bg-border` (`#475258`) — subtle, not heavy
- **Border radius:** `12px`
- **Padding:** `20px 24px` (standard) or `16px` (compact, e.g., order line items)
- **Shadow:** `0 2px 12px rgba(0, 0, 0, 0.25)` — a soft, natural shadow to lift the card
- **Hover state (clickable cards only):** Border color transitions to `accent-teal` (`#83C092`). No background change. `transition: border-color 150ms ease`.

---

### 4.4 Status Badges

Status badges are the small colored pills that show the current state of an order. They must be immediately readable at a glance.

| Status | Background | Text Color | Label |
|---|---|---|---|
| `PENDING_APPROVAL` | `rgba(219, 188, 127, 0.15)` | `#DBBC7F` (warning-yellow) | Pending |
| `APPROVED` | `rgba(167, 192, 128, 0.15)` | `#A7C080` (accent-green) | Approved |
| `REJECTED` | `rgba(230, 126, 128, 0.15)` | `#E67E80` (danger-red) | Rejected |
| `CANCELLED` | `rgba(157, 169, 160, 0.1)` | `#9DA9A0` (text-muted) | Cancelled |
| `DRAFT` | `rgba(127, 187, 179, 0.15)` | `#7FBBB3` (accent-blue) | Draft |

Badge anatomy:
- **Border radius:** `999px` (full pill)
- **Padding:** `4px 12px`
- **Font size:** `12px`
- **Font weight:** `600`
- **Letter spacing:** `0.03em`
- Use a semi-transparent background version of the text color so the badge doesn't feel too heavy.

---

### 4.5 Input Fields & Text Areas

- **Background:** `bg-base` (`#2D353B`) — slightly darker than the card it sits on, creating a subtle inset effect.
- **Border:** `1px solid bg-border` (`#475258`)
- **Border radius:** `8px`
- **Padding:** `10px 14px`
- **Text color:** `text-primary`
- **Placeholder color:** `text-muted`
- **Focus state:** Border color transitions to `accent-green` (`#A7C080`). Add `box-shadow: 0 0 0 3px rgba(167, 192, 128, 0.15)` for a soft glow ring.
- **Error state:** Border color becomes `danger-red`. Shadow ring uses danger-red at 15% opacity.
- **Transition:** `border-color 150ms ease, box-shadow 150ms ease`

---

### 4.6 Chat Bubbles

The chat interface has two types of bubbles.

#### Customer Bubble (right-aligned)
- **Background:** `rgba(167, 192, 128, 0.15)` — a very faint green tint
- **Border:** `1px solid rgba(167, 192, 128, 0.25)`
- **Border radius:** `16px 16px 4px 16px` (rounded everywhere except bottom-right)
- **Text:** `text-primary`
- **Max width:** `75%` of the chat window
- **Alignment:** Right-aligned (using `flex-direction: row-reverse`)

#### AI Bubble (left-aligned)
- **Background:** `bg-surface` (`#343F44`)
- **Border:** `1px solid bg-border` (`#475258`)
- **Border radius:** `16px 16px 16px 4px` (rounded everywhere except bottom-left)
- **Text:** `text-primary`
- **Max width:** `75%` of the chat window
- **Alignment:** Left-aligned

#### Typing Indicator (AI is thinking)
- Three small dots (`bg-border` color) in the AI bubble position, animating with a staggered fade-in-out loop.

#### Timestamps
- Displayed below each bubble in `text-muted`, `12px`, with a small gap.

---

### 4.7 Navigation / Navbar

- **Background:** `bg-surface` with a `border-bottom: 1px solid bg-border`
- **Height:** `60px`
- **Left side:** App name in Playfair Display with the `accent-green` dot or leaf icon beside it.
- **Right side:** Current user's name (truncated if too long) + a ghost "Log Out" button.
- **Manager nav links** (below the main navbar or as a sidebar): Pending Orders · Inventory · History · Analytics — rendered as text links. The active route link uses `accent-green` color and a `2px` bottom border in `accent-green`.

---

### 4.8 Tables (Manager Views)

- **Container background:** `bg-surface` with `12px` border radius and a border.
- **Header row:** `bg-elevated` background. Text in `text-muted`, `12px`, `600` weight, uppercase with `0.06em` letter spacing.
- **Body rows:** `bg-surface` background. Alternating rows can use `bg-elevated` for zebra striping (optional — keep if it aids readability, remove if it feels heavy).
- **Row borders:** A `1px solid bg-border` line between rows.
- **Row hover:** Background transitions to `bg-elevated`. `transition: background 100ms ease`.
- **Low-stock rows** (Inventory table): Left border becomes `4px solid warning-yellow`. Row background gets a very faint yellow tint `rgba(219, 188, 127, 0.05)`.

---

### 4.9 Modals & Dialogs

- **Backdrop:** A full-screen overlay using `rgba(0, 0, 0, 0.6)`.
- **Modal card:** `bg-surface` background, `16px` border radius, `1px solid bg-border` border, `box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5)`.
- **Max width:** `480px` (standard), `640px` (wide/form modals).
- **Entry animation:** Fade in + subtle scale from `0.96` to `1.0` over `200ms`.
- **Header:** Modal title in Inter `600` `16px`. A close `✕` icon button in the top-right corner.

---

### 4.10 Toast Notifications

Small, non-blocking messages that appear in the top-right corner to confirm actions or report errors.

| Type | Left border color | Icon |
|---|---|---|
| Success | `accent-green` | ✓ |
| Error | `danger-red` | ✗ |
| Warning | `warning-yellow` | ⚠ |
| Info | `accent-blue` | ℹ |

- **Background:** `bg-elevated`
- **Border:** `1px solid bg-border`
- **Border radius:** `10px`
- **Left border:** `4px solid [type color]` — this is the primary color signal
- **Auto-dismiss:** After 4 seconds, with a fade-out animation
- **Entry animation:** Slide in from right + fade in, `250ms ease`

---

## 5. Chart Styling

All charts use **Recharts** components and must be styled to match the Everforest dark theme. Never use Recharts default colors (they are designed for light backgrounds and will look wrong on dark backgrounds).

### 5.1 Global Chart Rules

- **Chart backgrounds:** Always transparent — the chart sits inside a `bg-surface` card, which provides the background.
- **Axis lines:** `bg-border` (`#475258`) — subtle, not distracting.
- **Axis tick labels:** `text-muted` (`#9DA9A0`), `12px`, Inter.
- **Grid lines:** Dashed, `bg-border` color at `50%` opacity. Horizontal grid lines only (no vertical grid lines) for cleanliness.
- **Tooltip container:** `bg-elevated` (`#3D484D`) background, `1px solid bg-border` border, `8px` border radius. Text in `text-primary`.
- **Recharts `CartesianGrid` prop:** `stroke="#475258"` `strokeOpacity={0.5}` `strokeDasharray="3 3"`

---

### 5.2 Revenue Line Chart

This chart shows approved revenue over time on the Manager Analytics page.

| Element | Color / Style |
|---|---|
| Line stroke | `accent-green` (`#A7C080`) |
| Line width | `2px` |
| Data point dots | `accent-green` fill, `bg-surface` stroke, `4px` radius |
| Active dot (hover) | `accent-green` fill, `bg-surface` stroke, `6px` radius |
| Area fill (if using AreaChart) | Gradient from `accent-green` at `25%` opacity at the top to `0%` opacity at the bottom |
| Tooltip value | `accent-green` color |
| X-axis label | `text-muted` |
| Y-axis label | `text-muted` |
| Reference line (if used) | `accent-teal` dashed |

**Recharts component:** Use `<AreaChart>` with a `<defs><linearGradient>` for the fill area to give the chart depth without being heavy.

---

### 5.3 Top-Selling Items Pie Chart

This chart shows which menu items are ordered most frequently.

Use this specific color cycle for the pie slices (all from the Everforest family):

| Slice # | Color | Hex |
|---|---|---|
| 1 | Sage Green | `#A7C080` |
| 2 | Teal | `#83C092` |
| 3 | Sky Blue | `#7FBBB3` |
| 4 | Warm Gold | `#DBBC7F` |
| 5 | Muted Red | `#E67E80` |
| 6 | Lavender | `#D699B6` |
| 7 | Light Teal | `#89D3C0` |
| 8+ | Cycle from the top | — |

Additional styling:
- **Stroke between slices:** `bg-base` (`#2D353B`), `2px` — creates a dark gap between slices that feels deliberate and clean.
- **Label:** Item name + percentage. Use `text-primary` color. If a slice is too small for a label, show only the percentage.
- **Inner radius:** Use a donut chart (`innerRadius="55%"`) so the chart feels lighter and the center can optionally display the total order count.
- **Legend:** Below the chart. Use small colored squares (matching slice colors) with item names in `text-muted`.

---

### 5.4 Inventory Bar Chart

This chart shows current stock levels per active menu item. Its primary purpose is to visually flag which items are running low.

| Element | Color / Style |
|---|---|
| Default bar color | `accent-green` (`#A7C080`) |
| Low-stock bar color (≤ 5 units) | `warning-yellow` (`#DBBC7F`) |
| Out-of-stock bar (0 units, if shown) | `danger-red` (`#E67E80`) |
| Bar border radius | `4px` on top corners only (`radius={[4, 4, 0, 0]}` in Recharts) |
| Reference line at `stock = 5` | Dashed, `warning-yellow` color, labeled "Low Stock" |
| X-axis | Item names, angled at `-35°` if there are many items to prevent overlap |
| Tooltip | Shows item name + exact stock quantity |

**Implementation note:** Recharts does not natively support per-bar colors based on data values in a simple way. The cleanest approach is to use a custom `<Cell>` component inside the `<Bar>` to assign colors dynamically:

```jsx
<Bar dataKey="stock_quantity" radius={[4, 4, 0, 0]}>
  {data.map((entry, index) => (
    <Cell
      key={index}
      fill={entry.stock_quantity === 0
        ? '#E67E80'
        : entry.is_low_stock
          ? '#DBBC7F'
          : '#A7C080'
      }
    />
  ))}
</Bar>
```

---

### 5.5 Chart Container Card

All charts are wrapped in a card component for visual consistency:

```
┌─────────────────────────────────────────────┐
│  Chart Title                    [Period: ▾] │  ← Card header (Inter 600 15px + optional control)
│─────────────────────────────────────────────│  ← bg-border divider
│                                             │
│         [Recharts component here]           │  ← Chart at min-height 280px
│                                             │
└─────────────────────────────────────────────┘
  bg-surface card, 12px radius, 24px padding
```

---

*End of DESIGN.md v1.0*
