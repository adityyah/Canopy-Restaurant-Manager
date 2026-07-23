// frontend/src/pages/Login.tsx
// =============================================================================
// Login Page — Canopy Restaurant Manager
// =============================================================================
// A premium, minimal login/signup screen using the Everforest dark palette.
//
// Flow:
//   1. User picks "Customer" or "Manager" via the toggle tab.
//   2. User submits email + password.
//   3. Calls AuthContext.login() → POST /auth/login via the Axios client.
//   4. On success: role is fetched from GET /auth/me, stored alongside the JWT.
//   5. Redirects managers → /manager, customers → /chat.
//
// The Customer/Manager toggle is purely presentational — both tabs hit the
// same backend route. The server determines the actual role.
//
// Design (DESIGN.md § 1):
//   Playfair Display heading, generous whitespace, no decorative clutter.
//   Active tab: solid accent-green bg. Inactive: ghost with muted label.
// =============================================================================

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { api, type CanopyApiError } from '@/api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode      = 'login' | 'signup'
type LoginType = 'customer' | 'manager'

interface MeResponse {
  id: string
  email: string
  role: 'customer' | 'manager'
  created_at: string
}

// ---------------------------------------------------------------------------
// Sub-component: Login type toggle tabs
// ---------------------------------------------------------------------------

function LoginTypeTabs({
  loginType,
  onChange,
}: {
  loginType: LoginType
  onChange: (t: LoginType) => void
}) {
  const tabs: { value: LoginType; label: string; icon: string }[] = [
    { value: 'customer', label: 'Customer',       icon: '🍽' },
    { value: 'manager',  label: 'Manager Portal', icon: '🌿' },
  ]

  return (
    <div
      className="flex rounded-xl p-1 mb-6"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      role="tablist"
      aria-label="Login type"
    >
      {tabs.map(({ value, label, icon }) => {
        const isActive = loginType === value
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(value)}
            className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
            style={
              isActive
                ? {
                    background: '#A7C080',
                    color: '#2D353B',
                    boxShadow: '0 2px 8px rgba(167,192,128,0.25)',
                  }
                : {
                    color: '#859289',
                    background: 'transparent',
                  }
            }
          >
            <span>{icon}</span>
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [loginType, setLoginType] = useState<LoginType>('customer')
  const [mode, setMode]           = useState<Mode>('login')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Clear error when user switches login type
  const handleTypeChange = (t: LoginType) => {
    setLoginType(t)
    setError(null)
    setSuccessMsg(null)
  }

  // ── Copy that changes based on the selected tab ────────────────────────

  const headingText = mode === 'signup'
    ? 'Create account.'
    : loginType === 'manager'
      ? 'Manager Portal'
      : 'Welcome back.'

  const subtitleText = mode === 'signup'
    ? 'Fill in the details below to get started.'
    : loginType === 'manager'
      ? 'Sign in to access the manager dashboard.'
      : 'Sign in to browse the menu and order.'

  const submitLabel = isLoading
    ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
    : (mode === 'login'
        ? (loginType === 'manager' ? 'Access Dashboard' : 'Sign In')
        : 'Create Account')

  // ── Form submit ────────────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setIsLoading(true)

    try {
      if (mode === 'signup') {
        // Pass the selected role so the backend assigns it at account creation.
        await api.post('/auth/signup', { email, password, requested_role: loginType })
        setSuccessMsg('Account created! Check your email to confirm, then sign in.')
        setMode('login')
        setIsLoading(false)
        return
      }

      // Login — AuthContext stores the JWT and base user object.
      await login(email, password)

      // Fetch the full user profile (includes role) from our backend.
      const me = await api.get<MeResponse>('/auth/me')

      // Redirect based on role (server is the source of truth, not the toggle).
      if (me.role === 'manager') {
        navigate('/manager', { replace: true })
      } else {
        navigate('/chat', { replace: true })
      }
    } catch (err: unknown) {
      const apiErr = err as CanopyApiError
      setError(apiErr.friendlyMessage ?? 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: '#2D353B' }}
    >
      {/* ── Brand ────────────────────────────────────────────────────── */}
      <div className="mb-8 text-center">
        <p className="font-display font-bold text-text-heading text-3xl mb-1">
          Canopy <span className="text-accent-green">🌿</span>
        </p>
        <p className="text-text-muted text-sm">AI-Powered Restaurant Manager</p>
      </div>

      {/* ── Card ─────────────────────────────────────────────────────── */}
      <div
        className="w-full max-w-sm card p-8"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
      >
        {/* ── Login type toggle (login mode only) ─────────────────── */}
        {mode === 'login' && (
          <LoginTypeTabs loginType={loginType} onChange={handleTypeChange} />
        )}

        {/* ── Heading ──────────────────────────────────────────────── */}
        <h1 className="font-display font-bold text-text-heading text-2xl mb-1">
          {headingText}
        </h1>
        <p className="text-text-muted text-sm mb-6">{subtitleText}</p>

        {/* ── Error banner ─────────────────────────────────────────── */}
        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-lg border text-sm"
            style={{
              background: 'rgba(230, 126, 128, 0.08)',
              borderColor: 'rgba(230, 126, 128, 0.3)',
              color: '#E67E80',
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        {/* ── Success banner ───────────────────────────────────────── */}
        {successMsg && (
          <div
            className="mb-4 px-4 py-3 rounded-lg border text-sm"
            style={{
              background: 'rgba(167, 192, 128, 0.08)',
              borderColor: 'rgba(167, 192, 128, 0.3)',
              color: '#A7C080',
            }}
            role="status"
          >
            {successMsg}
          </div>
        )}

        {/* ── Form ─────────────────────────────────────────────────── */}
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="email"
              className="block text-text-muted text-xs font-medium mb-1.5 uppercase tracking-wider"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input"
              disabled={isLoading}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-text-muted text-xs font-medium mb-1.5 uppercase tracking-wider"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            id="login-submit"
            disabled={isLoading || !email || !password}
            className="btn-primary w-full py-2.5 font-semibold mt-2"
          >
            {submitLabel}
          </button>
        </form>

        {/* ── Mode toggle ──────────────────────────────────────────── */}
        <p className="text-center text-text-muted text-sm mt-5">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}
            className="text-accent-teal hover:text-accent-green font-medium transition-colors duration-150"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <p className="text-text-muted text-xs mt-6">
        All orders require manager approval · Earn points with every meal
      </p>
    </div>
  )
}
