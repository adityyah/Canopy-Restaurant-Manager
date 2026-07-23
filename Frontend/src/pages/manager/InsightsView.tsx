// frontend/src/pages/manager/InsightsView.tsx
// =============================================================================
// InsightsView — AI Inventory & Operations Advisory
// =============================================================================
// Calls GET /manager/insights and renders:
//   1. A prominent "AI Advisory" card with the GPT-4o-mini generated text.
//   2. A structured low-stock items table from the raw backend data.
//   3. A pending orders count badge.
//
// Backend response shape (InsightsResponse):
//   {
//     summary: string            — 2-sentence AI advisory
//     low_stock_items: [{ name, category, stock_quantity }]
//     pending_order_count: number
//   }
//
// Design intent:
//   The AI card feels like a printed briefing note — generous padding,
//   Playfair Display for the heading, Inter body text, a subtle left
//   accent-green border. No glowing "AI slop". No orbs.
//   The raw data below gives the manager confidence that the AI text
//   is grounded in real numbers.
// =============================================================================

import { useCallback, useEffect, useState } from 'react'
import { api, type CanopyApiError } from '@/api/client'
import LoadingSpinner from '@/components/LoadingSpinner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LowStockItem {
  name: string
  category: string
  stock_quantity: number
}

interface InsightsData {
  summary: string
  low_stock_items: LowStockItem[]
  pending_order_count: number
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** The AI advisory card — the hero of this page */
function AdvisoryCard({ summary, isLoading }: { summary: string; isLoading: boolean }) {
  return (
    <div
      className="card px-6 py-5 relative overflow-hidden"
      style={{ borderLeft: '4px solid #A7C080' }}
    >
      {/* Faint background texture */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 0% 50%, rgba(167,192,128,0.05) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🤖</span>
          <div>
            <h2 className="font-display font-bold text-text-heading text-lg leading-tight">
              AI Advisory
            </h2>
            <p className="text-text-muted text-xs">
              Powered by GPT-4o-mini · Based on live inventory data
            </p>
          </div>
        </div>

        {/* Advisory text */}
        {isLoading ? (
          <div className="space-y-3">
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-5/6 rounded" />
          </div>
        ) : (
          <p
            className="text-text-primary text-sm leading-relaxed"
            style={{ fontStyle: 'normal' }}
          >
            {summary}
          </p>
        )}
      </div>
    </div>
  )
}

/** Low-stock items table */
function LowStockTable({ items, isLoading }: { items: LowStockItem[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="card p-5 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-full rounded" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="card px-5 py-8 text-center">
        <p className="text-2xl mb-2">✅</p>
        <p className="text-text-heading font-semibold text-sm">All items well-stocked</p>
        <p className="text-text-muted text-xs mt-1">No items with fewer than 5 units in stock.</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden" style={{ padding: 0 }}>
      {/* Header */}
      <div
        className="grid px-5 py-3 border-b border-bg-border text-text-muted text-xs font-semibold uppercase tracking-widest"
        style={{ background: '#3D484D', gridTemplateColumns: '2fr 1fr 1fr' }}
      >
        <span>Item</span>
        <span>Category</span>
        <span>In Stock</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-bg-border">
        {items.map((item) => (
          <div
            key={item.name}
            className="grid items-center px-5 py-3 hover:bg-bg-elevated transition-colors duration-100"
            style={{
              gridTemplateColumns: '2fr 1fr 1fr',
              borderLeft: item.stock_quantity === 0 ? '4px solid #E67E80' : '4px solid #DBBC7F',
            }}
          >
            <span className="text-text-primary text-sm font-medium">{item.name}</span>
            <span className="text-text-muted text-sm">{item.category}</span>
            <span
              className="font-mono font-bold text-sm"
              style={{ color: item.stock_quantity === 0 ? '#E67E80' : '#DBBC7F' }}
            >
              {item.stock_quantity === 0 ? '✗ None' : item.stock_quantity}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main View
// ---------------------------------------------------------------------------

export default function InsightsView() {
  const [data, setData] = useState<InsightsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchInsights = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const result = await api.get<InsightsData>('/manager/insights')
      setData(result)
    } catch (err: unknown) {
      const apiErr = err as CanopyApiError
      setError(apiErr.friendlyMessage ?? 'Could not load insights.')
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchInsights()
  }, [fetchInsights])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display font-bold text-text-heading text-2xl mb-0.5">
            AI Insights
          </h1>
          <p className="text-text-muted text-sm">
            Live inventory advisory generated by GPT-4o-mini
          </p>
        </div>
        <button
          onClick={() => void fetchInsights(true)}
          disabled={isLoading || refreshing}
          className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5"
        >
          {refreshing ? <LoadingSpinner size="sm" /> : '↺'} Regenerate
        </button>
      </div>

      {/* ── Error ───────────────────────────────────────────────────── */}
      {error && (
        <div
          className="px-4 py-3 rounded-lg border text-sm"
          style={{ background: 'rgba(230,126,128,0.08)', borderColor: 'rgba(230,126,128,0.3)', color: '#E67E80' }}
          role="alert"
        >
          {error}
        </div>
      )}

      {/* ── Stats bar ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label: 'Pending Approvals',
            value: isLoading ? '…' : String(data?.pending_order_count ?? 0),
            color: '#DBBC7F',
            bg: 'rgba(219,188,127,0.08)',
            border: 'rgba(219,188,127,0.25)',
          },
          {
            label: 'Low-Stock Items',
            value: isLoading ? '…' : String(data?.low_stock_items.length ?? 0),
            color: data?.low_stock_items.length === 0 ? '#A7C080' : '#E67E80',
            bg: data?.low_stock_items.length === 0 ? 'rgba(167,192,128,0.08)' : 'rgba(230,126,128,0.08)',
            border: data?.low_stock_items.length === 0 ? 'rgba(167,192,128,0.25)' : 'rgba(230,126,128,0.25)',
          },
        ].map(({ label, value, color, bg, border }) => (
          <div
            key={label}
            className="card px-5 py-4"
            style={{ background: bg, borderColor: border }}
          >
            <p className="font-mono font-bold text-3xl" style={{ color }}>
              {value}
            </p>
            <p className="text-text-muted text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── AI Advisory ─────────────────────────────────────────────── */}
      <AdvisoryCard summary={data?.summary ?? ''} isLoading={isLoading} />

      {/* ── Low-Stock Table ──────────────────────────────────────────── */}
      <div>
        <h2 className="text-text-heading font-semibold text-sm mb-3 flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: '#DBBC7F' }}
          />
          Items Needing Attention
        </h2>
        <LowStockTable
          items={data?.low_stock_items ?? []}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}
