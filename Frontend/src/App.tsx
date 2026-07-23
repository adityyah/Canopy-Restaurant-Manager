// frontend/src/App.tsx
// =============================================================================
// App — Root Component with React Router
// =============================================================================
// Route map:
//   /                    → redirect: managers → /manager, customers → /chat
//   /login               → Login page (public)
//   /chat                → CustomerTerminal (any logged-in user)
//   /order-status        → OrderStatusPage  (any logged-in user, stub)
//   /rewards             → RewardsPage      (any logged-in user, stub)
//   /settings            → AccountSettings  (any logged-in user)
//   /manager             → ManagerLayout > OrdersView
//   /manager/inventory   → ManagerLayout > InventoryView
//   /manager/insights    → ManagerLayout > InsightsView
//   *                    → redirect to /
//
// Auth flow:
//   • AuthProvider reads the session from localStorage on mount.
//   • SmartRedirect (/) checks user.role and sends to the right home.
//   • ProtectedRoute guards /chat and /manager/* — redirects to /login.
//   • ManagerLayout has its own role guard for the manager subtree.
// =============================================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'


// Layouts
import ManagerLayout from '@/layouts/ManagerLayout'

// Pages — Auth
import Login from '@/pages/Login'

// Pages — Customer
import CustomerTerminal from '@/pages/CustomerTerminal'
import OrderStatusPage  from '@/pages/OrderStatusPage'
import RewardsPage      from '@/pages/RewardsPage'
import AccountSettings  from '@/pages/AccountSettings'

// Pages — Manager (nested under ManagerLayout)
import OrdersView    from '@/pages/manager/OrdersView'
import InventoryView from '@/pages/manager/InventoryView'
import InsightsView  from '@/pages/manager/InsightsView'

// ---------------------------------------------------------------------------
// SmartRedirect — sends logged-in users to the right home, guests to /login
// ---------------------------------------------------------------------------

function SmartRedirect() {
  const { user, isLoading } = useAuth()

  // Don't redirect while auth is still loading from localStorage
  if (isLoading) return null

  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'manager') return <Navigate to="/manager" replace />
  return <Navigate to="/chat" replace />
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Root — smart redirect based on role ─────────────────── */}
          <Route path="/" element={<SmartRedirect />} />

          {/* ── Public ──────────────────────────────────────────────── */}
          <Route path="/login" element={<Login />} />

          {/* ── Customer routes (any authenticated user) ─────────────── */}
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <CustomerTerminal />
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
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AccountSettings />
              </ProtectedRoute>
            }
          />

          {/* ── Manager routes — nested under ManagerLayout ──────────── */}
          {/*
            ManagerLayout renders the nav + <Outlet />.
            ProtectedRoute here checks auth; ManagerLayout checks role.
            Both guard independently for belt-and-suspenders security.
          */}
          <Route
            path="/manager"
            element={
              <ProtectedRoute requiredRole="manager">
                <ManagerLayout />
              </ProtectedRoute>
            }
          >
            {/* /manager          → OrdersView (index route — pending approvals) */}
            <Route index            element={<OrdersView />} />
            {/* /manager/inventory → InventoryView */}
            <Route path="inventory" element={<InventoryView />} />
            {/* /manager/insights  → InsightsView */}
            <Route path="insights"  element={<InsightsView />} />
          </Route>

          {/* ── Catch-all ────────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
