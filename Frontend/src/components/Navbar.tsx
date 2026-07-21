// frontend/src/components/Navbar.tsx
// Top navigation bar — shows the current user's email, role badge, and a logout button.
// Phase 4 skeleton — full nav links added in Phase 5/6.

import { useAuth } from '@/context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()

  if (!user) return null

  return (
    <header className="bg-bg-surface border-b border-bg-border sticky top-0 z-40">
      <div className="page-container py-0 flex items-center justify-between h-14">
        {/* Brand */}
        <span className="text-text-heading font-bold tracking-tight">
          Canopy <span className="text-accent-green">🌿</span>
        </span>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <span className="text-text-muted text-sm hidden sm:block">{user.email}</span>
          <span
            className={
              user.role === 'manager' ? 'badge-approved' : 'badge-draft'
            }
          >
            {user.role}
          </span>
          <button
            onClick={() => void logout()}
            className="btn-ghost text-xs px-3 py-1.5"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
