// frontend/src/components/customer/MenuDisplay.tsx
// =============================================================================
// MenuDisplay — Restaurant Menu Grid
// =============================================================================
// Fetches the live menu from GET /menu (public endpoint) and renders items
// in premium Everforest-themed cards.
//
// Design intent (DESIGN.md § 4.3):
//   • bg-surface cards with 12px border radius and a subtle shadow
//   • On hover: border transitions to accent-teal (no background change)
//   • Low-stock warning (< 5) shown with a warning-yellow left accent
//   • Dietary badges (veg/vegan/spicy) use the Everforest accent palette
//   • "Add to Order" passes a natural language string up to the parent
//     so ChatInterface can pre-fill its input — keeps the chat as the
//     single source of truth for orders.
//
// Category filter tabs let the customer browse by section without scrolling
// through the entire menu.
// =============================================================================

import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import LoadingSpinner from '@/components/LoadingSpinner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MenuItem {
  id: number
  name: string
  description: string | null
  price: number
  category: string
  stock_quantity: number
  is_active: boolean
  is_vegetarian: boolean
  is_vegan: boolean
  is_spicy: boolean
  is_daily_delight: boolean
}

interface Props {
  /** Called when the user clicks "Add to Order" — parent injects the string into chat */
  onAddToOrder: (message: string) => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_ORDER = ['All', 'Starters', 'Mains', 'Desserts', 'Beverages']

const LOW_STOCK_THRESHOLD = 5

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Dietary badge pill */
function DietaryBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide"
      style={{
        background: `${color}18`,
        color,
        border: `1px solid ${color}30`,
      }}
    >
      {label}
    </span>
  )
}

/** Category filter tab */
function CategoryTab({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap
        ${
          active
            ? 'bg-accent-green text-bg-base'
            : 'bg-bg-elevated text-text-muted border border-bg-border hover:text-text-primary hover:border-accent-teal'
        }`}
    >
      {label}
    </button>
  )
}

/** Skeleton card shown while loading */
function MenuCardSkeleton() {
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="skeleton h-5 w-3/4 rounded" />
      <div className="skeleton h-3 w-full rounded" />
      <div className="skeleton h-3 w-2/3 rounded" />
      <div className="flex justify-between items-center mt-auto pt-2">
        <div className="skeleton h-5 w-16 rounded" />
        <div className="skeleton h-8 w-24 rounded-lg" />
      </div>
    </div>
  )
}

/** Individual menu item card */
function MenuCard({ item, onAddToOrder }: { item: MenuItem; onAddToOrder: Props['onAddToOrder'] }) {
  const isLowStock = item.stock_quantity > 0 && item.stock_quantity <= LOW_STOCK_THRESHOLD
  const isOutOfStock = item.stock_quantity === 0 || !item.is_active

  return (
    <div
      className="card p-5 flex flex-col gap-2.5 transition-all duration-150 group relative overflow-hidden"
      style={{
        // Low-stock rows get the warning-yellow left accent — DESIGN.md § 4.8
        borderLeft: isLowStock ? '3px solid #DBBC7F' : undefined,
        background: isLowStock ? 'rgba(219, 188, 127, 0.03)' : undefined,
        opacity: isOutOfStock ? 0.55 : 1,
      }}
      role="article"
      aria-label={`${item.name} menu item`}
    >
      {/* Daily Delight ribbon */}
      {item.is_daily_delight && (
        <div
          className="absolute top-0 right-0 px-2.5 py-0.5 text-xs font-bold tracking-wider"
          style={{
            background: 'rgba(167, 192, 128, 0.2)',
            color: '#A7C080',
            borderBottomLeftRadius: '8px',
            borderTop: '1px solid rgba(167,192,128,0.3)',
            borderRight: '1px solid rgba(167,192,128,0.3)',
          }}
        >
          ★ TODAY'S DELIGHT
        </div>
      )}

      {/* Name + category */}
      <div>
        <h3
          className="text-text-heading font-semibold text-sm leading-snug
                     group-hover:text-accent-green transition-colors duration-150"
        >
          {item.name}
        </h3>
        <span className="text-text-muted text-xs">{item.category}</span>
      </div>

      {/* Description */}
      {item.description && (
        <p className="text-text-muted text-xs leading-relaxed line-clamp-2">
          {item.description}
        </p>
      )}

      {/* Dietary badges */}
      <div className="flex flex-wrap gap-1.5">
        {item.is_vegan && <DietaryBadge label="Vegan" color="#A7C080" />}
        {!item.is_vegan && item.is_vegetarian && <DietaryBadge label="Veg" color="#83C092" />}
        {item.is_spicy && <DietaryBadge label="Spicy 🌶" color="#E67E80" />}
      </div>

      {/* Stock warning */}
      {isLowStock && (
        <p className="text-xs font-medium" style={{ color: '#DBBC7F' }}>
          ⚠ Only {item.stock_quantity} left
        </p>
      )}

      {/* Price + CTA */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-bg-border">
        <span className="font-mono font-semibold text-text-heading text-sm">
          ₹{item.price.toFixed(2)}
        </span>

        {isOutOfStock ? (
          <span className="text-text-muted text-xs italic">Out of stock</span>
        ) : (
          <button
            onClick={() =>
              onAddToOrder(`I would like to order one ${item.name}`)
            }
            className="btn-primary text-xs px-3 py-1.5 font-semibold tracking-wide"
            aria-label={`Add ${item.name} to your order`}
          >
            + Add to Order
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function MenuDisplay({ onAddToOrder }: Props) {
  const [items, setItems] = useState<MenuItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('All')

  useEffect(() => {
    const fetchMenu = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await api.get<MenuItem[]>('/menu')
        // Only show active items to customers (backend should enforce this too)
        setItems(data.filter((item) => item.is_active))
      } catch {
        setError('Could not load the menu. Please refresh the page.')
      } finally {
        setIsLoading(false)
      }
    }
    void fetchMenu()
  }, [])

  // Derive available categories from actual data
  const availableCategories = [
    'All',
    ...CATEGORY_ORDER.slice(1).filter((cat) =>
      items.some((item) => item.category === cat),
    ),
  ]

  const filteredItems =
    activeCategory === 'All'
      ? items
      : items.filter((item) => item.category === activeCategory)

  // Sort: daily delight first, then alphabetical
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (a.is_daily_delight && !b.is_daily_delight) return -1
    if (!a.is_daily_delight && b.is_daily_delight) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* ── Section header ──────────────────────────────────────────── */}
      <div>
        <h2 className="text-text-heading font-semibold text-base mb-0.5">Our Menu</h2>
        <p className="text-text-muted text-xs">
          {isLoading
            ? 'Loading…'
            : `${filteredItems.length} item${filteredItems.length !== 1 ? 's' : ''} available`}
        </p>
      </div>

      {/* ── Category filter tabs ─────────────────────────────────────── */}
      {!isLoading && !error && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {availableCategories.map((cat) => (
            <CategoryTab
              key={cat}
              label={cat}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
            />
          ))}
        </div>
      )}

      {/* ── States ─────────────────────────────────────────────────── */}
      {error && (
        <div
          className="px-4 py-3 rounded-lg border text-sm"
          style={{
            background: 'rgba(230, 126, 128, 0.08)',
            borderColor: 'rgba(230, 126, 128, 0.3)',
            color: '#E67E80',
          }}
        >
          {error}
        </div>
      )}

      {/* ── Menu grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 overflow-y-auto pr-0.5">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <MenuCardSkeleton key={i} />)
          : sortedItems.map((item) => (
              <MenuCard key={item.id} item={item} onAddToOrder={onAddToOrder} />
            ))}

        {/* Empty state for a category with no items */}
        {!isLoading && !error && sortedItems.length === 0 && (
          <div className="col-span-2 py-12 text-center">
            <p className="text-text-muted text-sm">No items in this category right now.</p>
          </div>
        )}
      </div>
    </div>
  )
}
