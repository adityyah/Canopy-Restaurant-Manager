/** @type {import('tailwindcss').Config} */
// frontend/tailwind.config.js
// =============================================================================
// Tailwind CSS Configuration — Canopy Restaurant Manager
// =============================================================================
// Extends Tailwind's default theme with the complete Everforest Dark color
// palette defined in About/DESIGN.md § 2.
//
// Usage in JSX/TSX:
//   <div className="bg-base text-primary">          ← Everforest tokens
//   <button className="bg-accent-green text-base">  ← Accent button
//   <span className="text-warning-yellow">          ← Status / badge
// =============================================================================

export default {
  // Only process files in src/ and the root index.html.
  // This keeps Tailwind's purge step fast.
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],

  theme: {
    extend: {
      // ── Everforest Color Palette (DESIGN.md § 2) ────────────────────────
      colors: {
        // Background layers — deep earthy greens (darkest → lightest)
        'bg-base':     '#2D353B',  // Main page background  (body, page wrappers)
        'bg-surface':  '#343F44',  // Cards, panels, modals
        'bg-elevated': '#3D484D',  // Hover states, nested panels, dropdowns
        'bg-border':   '#475258',  // Dividers, input borders, table separators

        // Text — warm off-whites (brightest → most muted)
        'text-heading': '#E9DFC1',  // Page H1 / H2 headings
        'text-primary': '#D3C6AA',  // Main body text, labels
        'text-muted':   '#9DA9A0',  // Timestamps, placeholders, secondary labels

        // Accent colors — each carries a single meaning (DESIGN.md § 2.3)
        'accent-green':   '#A7C080',  // Primary CTA, approve, active, earned points
        'accent-teal':    '#83C092',  // Secondary highlight, links, hover on green
        'warning-yellow': '#DBBC7F',  // Pending, low-stock, caution
        'danger-red':     '#E67E80',  // Reject, error, delete, cancelled
        'accent-blue':    '#7FBBB3',  // Informational (use sparingly)
      },

      // ── Typography ─────────────────────────────────────────────────────
      // Inter is loaded via Google Fonts in index.html.
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },

      // ── Spacing ────────────────────────────────────────────────────────
      // DESIGN.md: "Use a 4px base unit. Spacing is always a multiple of 4."
      // Tailwind's default already uses a 4px base (1 unit = 4px), so this
      // is consistent without extension.

      // ── Border Radius ──────────────────────────────────────────────────
      borderRadius: {
        'card': '0.75rem',  // 12px — used on cards and panels
        'pill': '9999px',   // Full pill — used on status badges
      },

      // ── Box Shadows ────────────────────────────────────────────────────
      boxShadow: {
        // Subtle lift used on interactive cards
        'card': '0 2px 8px 0 rgba(0, 0, 0, 0.35)',
        // Stronger elevation for modals / dropdowns
        'modal': '0 8px 32px 0 rgba(0, 0, 0, 0.55)',
      },

      // ── Animations ────────────────────────────────────────────────────
      keyframes: {
        // Typing dots pulse (used by the chat LoadingSpinner)
        'dot-bounce': {
          '0%, 80%, 100%': { transform: 'translateY(0)' },
          '40%':           { transform: 'translateY(-6px)' },
        },
        // Fade-in for new chat messages (PHASES.md § 7.2)
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        // Skeleton pulse for loading placeholders
        'skeleton-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
      },
      animation: {
        'dot-bounce':     'dot-bounce 1.2s infinite ease-in-out',
        'fade-in':        'fade-in 0.2s ease-out forwards',
        'skeleton-pulse': 'skeleton-pulse 1.5s ease-in-out infinite',
      },
    },
  },

  plugins: [],
}
