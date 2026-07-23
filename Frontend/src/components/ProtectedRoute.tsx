// frontend/src/components/ProtectedRoute.tsx
// =============================================================================
// Protected Route Wrapper — Canopy Restaurant Manager
// =============================================================================
// Wraps any route that requires authentication or a specific role.
//
// Usage in App.tsx:
//   <ProtectedRoute>               ← any logged-in user
//     <CustomerChatPage />
//   </ProtectedRoute>
//
//   <ProtectedRoute requiredRole="manager">   ← managers only
//     <ManagerDashboardPage />
//   </ProtectedRoute>
//
// Per RULES.md § D-3: "The frontend may hide/show UI based on role, but the
// backend is the real gatekeeper." This component handles cosmetic routing
// only — the API calls inside each page still validate the JWT server-side.
// =============================================================================

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, type UserRole } from '@/context/AuthContext'

interface Props {
  /** Optional: restrict to a specific role. Omit to allow any authenticated user. */
  requiredRole?: UserRole
  children: React.ReactNode
}

export default function ProtectedRoute({ requiredRole, children }: Props) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  // While auth state is being restored from localStorage, render nothing.
  // This prevents a flash of the login page on hard refresh.
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-text-muted text-sm">Loading…</span>
      </div>
    )
  }

  // Not logged in → redirect to /login, preserving the intended destination
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Logged in but wrong role (e.g., customer trying to access /manager)
  if (requiredRole && user.role !== requiredRole) {
    const fallback = user.role === 'manager' ? '/manager' : '/chat'
    return <Navigate to={fallback} replace />
  }

  return <>{children}</>
}
