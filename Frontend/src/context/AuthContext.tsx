// frontend/src/context/AuthContext.tsx
// =============================================================================
// Auth Context — Canopy Restaurant Manager
// =============================================================================
// Wraps the entire application and provides:
//   • The current logged-in user (or null if unauthenticated)
//   • login(), logout(), signup() functions
//   • A loading state so child components know when auth is still resolving
//
// Storage contract:
//   • JWT is stored in localStorage under the key 'canopy_jwt'
//   • User object is stored in localStorage under 'canopy_user'
//   • The Axios client (api/client.ts) reads 'canopy_jwt' automatically
//
// Per RULES.md § D-3: "The frontend may hide/show UI based on role, but the
// backend is the real gatekeeper." AuthContext only performs cosmetic routing —
// every API call still validates the token server-side.
// =============================================================================

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { api, type CanopyApiError } from '@/api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole = 'customer' | 'manager'

export interface AuthUser {
  id: string        // UUID from Supabase (matches local users.id)
  email: string
  role: UserRole
}

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount: restore the session from localStorage if it exists.
  // This prevents a flash-of-login-page on page reload.
  useEffect(() => {
    const storedUser = localStorage.getItem('canopy_user')
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as AuthUser)
      } catch {
        // Corrupt data — clear it
        localStorage.removeItem('canopy_user')
        localStorage.removeItem('canopy_jwt')
      }
    }
    setIsLoading(false)
  }, [])

  // Listen for the session-expired event dispatched by the Axios interceptor.
  // When the JWT is rejected by the backend (401), we clear local state.
  useEffect(() => {
    const handleExpiry = () => {
      setUser(null)
      localStorage.removeItem('canopy_user')
      localStorage.removeItem('canopy_jwt')
    }
    window.addEventListener('canopy:session-expired', handleExpiry)
    return () => window.removeEventListener('canopy:session-expired', handleExpiry)
  }, [])

  // ── login ──────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    // Step 1: exchange credentials for a JWT
    const loginResp = await api.post<{ access_token: string; user: { id: string; email: string } }>(
      '/auth/login',
      { email, password },
    )
    // Store JWT immediately so the next request has it in its interceptor
    localStorage.setItem('canopy_jwt', loginResp.access_token)

    // Step 2: fetch the full profile (includes role) from our local backend
    const me = await api.get<AuthUser>('/auth/me')

    // Store the complete user object and update state
    localStorage.setItem('canopy_user', JSON.stringify(me))
    setUser(me)
  }, [])

  // ── signup ─────────────────────────────────────────────────────────────
  // NOTE: POST /auth/signup returns { message, user_id, email } — NOT a JWT.
  // Supabase requires email confirmation before the user can log in, so we
  // never auto-login here. The Login page shows a success banner and switches
  // the form back to 'login' mode.
  const signup = useCallback(async (email: string, password: string) => {
    await api.post<{ message: string; user_id: string; email: string }>(
      '/auth/signup',
      { email, password },
    )
    // No JWT or user object is returned — caller must switch to login mode.
  }, [])

  // ── logout ─────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      const token = localStorage.getItem('canopy_jwt')
      await api.post('/auth/logout', { access_token: token || '' })
    } catch {
      // Even if the server call fails, clear local state.
    } finally {
      localStorage.removeItem('canopy_jwt')
      localStorage.removeItem('canopy_user')
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Call inside any component to access the current user and auth functions. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth() must be used inside <AuthProvider>.')
  }
  return ctx
}
