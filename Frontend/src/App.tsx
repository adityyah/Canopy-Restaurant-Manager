// frontend/src/App.tsx
// =============================================================================
// App — Root Component with React Router
// =============================================================================
// ── DEVELOPMENT NOTE (Phase 5 preview) ──────────────────────────────────────
// The LoginPage / Auth flow is built in Phase 6. For now, CustomerTerminal
// is mounted directly at "/" so we can interact with the full UI immediately.
//
// Current route map (dev preview):
//   /                    → CustomerTerminal        ← ACTIVE — no auth gate
//   /login               → LoginPage              ← future home of auth
//   /order-status        → OrderStatusPage        (stub)
//   /rewards             → RewardsPage            (stub)
//   /manager             → ManagerDashboardPage   (stub)
//   /manager/inventory   → ManagerInventoryPage   (stub)
//   /manager/history     → ManagerHistoryPage     (stub)
//   /manager/analytics   → ManagerAnalyticsPage   (stub)
//
// When Phase 6 (auth) lands, swap the "/" route back to <LoginPage /> and
// restore ProtectedRoute guards on /chat, /order-status, and /rewards.
// =============================================================================

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import HealthCheck from '@/components/HealthCheck'

// Pages
import CustomerTerminal     from '@/pages/CustomerTerminal'
import LoginPage            from '@/pages/LoginPage'
import OrderStatusPage      from '@/pages/OrderStatusPage'
import RewardsPage          from '@/pages/RewardsPage'
import ManagerDashboardPage from '@/pages/ManagerDashboardPage'
import ManagerInventoryPage from '@/pages/ManagerInventoryPage'
import ManagerHistoryPage   from '@/pages/ManagerHistoryPage'
import ManagerAnalyticsPage from '@/pages/ManagerAnalyticsPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Phase 5 Preview: CustomerTerminal at root ──────────────── */}
          {/* Swap back to <LoginPage /> when Phase 6 auth is complete.     */}
          <Route path="/"             element={<CustomerTerminal />} />
          <Route path="/login"        element={<LoginPage />} />

          {/* ── Customer routes (stubs — will get ProtectedRoute in P6) ── */}
          <Route path="/chat"         element={<CustomerTerminal />} />
          <Route path="/order-status" element={<OrderStatusPage />} />
          <Route path="/rewards"      element={<RewardsPage />} />

          {/* ── Manager routes (stubs — will get ProtectedRoute in P6) ── */}
          <Route path="/manager"            element={<ManagerDashboardPage />} />
          <Route path="/manager/inventory"  element={<ManagerInventoryPage />} />
          <Route path="/manager/history"    element={<ManagerHistoryPage />} />
          <Route path="/manager/analytics"  element={<ManagerAnalyticsPage />} />
        </Routes>

        {/* ── HealthCheck — small floating widget (dev only) ──────────────
            Sits in the bottom-right corner at z-50, completely unobtrusive.
            Only renders when Vite's DEV mode is active (not in prod builds).
        ──────────────────────────────────────────────────────────────────── */}
        {import.meta.env.DEV && (
          <div className="fixed bottom-4 right-4 z-50 w-64">
            <HealthCheck />
          </div>
        )}
      </BrowserRouter>
    </AuthProvider>
  )
}
