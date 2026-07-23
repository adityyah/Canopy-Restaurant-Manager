// frontend/src/pages/CustomerTerminal.tsx
// =============================================================================
// CustomerTerminal — Fine-Dining Customer Experience
// =============================================================================
// Layout (Phase 7.2):
//
//   ┌──────────────────────────────────────────────────────────────────────────┐
//   │  NAV: [Home  Menu  About]   [CANOPY 🌿]   [Profile  🛒]                │
//   ├──────────────────────────────────────────────────────────────────────────┤
//   │  HERO: Left — big Playfair text + 2 CTAs   Right — circular food img   │
//   ├──────────────────────────────────────────────────────────────────────────┤
//   │  CATEGORIES STRIP (circular avatars)                                    │
//   ├──────────────────────────────────────────────────────────────────────────┤
//   │  MENU GRID (Chef's Recommendations cards)                               │
//   └──────────────────────────────────────────────────────────────────────────┘
//   FLOATING AI CHAT WIDGET — bottom-right corner, expands on click
//
// Theme: Everforest dark (#2D353B bg, #D3C6AA text, #A7C080 green, #E69875 orange)
// Typography: Playfair Display for headings, Inter for body
// =============================================================================

import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MenuDisplay from '@/components/customer/MenuDisplay'
import FloatingChatWidget from '@/components/customer/FloatingChatWidget'
import { useAuth } from '@/context/AuthContext'

// ---------------------------------------------------------------------------
// Fine-Dining Navigation
// ---------------------------------------------------------------------------

function FineDiningNav() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <nav
      className="sticky top-0 z-40 w-full"
      style={{
        background: 'rgba(45, 53, 59, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(71, 82, 88, 0.6)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 grid grid-cols-3 items-center">
        {/* Left Nav Links */}
        <div className="flex items-center gap-7">
          <a href="#menu" className="text-text-muted hover:text-accent-green text-sm font-medium transition-colors duration-150">Home</a>
          <a href="#menu" className="text-text-muted hover:text-accent-green text-sm font-medium transition-colors duration-150">Menu</a>
          <a href="#about" className="text-text-muted hover:text-accent-green text-sm font-medium transition-colors duration-150">About</a>
        </div>

        {/* Centred Logo */}
        <div className="flex justify-center">
          <span
            className="font-display font-bold text-2xl select-none"
            style={{ color: '#DBBC7F', letterSpacing: '0.04em' }}
          >
            Canopy 🌿
          </span>
        </div>

        {/* Right Utilities */}
        <div className="flex items-center justify-end gap-5">
          {user && (
            <span className="text-text-muted text-xs hidden md:block truncate max-w-[120px]">
              {user.email.split('@')[0]}
            </span>
          )}
          <Link
            to="/settings"
            className="text-text-muted hover:text-accent-green text-sm font-medium transition-colors duration-150"
            aria-label="Account settings"
          >
            ⚙
          </Link>
          <button
            onClick={() => void handleLogout()}
            className="text-text-muted hover:text-danger-red text-sm font-medium transition-colors duration-150"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Hero Section — 50/50 split
// ---------------------------------------------------------------------------

function HeroSection({ onExploreMenu }: { onExploreMenu: () => void }) {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: '#2D353B' }}
      aria-labelledby="hero-heading"
    >
      {/* Subtle radial glow behind the image side */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 75% 50%, rgba(167,192,128,0.06) 0%, transparent 60%),' +
            'radial-gradient(ellipse at 25% 80%, rgba(230,152,117,0.04) 0%, transparent 50%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-6 py-20 lg:py-28">
        <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-20">

          {/* ── LEFT: Text + CTAs ──────────────────────────────────────── */}
          <div className="flex-1 text-center lg:text-left">
            {/* Eyebrow */}
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-6">
              <span className="block h-px w-10 bg-[#DBBC7F] opacity-70" />
              <span
                className="text-xs font-semibold tracking-[0.2em] uppercase"
                style={{ color: '#DBBC7F' }}
              >
                Fine Dining & AI Ordering
              </span>
              <span className="block h-px w-10 bg-[#DBBC7F] opacity-70" />
            </div>

            {/* H1 */}
            <h1
              id="hero-heading"
              className="font-display font-bold leading-[1.08] mb-7"
              style={{
                fontSize: 'clamp(38px, 5.5vw, 68px)',
                color: '#D3C6AA',
              }}
            >
              Delicious Food,{' '}
              <span style={{ color: '#A7C080', fontStyle: 'italic' }}>
                Unforgettable
              </span>
              <br />
              Moments.
            </h1>

            <p className="text-text-muted text-base leading-relaxed mb-10 max-w-md mx-auto lg:mx-0">
              Savour every bite, curated by our chefs and effortlessly ordered
              through our intelligent assistant. Your table, your way.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <button
                className="min-w-[160px] px-8 py-3.5 rounded-lg font-semibold text-sm tracking-wide transition-all duration-200"
                style={{
                  background: '#DBBC7F',
                  color: '#2D353B',
                  boxShadow: '0 4px 20px rgba(219,188,127,0.28)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 28px rgba(219,188,127,0.42)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(219,188,127,0.28)' }}
              >
                Book a Table
              </button>
              <button
                onClick={onExploreMenu}
                className="min-w-[160px] px-8 py-3.5 rounded-lg font-semibold text-sm tracking-wide transition-all duration-200 border"
                style={{
                  background: 'transparent',
                  color: '#A7C080',
                  borderColor: 'rgba(167,192,128,0.5)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(167,192,128,0.08)'
                  e.currentTarget.style.borderColor = '#A7C080'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'rgba(167,192,128,0.5)'
                }}
              >
                Explore Menu ↓
              </button>
            </div>

            {/* Social proof micro-copy */}
            <div className="flex items-center justify-center lg:justify-start gap-4 mt-8">
              <div className="flex -space-x-2">
                {['#A7C080', '#DBBC7F', '#E69875', '#83C092'].map((c, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold"
                    style={{ background: c, borderColor: '#2D353B', color: '#2D353B' }}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <p className="text-text-muted text-xs">
                <span style={{ color: '#DBBC7F' }} className="font-semibold">4.9 ★</span>
                {' '}from 2,400+ happy guests
              </p>
            </div>
          </div>

          {/* ── RIGHT: Circular featured food image ────────────────────── */}
          <div className="flex-shrink-0 flex items-center justify-center relative">
            {/* Decorative orbital ring */}
            <div
              className="absolute rounded-full"
              style={{
                width: 'clamp(320px, 40vw, 480px)',
                height: 'clamp(320px, 40vw, 480px)',
                border: '1px dashed rgba(219,188,127,0.25)',
                animation: 'spin 40s linear infinite',
              }}
            />
            {/* Outer glow ring */}
            <div
              className="absolute rounded-full"
              style={{
                width: 'clamp(280px, 36vw, 440px)',
                height: 'clamp(280px, 36vw, 440px)',
                background: 'radial-gradient(circle, rgba(167,192,128,0.08) 0%, transparent 70%)',
              }}
            />
            {/* The circle image */}
            <div
              className="relative overflow-hidden rounded-full shadow-2xl"
              style={{
                width: 'clamp(260px, 32vw, 400px)',
                height: 'clamp(260px, 32vw, 400px)',
                border: '4px solid rgba(219,188,127,0.3)',
                boxShadow: '0 0 60px rgba(167,192,128,0.15), 0 24px 48px rgba(0,0,0,0.5)',
              }}
            >
              <img
                src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=85&w=800"
                alt="Premium fine-dining dish"
                className="w-full h-full object-cover"
                style={{ transform: 'scale(1.05)' }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: 'radial-gradient(circle at 30% 70%, rgba(45,53,59,0.2) 0%, transparent 60%)',
                }}
              />
            </div>

            {/* Floating badge — top right of image */}
            <div
              className="absolute top-4 right-4 lg:top-6 lg:right-0 px-3.5 py-2 rounded-xl text-xs font-bold shadow-lg"
              style={{
                background: '#343F44',
                border: '1px solid rgba(167,192,128,0.3)',
                color: '#A7C080',
              }}
            >
              🌿 AI Curated
            </div>
          </div>

        </div>
      </div>

      {/* Bottom fade into next section */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, #2D353B)' }}
      />
    </section>
  )
}



// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function CustomerTerminal() {
  const [injectedMessage, setInjectedMessage] = useState<string | undefined>(undefined)

  const handleAddToOrder = useCallback((message: string) => {
    setInjectedMessage(message)
  }, [])

  const handleInjectedConsumed = useCallback(() => {
    setInjectedMessage(undefined)
  }, [])

  const scrollToMenu = () => {
    document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#2D353B', color: '#D3C6AA' }}
    >
      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <FineDiningNav />

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <HeroSection onExploreMenu={scrollToMenu} />

      {/* ── Menu (categories + cards) ─────────────────────────────────────── */}
      <main
        id="menu"
        className="flex-1 max-w-7xl mx-auto w-full px-6 py-16"
        role="main"
        aria-label="Restaurant Menu"
      >
        <MenuDisplay onAddToOrder={handleAddToOrder} />
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer
        id="about"
        className="text-center py-8 border-t"
        style={{ borderColor: 'rgba(71,82,88,0.5)', background: '#252E33' }}
      >
        <p
          className="font-display font-semibold text-lg mb-1"
          style={{ color: '#DBBC7F' }}
        >
          Canopy 🌿
        </p>
        <p className="text-text-muted text-xs">
          All orders require manager approval · Earn reward points with every meal
        </p>
      </footer>

      {/* ── Floating AI Chat Widget ───────────────────────────────────────── */}
      <FloatingChatWidget
        injectedMessage={injectedMessage}
        onInjectedConsumed={handleInjectedConsumed}
      />

      {/* Spin animation for orbital ring */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
