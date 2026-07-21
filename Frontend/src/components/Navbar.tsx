// frontend/src/components/Navbar.tsx
// Top navigation bar — Canopy brand always visible.
// When a user is logged in: shows email, role badge, and sign-out button.
// When no user (Phase 5 preview / pre-auth): shows brand + "Demo Mode" pill.
// Phase 6 will add a "Log In" button to the right side instead.

import { useAuth } from '@/context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()

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
            // Logged-in state
            <>
              <span className="text-text-muted text-sm hidden sm:block truncate max-w-[180px]">
                {user.email}
              </span>
              <span className={user.role === 'manager' ? 'badge-approved' : 'badge-draft'}>
                {user.role}
              </span>
              <button
                onClick={() => void logout()}
                className="btn-ghost text-xs px-3 py-1.5"
              >
                Sign out
              </button>
            </>
          ) : (
            // No user — Phase 5 preview / auth not yet wired
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{
                background: 'rgba(127, 187, 179, 0.12)',
                color: '#7FBBB3',
                border: '1px solid rgba(127, 187, 179, 0.25)',
              }}
              title="Auth will be wired in Phase 6"
            >
              ● Demo Mode
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
