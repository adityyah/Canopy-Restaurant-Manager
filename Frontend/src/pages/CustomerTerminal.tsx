// frontend/src/pages/CustomerTerminal.tsx
// =============================================================================
// CustomerTerminal — The Complete Customer Experience
// =============================================================================
// Composes the full customer-facing page:
//
//   ┌─────────────────────────────────────────────────────────────────────┐
//   │  NAVBAR (Canopy brand + user + sign-out)                            │
//   ├─────────────────────────────────────────────────────────────────────┤
//   │                                                                     │
//   │  HERO  "Good Food, Great Mood"   (Playfair Display — earthy, warm)  │
//   │        Tagline + daily delight callout                              │
//   │                                                                     │
//   ├──────────────────────────────────────┬──────────────────────────────┤
//   │                                      │                              │
//   │  MenuDisplay (60%)                   │  ChatInterface (40%)         │
//   │  ─ Category tabs                     │  ─ Sticky / full height      │
//   │  ─ Item cards (2-col grid)           │  ─ Auto-scroll              │
//   │  ─ Add to Order → injects string     │  ─ Interrupt banner          │
//   │                                      │                              │
//   └──────────────────────────────────────┴──────────────────────────────┘
//
// Layout notes:
//   • On desktop (lg+): side-by-side. Menu 60%, Chat 40%.
//   • On mobile / tablet: stacked, chat on top (above fold) for primary CTA.
//   • The chat panel is `sticky top-0` on desktop so it remains in view
//     while the customer scrolls through the menu grid.
//   • The injectedMessage flow: MenuCard → onAddToOrder → state in this
//     component → prop to ChatInterface → pre-fills input → cleared.
//
// Design philosophy (DESIGN.md § 1):
//   "Think of walking into a quiet, well-lit restaurant at dusk — dark wood
//    tables, soft green plants on the windowsills, warm candlelight."
// =============================================================================

import { useState, useCallback } from 'react'
import Navbar from '@/components/Navbar'
import MenuDisplay from '@/components/customer/MenuDisplay'
import ChatInterface from '@/components/customer/ChatInterface'
import { useAuth } from '@/context/AuthContext'

// ---------------------------------------------------------------------------
// Hero Section
// ---------------------------------------------------------------------------

function HeroSection({ greeting }: { greeting: string }) {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        // Subtle organic gradient — deeper at edges, slightly lighter in centre
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(167,192,128,0.07) 0%, transparent 70%), #2D353B',
        borderBottom: '1px solid #475258',
      }}
      aria-labelledby="hero-heading"
    >
      {/* Decorative leaf pattern — pure CSS, no images */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 50%, rgba(131,192,146,0.04) 0%, transparent 50%), ' +
            'radial-gradient(circle at 85% 20%, rgba(167,192,128,0.05) 0%, transparent 40%)',
        }}
      />

      <div className="page-container py-10 relative z-10">
        <div className="max-w-2xl">
          {/* Micro-label above the heading */}
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: '#A7C080' }}
            >
              Canopy Restaurant
            </span>
            <span className="w-8 h-px bg-accent-green opacity-50" />
          </div>

          {/* Main heading — Playfair Display, DESIGN.md § 3.2 Page Title (H1) */}
          <h1
            id="hero-heading"
            className="font-display font-bold text-text-heading mb-2"
            style={{ fontSize: 'clamp(28px, 4vw, 42px)', lineHeight: 1.2 }}
          >
            Good Food,{' '}
            <span style={{ color: '#A7C080', fontStyle: 'italic' }}>Great Mood.</span>
          </h1>

          {/* Tagline */}
          <p className="text-text-muted text-sm leading-relaxed max-w-lg">
            {greeting}, welcome back. Tell our AI what you're craving — it will
            help you build your order and send it straight to the kitchen.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { icon: '🤖', label: 'AI-Powered Ordering' },
              { icon: '👨‍🍳', label: 'Manager-Approved' },
              { icon: '⭐', label: 'Earn Reward Points' },
            ].map(({ icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  background: 'rgba(71, 82, 88, 0.6)',
                  color: '#9DA9A0',
                  border: '1px solid rgba(71, 82, 88, 0.8)',
                }}
              >
                <span>{icon}</span>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function CustomerTerminal() {
  const { user } = useAuth()

  // The message string lifted from MenuDisplay → injected into ChatInterface
  const [injectedMessage, setInjectedMessage] = useState<string | undefined>(undefined)

  const handleAddToOrder = useCallback((message: string) => {
    setInjectedMessage(message)
  }, [])

  const handleInjectedConsumed = useCallback(() => {
    setInjectedMessage(undefined)
  }, [])

  // Build a personal greeting from the user's email prefix
  const emailPrefix = user?.email?.split('@')[0] ?? 'there'
  const greetingName =
    emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)

  return (
    <div className="min-h-screen flex flex-col bg-bg-base">
      {/* ── Top Navigation ──────────────────────────────────────────── */}
      <Navbar />

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <HeroSection greeting={greetingName} />

      {/* ── Main Content Area ───────────────────────────────────────── */}
      {/*
        Mobile: chat on top (full width), menu below.
        Desktop (lg+): menu 60% left, chat 40% right — chat sticky.
        The outer div is a flex column on mobile, flex row on lg.
      */}
      <div className="flex flex-col lg:flex-row flex-1 gap-0 page-container py-0 lg:py-6 lg:gap-6 px-0 lg:px-8">

        {/* ── Chat Panel (mobile: first / full-width, desktop: right 40%) ── */}
        {/*
          On mobile: rendered first in DOM → appears above the menu.
          On desktop: order-2 places it on the right, sticky keeps it in view.
        */}
        <div
          className="w-full lg:w-2/5 lg:order-2 lg:sticky lg:top-6 lg:self-start
                     border-b lg:border-b-0 border-bg-border"
          style={{
            // On desktop, limit height so it doesn't overflow the viewport
            maxHeight: 'calc(100vh - 88px)',
          }}
        >
          <div
            className="h-full min-h-[480px] lg:min-h-0 card flex flex-col overflow-hidden rounded-none lg:rounded-card"
            style={{ height: 'calc(100vh - 88px - 1.5rem)' }}
            role="complementary"
            aria-label="AI Chat Assistant"
          >
            <ChatInterface
              injectedMessage={injectedMessage}
              onInjectedConsumed={handleInjectedConsumed}
            />
          </div>
        </div>

        {/* ── Menu Panel (mobile: second / full-width, desktop: left 60%) ── */}
        <div
          className="w-full lg:w-3/5 lg:order-1 overflow-y-auto py-5 px-4 lg:px-0"
          style={{ minHeight: 0 }}
          role="main"
          aria-label="Restaurant Menu"
        >
          <MenuDisplay onAddToOrder={handleAddToOrder} />
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer
        className="text-center py-4 border-t border-bg-border"
        style={{ background: '#2D353B' }}
      >
        <p className="text-text-muted text-xs">
          Canopy Restaurant &middot; All orders require manager approval &middot;{' '}
          <span className="text-accent-green">Earn points with every meal</span>
        </p>
      </footer>
    </div>
  )
}
