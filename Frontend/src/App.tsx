// frontend/src/App.tsx
// =============================================================================
// App — Root Component with React Router
// =============================================================================
// Sets up:
//   • AuthProvider — wraps the entire tree with authentication state
//   • BrowserRouter — enables client-side routing
//   • All 8 page routes from PHASES.md § 4.4
//   • ProtectedRoute guards for customer and manager routes
//   • HealthCheck panel (Phase 4 dev tool — rendered in a corner overlay)
//
// Route Map (PHASES.md § 4.4):
//   /                    → LoginPage
//   /chat                → CustomerChatPage       (requires: any logged-in user)
//   /order-status        → OrderStatusPage        (requires: any logged-in user)
//   /rewards             → RewardsPage            (requires: any logged-in user)
//   /manager             → ManagerDashboardPage   (requires: role=manager)
//   /manager/inventory   → ManagerInventoryPage   (requires: role=manager)
//   /manager/history     → ManagerHistoryPage     (requires: role=manager)
//   /manager/analytics   → ManagerAnalyticsPage   (requires: role=manager)
// =============================================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import HealthCheck from '@/components/HealthCheck'

// Pages
import LoginPage              from '@/pages/LoginPage'
import CustomerChatPage       from '@/pages/CustomerChatPage'
import OrderStatusPage        from '@/pages/OrderStatusPage'
import RewardsPage            from '@/pages/RewardsPage'
import ManagerDashboardPage   from '@/pages/ManagerDashboardPage'
import ManagerInventoryPage   from '@/pages/ManagerInventoryPage'
import ManagerHistoryPage     from '@/pages/ManagerHistoryPage'
import ManagerAnalyticsPage   from '@/pages/ManagerAnalyticsPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public ──────────────────────────────────────────────────── */}
          <Route path="/" element={<LoginPage />} />

          {/* ── Customer Routes (any authenticated user) ─────────────────── */}
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <CustomerChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/order-status"
            element={
              <ProtectedRoute>
                <OrderStatusPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rewards"
            element={
              <ProtectedRoute>
                <RewardsPage />
              </ProtectedRoute>
            }
          />

          {/* ── Manager Routes (role=manager only) ───────────────────────── */}
          <Route
            path="/manager"
            element={
              <ProtectedRoute requiredRole="manager">
                <ManagerDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/inventory"
            element={
              <ProtectedRoute requiredRole="manager">
                <ManagerInventoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/history"
            element={
              <ProtectedRoute requiredRole="manager">
                <ManagerHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/analytics"
            element={
              <ProtectedRoute requiredRole="manager">
                <ManagerAnalyticsPage />
              </ProtectedRoute>
            }
          />

          {/* ── Catch-all — redirect unknown paths to home ───────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* ── Phase 4 Dev Tool: HealthCheck overlay ───────────────────────
            Displays the backend connection status in the bottom-right corner.
            Remove this block (or set VITE_SHOW_HEALTH_CHECK=false) once
            Phase 4 is confirmed complete and the backend is stable.
        ─────────────────────────────────────────────────────────────────── */}
        {import.meta.env.DEV && (
          <div className="fixed bottom-4 right-4 z-50">
            <HealthCheck />
          </div>
        )}
      </BrowserRouter>
    </AuthProvider>
  )
}
