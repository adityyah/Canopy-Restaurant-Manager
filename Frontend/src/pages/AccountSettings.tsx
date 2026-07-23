// frontend/src/pages/AccountSettings.tsx
// =============================================================================
// Account Settings — Canopy Restaurant Manager
// =============================================================================
// Accessible to every authenticated user (customers and managers).
// Three sections:
//   1. Session Info       — email, role, current session details.
//   2. Switch Account     — signs out and redirects to /login.
//   3. Delete Account     — two-step confirmation before calling DELETE /auth/me.
//
// Design (DESIGN.md):
//   • Everforest dark theme — bg-base page, card sections.
//   • Deletion danger zone: danger-red (#E67E80) border, bg, and button.
//   • Playfair Display for section headings, Inter for body.
//   • No glowing effects. Clean, minimal, clear warning copy.
// =============================================================================

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { api, type CanopyApiError } from '@/api/client'

// ---------------------------------------------------------------------------
// Section wrapper for visual separation
// ---------------------------------------------------------------------------

function Section({
  children,
  danger = false,
}: {
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <div
      className="card p-6"
      style={
        danger
          ? {
              borderColor: 'rgba(230, 126, 128, 0.35)',
              background: 'rgba(230, 126, 128, 0.04)',
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AccountSettings() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Switch account
  const [switchLoading, setSwitchLoading] = useState(false)

  // Delete account
  const [deletePhase, setDeletePhase] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [confirmInput, setConfirmInput] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Guard — should not render without a user (ProtectedRoute handles this)
  if (!user) return null

  const CONFIRM_PHRASE = 'delete my account'
  const confirmReady = confirmInput.trim().toLowerCase() === CONFIRM_PHRASE

  // ── Switch account ─────────────────────────────────────────────────────

  const handleSwitch = async () => {
    setSwitchLoading(true)
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  // ── Delete account ─────────────────────────────────────────────────────

  const handleDeleteConfirm = async () => {
    if (!confirmReady) return
    setDeletePhase('deleting')
    setDeleteError(null)

    try {
      // DELETE /auth/me — backend deletes the local user row
      await api.delete('/auth/me')

      // Clear session locally and redirect
      await logout()
      navigate('/login', { replace: true })
    } catch (err: unknown) {
      const apiErr = err as CanopyApiError
      setDeleteError(apiErr.friendlyMessage ?? 'Could not delete account. Please try again.')
      setDeletePhase('confirm')
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  const roleLabel = user.role === 'manager' ? 'Manager' : 'Customer'
  const roleBadgeClass = user.role === 'manager' ? 'badge-approved' : 'badge-draft'

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen"
      style={{ background: '#2D353B' }}
    >
      {/* ── Page header ──────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 border-b border-bg-border"
        style={{ background: '#343F44' }}
      >
        <div className="page-container py-0 flex items-center justify-between h-14">
          <Link
            to={user.role === 'manager' ? '/manager' : '/chat'}
            className="font-display font-bold text-text-heading text-lg tracking-tight hover:text-accent-green transition-colors duration-150"
          >
            ← Canopy <span className="text-accent-green">🌿</span>
          </Link>
          <h1 className="font-display font-bold text-text-heading text-base">
            Account Settings
          </h1>
          {/* Spacer to keep heading centred */}
          <div className="w-24" />
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="page-container py-8 max-w-lg mx-auto space-y-4">

        {/* ── Section 1: Session Info ──────────────────────────────── */}
        <Section>
          <h2 className="font-display font-bold text-text-heading text-lg mb-4">
            Your Session
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2.5 border-b border-bg-border">
              <span className="text-text-muted text-sm">Email</span>
              <span className="text-text-primary text-sm font-medium truncate ml-4 max-w-[220px]">
                {user.email}
              </span>
            </div>

            <div className="flex items-center justify-between py-2.5 border-b border-bg-border">
              <span className="text-text-muted text-sm">Account type</span>
              <span className={`${roleBadgeClass} text-xs`}>{roleLabel}</span>
            </div>

            <div className="flex items-center justify-between py-2.5">
              <span className="text-text-muted text-sm">Session stored in</span>
              <span className="text-text-muted text-xs font-mono">localStorage</span>
            </div>
          </div>
        </Section>

        {/* ── Section 2: Switch Account ────────────────────────────── */}
        <Section>
          <h2 className="font-display font-bold text-text-heading text-lg mb-1">
            Switch Account
          </h2>
          <p className="text-text-muted text-sm mb-4 leading-relaxed">
            Sign out of this session and return to the login screen to sign
            in with a different account.
          </p>

          <button
            onClick={() => void handleSwitch()}
            disabled={switchLoading}
            className="btn-ghost w-full py-2.5 font-medium text-sm"
          >
            {switchLoading ? 'Signing out…' : '↩ Sign Out & Go to Login'}
          </button>
        </Section>

        {/* ── Section 3: Danger Zone ───────────────────────────────── */}
        <Section danger>
          <div className="flex items-start gap-3 mb-4">
            <span className="text-xl flex-shrink-0 mt-0.5">⚠️</span>
            <div>
              <h2
                className="font-display font-bold text-lg mb-1"
                style={{ color: '#E67E80' }}
              >
                Delete Account
              </h2>
              <p className="text-text-muted text-sm leading-relaxed">
                This permanently removes your account and all associated data —
                orders, cart, and reward points — from our records. This action
                <strong className="text-text-primary"> cannot be undone</strong>.
              </p>
            </div>
          </div>

          {deletePhase === 'idle' && (
            <button
              onClick={() => setDeletePhase('confirm')}
              className="btn-danger w-full py-2.5 font-semibold text-sm"
            >
              Delete My Account
            </button>
          )}

          {(deletePhase === 'confirm' || deletePhase === 'deleting') && (
            <div className="space-y-3 animate-fade-in">
              {/* Error banner */}
              {deleteError && (
                <div
                  className="px-4 py-3 rounded-lg border text-sm"
                  style={{
                    background: 'rgba(230,126,128,0.08)',
                    borderColor: 'rgba(230,126,128,0.3)',
                    color: '#E67E80',
                  }}
                  role="alert"
                >
                  {deleteError}
                </div>
              )}

              {/* Confirmation input */}
              <div>
                <label
                  htmlFor="confirm-delete"
                  className="block text-text-muted text-xs font-medium mb-1.5 uppercase tracking-wider"
                >
                  Type{' '}
                  <span
                    className="font-mono normal-case"
                    style={{ color: '#E67E80' }}
                  >
                    delete my account
                  </span>{' '}
                  to confirm
                </label>
                <input
                  id="confirm-delete"
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="delete my account"
                  className="input text-sm"
                  disabled={deletePhase === 'deleting'}
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => void handleDeleteConfirm()}
                  disabled={!confirmReady || deletePhase === 'deleting'}
                  className="btn-danger flex-1 py-2.5 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deletePhase === 'deleting'
                    ? 'Deleting…'
                    : '🗑 Permanently Delete'}
                </button>
                <button
                  onClick={() => {
                    setDeletePhase('idle')
                    setConfirmInput('')
                    setDeleteError(null)
                  }}
                  disabled={deletePhase === 'deleting'}
                  className="btn-ghost text-sm px-4 py-2.5"
                >
                  Cancel
                </button>
              </div>

              <p className="text-text-muted text-xs text-center">
                You will be immediately signed out after deletion.
              </p>
            </div>
          )}
        </Section>

      </div>
    </div>
  )
}
