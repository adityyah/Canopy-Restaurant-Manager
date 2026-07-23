// frontend/src/components/Navbar.tsx
// =============================================================================
// Navbar — Top Navigation Bar
// =============================================================================
// Always-visible brand bar used on the Customer Terminal (/chat).
//
// Logged-in state: email · role badge · ⚙ Account Settings · Sign out
// Guest state:     brand + Login button
//
// ManagerLayout has its own top nav — this Navbar is only used on the
// customer-facing routes (/chat, /order-status, /rewards).
// =============================================================================

import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="bg-bg-surface border-b border-bg-border sticky top-0 z-40">
      <div className="page-container py-0 flex items-center justify-between h-14">

        {/* ── Brand ──────────────────────────────────────────────────── */}
        <span className="font-display font-bold text-text-heading tracking-tight text-lg">
          Canopy <span className="text-accent-green">🌿</span>
        </span>

        {/* ── Right side ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          {user ? (
            // ── Logged-in state ──────────────────────────────────────
            <>
              <span className="text-text-muted text-sm hidden sm:block truncate max-w-[180px]">
                {user.email}
              </span>
              <span className={user.role === 'manager' ? 'badge-approved' : 'badge-draft'}>
                {user.role}
              </span>

              {/* ⚙ Account Settings */}
              <Link
                to="/settings"
                className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5"
                title="Account Settings"
              >
                <span>⚙</span>
                <span className="hidden sm:inline">Settings</span>
              </Link>

              {/* Sign out */}
              <button
                onClick={() => void handleLogout()}
                className="btn-ghost text-xs px-3 py-1.5"
              >
                Sign out
              </button>
            </>
          ) : (
            // ── Guest state — show Login button ──────────────────────
            <Link
              to="/login"
              className="btn-primary text-xs px-4 py-1.5 font-semibold"
            >
              Log In
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
