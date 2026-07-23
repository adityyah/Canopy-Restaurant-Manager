// frontend/src/layouts/ManagerLayout.tsx
// =============================================================================
// ManagerLayout — Wrapper for All Manager Pages
// =============================================================================
// Provides:
//   • A top navigation bar with three section tabs: Orders | Inventory | Insights
//   • The Canopy brand (left) and user info + Logout (right)
//   • An <Outlet /> for nested route content
//   • Role guard: redirects non-managers back to /chat immediately
//
// Design (DESIGN.md § 4.7):
//   "Manager nav links: the active route link uses accent-green color
//    and a 2px bottom border in accent-green."
//
// Navigation shape:
//   /manager             → OrdersView   (pending approvals — the HITL core)
//   /manager/inventory   → InventoryView
//   /manager/insights    → InsightsView
// =============================================================================

import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'


// ---------------------------------------------------------------------------
// Nav tab definition
// ---------------------------------------------------------------------------

const NAV_TABS = [
  { to: '/manager',            label: '📋 Orders',    end: true  },
  { to: '/manager/inventory',  label: '🌿 Inventory', end: false },
  { to: '/manager/insights',   label: '🤖 Insights',  end: false },
] as const

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ManagerLayout() {
  const { user, logout, isLoading } = useAuth()
  const navigate = useNavigate()

  // Role guard — redirect non-managers away immediately
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'manager')) {
      navigate('/login', { replace: true })
    }
  }, [user, isLoading, navigate])

  // Don't flash the layout while auth is resolving
  if (isLoading || !user) return null

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-base">

      {/* ── Top Navigation Bar ──────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 border-b border-bg-border"
        style={{ background: '#343F44' }}
      >
        <div className="page-container py-0 flex items-center justify-between h-14">

          {/* Brand */}
          <span className="font-display font-bold text-text-heading text-lg tracking-tight">
            Canopy <span className="text-accent-green">🌿</span>
            <span className="text-text-muted text-xs font-sans font-normal ml-2 tracking-normal">
              Manager
            </span>
          </span>

          {/* Nav tabs — centre */}
          <nav className="hidden sm:flex items-stretch h-full gap-1" aria-label="Manager navigation">
            {NAV_TABS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center px-4 text-sm font-medium transition-all duration-150 border-b-2 ` +
                  (isActive
                    ? 'text-accent-green border-accent-green'
                    : 'text-text-muted border-transparent hover:text-text-primary hover:border-bg-border')
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right: user info + settings + logout */}
          <div className="flex items-center gap-3">
            <span className="hidden md:block text-text-muted text-xs truncate max-w-[160px]">
              {user.email}
            </span>
            <span className="badge-approved text-xs">manager</span>

            {/* ⚙ Account Settings */}
            <Link
              to="/settings"
              className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5"
              title="Account Settings"
            >
              <span>⚙</span>
              <span className="hidden lg:inline">Settings</span>
            </Link>

            <button
              onClick={() => void handleLogout()}
              className="btn-ghost text-xs px-3 py-1.5"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile nav — tabs below the main bar on small screens */}
        <nav
          className="sm:hidden flex border-t border-bg-border overflow-x-auto"
          aria-label="Manager navigation mobile"
        >
          {NAV_TABS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex-1 text-center py-2.5 text-xs font-medium border-b-2 transition-colors duration-150 whitespace-nowrap ` +
                (isActive
                  ? 'text-accent-green border-accent-green'
                  : 'text-text-muted border-transparent')
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* ── Page Content (nested routes render here) ─────────────────── */}
      <main className="flex-1 page-container py-6">
        <Outlet />
      </main>
    </div>
  )
}
