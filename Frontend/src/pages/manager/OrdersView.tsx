// frontend/src/pages/manager/OrdersView.tsx
// =============================================================================
// OrdersView — Pending Orders Dashboard (The HITL Core)
// =============================================================================
// This is the centrepiece of the manager experience. It displays every order
// in PENDING_APPROVAL status and lets the manager approve or reject them with
// one click, resolving the LangGraph interrupt() on the backend.
//
// Behaviour:
//   • Fetches GET /manager/orders?status=PENDING_APPROVAL on mount.
//   • Polls every 10 seconds for new orders (live queue feel).
//   • Approve → POST /manager/orders/{id}/approve  (awards reward points)
//   • Reject  → POST /manager/orders/{id}/reject   (shows optional reason input)
//   • After approve/reject the card fades out and is removed from the list.
//
// Data shape (from backend):
//   Order { id, status, total_amount, submitted_at, customer: { email },
//           items: [{ name, quantity, unit_price }] }
//
// Design:
//   Premium Everforest cards. Approve = accent-green. Reject = danger-red.
//   Rejection reason: inline textarea that expands when Reject is clicked.
//   Empty state: encouraging message — "All caught up!"
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type CanopyApiError } from '@/api/client'
import LoadingSpinner from '@/components/LoadingSpinner'
import StatusBadge from '@/components/StatusBadge'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderItem {
  name: string
  quantity: number
  unit_price: number
}

interface PendingOrder {
  id: number
  status: string
  total_amount: number
  submitted_at: string
  customer: { email: string }
  items: OrderItem[]
}

interface OrdersResponse {
  orders: PendingOrder[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

// ---------------------------------------------------------------------------
// Order Card sub-component
// ---------------------------------------------------------------------------

function OrderCard({
  order,
  onApprove,
  onReject,
  isActing,
}: {
  order: PendingOrder
  onApprove: (id: number) => void
  onReject: (id: number, reason: string) => void
  isActing: boolean
}) {
  const [rejectMode, setRejectMode] = useState(false)
  const [reason, setReason] = useState('')

  const handleRejectSubmit = () => {
    onReject(order.id, reason)
  }

  return (
    <div
      className="card p-5 flex flex-col gap-4 transition-all duration-300"
      style={{ borderLeft: '3px solid #DBBC7F' }}
      role="article"
      aria-label={`Pending order #${order.id}`}
    >
      {/* ── Card Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-text-muted text-xs">#{order.id}</span>
            <StatusBadge status={order.status as never} />
          </div>
          <p className="text-text-heading font-semibold text-sm truncate max-w-xs">
            {order.customer?.email ?? 'Unknown customer'}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-text-heading font-mono font-bold text-base">
            ₹{order.total_amount.toFixed(2)}
          </p>
          <p className="text-text-muted text-xs">{timeAgo(order.submitted_at)}</p>
        </div>
      </div>

      {/* ── Item List ───────────────────────────────────────────────── */}
      <div className="bg-bg-elevated rounded-lg px-4 py-3 space-y-1.5">
        {order.items.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-text-primary">
              <span className="text-text-muted font-mono text-xs mr-2">×{item.quantity}</span>
              {item.name}
            </span>
            <span className="text-text-muted font-mono text-xs">
              ₹{(item.unit_price * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* ── Rejection Reason Input (expands on Reject click) ────────── */}
      {rejectMode && (
        <div className="animate-fade-in">
          <label className="block text-text-muted text-xs font-medium mb-1.5 uppercase tracking-wider">
            Rejection reason <span className="normal-case opacity-60">(optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Item out of stock, kitchen unavailable…"
            rows={2}
            className="input resize-none text-sm"
            autoFocus
          />
        </div>
      )}

      {/* ── Action Buttons ──────────────────────────────────────────── */}
      <div className="flex gap-2 pt-1">
        {!rejectMode ? (
          <>
            <button
              onClick={() => onApprove(order.id)}
              disabled={isActing}
              className="btn-primary flex-1 text-sm py-2 font-semibold"
            >
              {isActing ? '…' : '✓ Approve'}
            </button>
            <button
              onClick={() => setRejectMode(true)}
              disabled={isActing}
              className="btn-danger flex-1 text-sm py-2 font-semibold"
            >
              ✗ Reject
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleRejectSubmit}
              disabled={isActing}
              className="btn-danger flex-1 text-sm py-2 font-semibold"
            >
              {isActing ? '…' : 'Confirm Reject'}
            </button>
            <button
              onClick={() => { setRejectMode(false); setReason('') }}
              disabled={isActing}
              className="btn-ghost text-sm py-2 px-4"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main View
// ---------------------------------------------------------------------------

export default function OrdersView() {
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingIds, setActingIds] = useState<Set<number>>(new Set())
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      // Backend: GET /manager/orders?status=PENDING_APPROVAL
      const data = await api.get<OrdersResponse>('/manager/orders', {
        status: 'PENDING_APPROVAL',
      })
      setOrders(data.orders ?? [])
      setLastRefreshed(new Date())
      setError(null)
    } catch (err: unknown) {
      const apiErr = err as CanopyApiError
      setError(apiErr.friendlyMessage ?? 'Could not load orders.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial fetch + 10-second polling
  useEffect(() => {
    void fetchOrders()
    pollRef.current = setInterval(() => void fetchOrders(), 10_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchOrders])

  const handleApprove = async (id: number) => {
    setActingIds((s) => new Set(s).add(id))
    try {
      await api.post(`/manager/orders/${id}/approve`)
      setOrders((prev) => prev.filter((o) => o.id !== id))
    } catch (err: unknown) {
      const apiErr = err as CanopyApiError
      setError(apiErr.friendlyMessage ?? 'Could not approve order.')
    } finally {
      setActingIds((s) => { const n = new Set(s); n.delete(id); return n })
    }
  }

  const handleReject = async (id: number, reason: string) => {
    setActingIds((s) => new Set(s).add(id))
    try {
      await api.post(`/manager/orders/${id}/reject`, { rejection_reason: reason || null })
      setOrders((prev) => prev.filter((o) => o.id !== id))
    } catch (err: unknown) {
      const apiErr = err as CanopyApiError
      setError(apiErr.friendlyMessage ?? 'Could not reject order.')
    } finally {
      setActingIds((s) => { const n = new Set(s); n.delete(id); return n })
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-text-heading text-2xl mb-0.5">
            Pending Orders
          </h1>
          <p className="text-text-muted text-sm">
            {orders.length > 0
              ? `${orders.length} order${orders.length !== 1 ? 's' : ''} awaiting your review`
              : 'All orders reviewed'}
            {' · '}
            <span className="text-text-muted text-xs">
              Auto-refreshes every 10s · Last: {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </p>
        </div>
        <button
          onClick={() => void fetchOrders()}
          className="btn-ghost text-xs px-3 py-1.5"
          title="Refresh now"
        >
          ↺ Refresh
        </button>
      </div>

      {/* ── Error ───────────────────────────────────────────────────── */}
      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-lg border text-sm"
          style={{ background: 'rgba(230, 126, 128, 0.08)', borderColor: 'rgba(230, 126, 128, 0.3)', color: '#E67E80' }}
          role="alert"
        >
          {error}
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : orders.length === 0 ? (
        /* ── Empty State ─────────────────────────────────────────── */
        <div className="card py-16 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-display text-text-heading text-lg font-semibold mb-1">
            All caught up!
          </p>
          <p className="text-text-muted text-sm">No orders waiting for approval right now.</p>
        </div>
      ) : (
        /* ── Order Cards ─────────────────────────────────────────── */
        <div className="space-y-4">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onApprove={(id) => void handleApprove(id)}
              onReject={(id, reason) => void handleReject(id, reason)}
              isActing={actingIds.has(order.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
