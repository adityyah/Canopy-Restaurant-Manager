// frontend/src/components/customer/FloatingChatWidget.tsx
// =============================================================================
// FloatingChatWidget — Premium Floating AI Concierge Button
// =============================================================================
// A fixed-position FAB (floating action button) in the bottom-right corner of
// the Customer Terminal. Clicking it toggles a sleek elevated chat pop-up that
// houses the full <ChatInterface />.
//
// Design language (Everforest dark):
//   • Closed: circular #A7C080 button with a pulsing gold notification dot.
//   • Open: 400 × 560px rounded-2xl card (#2D353B bg, subtle green border).
//   • Header bar with live indicator, title, and × close button.
//   • The ChatInterface fills the remaining height.
//
// Props:
//   injectedMessage     — forwarded from a menu card "Add to Order" click.
//   onInjectedConsumed  — callback to clear the injected message after use.
// =============================================================================

import { useState } from 'react'
import ChatInterface from '@/components/customer/ChatInterface'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  injectedMessage?: string
  onInjectedConsumed?: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FloatingChatWidget({ injectedMessage, onInjectedConsumed }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    // Portal wrapper — z-50 keeps it above the sticky nav (z-40)
    <>

      {/* ── Expanded chat panel (Sidebar) ─────────────────────────────────── */}
      <div
        className={`fixed top-0 right-0 h-full w-full md:w-[400px] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out z-[9998] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          background: '#2D353B',
          borderLeft: '1px solid rgba(167,192,128,0.22)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="AI Chat Assistant"
      >
        {/* ── Header bar ──────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-5 py-3.5"
          style={{
            background: 'rgba(167,192,128,0.07)',
            borderBottom: '1px solid rgba(167,192,128,0.15)',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <div
              className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ background: '#A7C080' }}
            />
            <div>
              <p
                className="font-semibold text-sm"
                style={{ color: '#D3C6AA', fontFamily: 'Inter, sans-serif' }}
              >
                Canopy Assistant
              </p>
              <p
                className="text-xs"
                style={{ color: '#859289', fontFamily: 'Inter, sans-serif' }}
              >
                AI-powered · Always available
              </p>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-150"
            style={{ color: '#859289' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(230,126,128,0.12)'
              e.currentTarget.style.color = '#E67E80'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#859289'
            }}
            aria-label="Close chat"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M12 4L4 12M4 4l8 8"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* ── Chat interface (fills remaining height) ──────────────────── */}
        <div className="flex-1 overflow-hidden">
          <ChatInterface
            injectedMessage={injectedMessage}
            onInjectedConsumed={onInjectedConsumed}
          />
        </div>
      </div>

      {/* ── FAB toggle button ────────────────────────────────────────────── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-[9999] flex items-center justify-center rounded-full transition-all duration-200"
          style={{
            width: '60px',
            height: '60px',
            background: '#A7C080',
            color: '#2D353B',
            boxShadow: '0 8px 28px rgba(167,192,128,0.45)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
          }}
          aria-label="Open AI chat assistant"
          aria-expanded={isOpen}
        >
          {/* Chat bubble icon when closed */}
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
              fill="currentColor"
              opacity="0.9"
            />
          </svg>
        </button>
      )}

      {/* Pulsing gold notification dot — only shown when widget is closed */}
      {!isOpen && (
        <div
          className="fixed bottom-7 right-7 z-[9999] w-4 h-4 rounded-full border-2 animate-pulse pointer-events-none"
          style={{ background: '#DBBC7F', borderColor: '#2D353B' }}
          aria-hidden="true"
        />
      )}
    </>
  )
}
