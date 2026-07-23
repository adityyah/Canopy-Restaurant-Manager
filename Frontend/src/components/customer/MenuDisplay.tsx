// frontend/src/components/customer/MenuDisplay.tsx
// =============================================================================
// MenuDisplay — Fine-Dining Menu Presentation (Phase 7.2 Overhaul)
// =============================================================================
// Layout:
//   1. "OUR MENU CATEGORIES" section — centered Playfair heading, decorative
//      divider, horizontal scroll row of circular category avatar chips.
//   2. "CHEF'S RECOMMENDATIONS" section — 3-column premium card grid.
//
// Card anatomy:
//   ┌─────────────────────────────────────────┐
//   │  [image — large, w-full]                │
//   │  ← [Bestseller / New] badge (absolute)  │
//   ├─────────────────────────────────────────┤
//   │  Dish Name (Playfair, left)             │
//   │  Short description (muted, truncated)   │
//   │  ★★★★★  4.8                            │
//   │  ─────────────────────────────────────  │
//   │  [+ Add to Order button]       ₹ 000   │
//   └─────────────────────────────────────────┘
//
// Theme: Everforest dark (#2D353B, #D3C6AA, #A7C080, #E69875, #DBBC7F)
// =============================================================================

import { useEffect, useState } from 'react'
import { api } from '@/api/client'

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
  image_url: string | null
}

interface Props {
  onAddToOrder: (message: string) => void
}

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

// Ordered display list — used for both the avatar strip and filter tabs.
const CATEGORY_META: { name: string; emoji: string; image: string }[] = [
  {
    name: 'Starters',
    emoji: '🥗',
    image:
      'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'Mains',
    emoji: '🍛',
    image:
      'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'Desserts',
    emoji: '🍮',
    image:
      'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'Beverages',
    emoji: '☕',
    image:
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=200&q=80',
  },
]

const LOW_STOCK_THRESHOLD = 5

// Fallback placeholder images per category
const PLACEHOLDER_MAP: Record<string, string> = {
  Starters:
    'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?auto=format&fit=crop&q=80&w=800',
  Mains:
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800',
  Desserts:
    'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&q=80&w=800',
  Beverages:
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=800',
}
// ---------------------------------------------------------------------------
// ItemImage — crash-safe image with an Everforest CSS placeholder
// ---------------------------------------------------------------------------
// Rules:
//   • If item.image_url is null/undefined → show placeholder immediately.
//   • If the URL resolves but the image 404s or fails → onError → placeholder.
//   • Placeholder: dark box, centred initial letter + a subtle plate glyph.
//   No external network calls are needed for the placeholder path.

// ---------------------------------------------------------------------------
// Dietary badge pill
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// ItemImage — crash-safe image sub-component
// ---------------------------------------------------------------------------

function ItemImage({ name, imageUrl }: { name: string; imageUrl: string | null | undefined }) {
  const [failed, setFailed] = useState(false)

  // Resolve the full URL — handles both /static/... paths and absolute URLs.
  const src =
    imageUrl && imageUrl.trim() !== ''
      ? imageUrl.startsWith('http')
        ? imageUrl
        : `http://127.0.0.1:8000${imageUrl}`
      : null

  // If there's no src or the img already errored, render the CSS placeholder.
  if (!src || failed) {
    const initial = name.charAt(0).toUpperCase()
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-2 select-none"
        style={{ background: '#374145' }}
        aria-label={`${name} placeholder image`}
      >
        {/* Decorative plate circle */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
          style={
            {
              background: 'rgba(167,192,128,0.08)',
              border: '1.5px solid rgba(167,192,128,0.18)',
            }
          }
        >
          🍽
        </div>
        {/* Dish initial in Playfair */}
        <span
          className="font-display font-bold"
          style={{ color: 'rgba(167,192,128,0.35)', fontSize: '2.5rem', lineHeight: 1 }}
        >
          {initial}
        </span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
    />
  )
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function MenuCardSkeleton() {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl"
      style={{ background: '#343F44', border: '1px solid #475258' }}
    >
      <div className="skeleton" style={{ height: '200px', width: '100%' }} />
      <div className="p-5 flex flex-col gap-3">
        <div className="skeleton h-5 w-3/4 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-bg-border">
          <div className="skeleton h-6 w-20 rounded" />
          <div className="skeleton h-9 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Premium Menu Card
// ---------------------------------------------------------------------------

function MenuCard({
  item,
  onAddToOrder,
}: {
  item: MenuItem
  onAddToOrder: Props['onAddToOrder']
}) {
  const [quantity, setQuantity] = useState(1)
  const isLowStock = item.stock_quantity > 0 && item.stock_quantity <= LOW_STOCK_THRESHOLD
  const isOutOfStock = item.stock_quantity === 0 || !item.is_active

  const handleAdd = () => {
    onAddToOrder(`I would like to order ${quantity} ${item.name}`)
    setQuantity(1)
  }

  return (
    <article
      className="flex flex-col overflow-hidden rounded-2xl group transition-all duration-300"
      style={{
        background: '#343F44',
        border: `1px solid ${isLowStock ? 'rgba(219,188,127,0.35)' : '#475258'}`,
        boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        opacity: isOutOfStock ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'
        ;(e.currentTarget as HTMLElement).style.boxShadow =
          '0 12px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(167,192,128,0.15)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.25)'
      }}
      aria-label={`${item.name} menu item`}
    >
      {/* ── Top image (crash-safe) ────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ height: '200px', flexShrink: 0 }}>
        <ItemImage name={item.name} imageUrl={item.image_url} />

        {/* Gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, transparent 50%, rgba(52,63,68,0.85) 100%)',
          }}
        />

        {/* ── Absolute badge tags (top-left) ────────────────────────── */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {item.is_daily_delight && (
            <span
              className="px-2.5 py-1 text-xs font-bold tracking-wider rounded-md shadow-md"
              style={{ background: '#DBBC7F', color: '#2D353B' }}
            >
              ★ BESTSELLER
            </span>
          )}
          {item.is_vegan && (
            <span
              className="px-2.5 py-1 text-xs font-bold tracking-wider rounded-md shadow-md"
              style={{ background: '#A7C080', color: '#2D353B' }}
            >
              VEGAN
            </span>
          )}
          {isLowStock && !isOutOfStock && (
            <span
              className="px-2.5 py-1 text-xs font-bold tracking-wider rounded-md shadow-md"
              style={{ background: '#E69875', color: '#2D353B' }}
            >
              ⚡ LAST {item.stock_quantity}
            </span>
          )}
        </div>

        {/* Category pill — top right */}
        <span
          className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{
            background: 'rgba(45,53,59,0.75)',
            color: '#9DA9A0',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(71,82,88,0.5)',
          }}
        >
          {item.category}
        </span>
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-5 gap-2">
        {/* Dish name */}
        <h3
          className="font-display font-semibold leading-snug group-hover:transition-colors"
          style={{
            fontSize: '1.1rem',
            color: '#D3C6AA',
          }}
        >
          {item.name}
        </h3>

        {/* Description */}
        {item.description && (
          <p
            className="text-xs leading-relaxed line-clamp-2"
            style={{ color: '#859289' }}
          >
            {item.description}
          </p>
        )}

        {/* 5-star rating */}
        <div className="flex items-center gap-1.5 text-xs">
          <span style={{ color: '#DBBC7F', letterSpacing: '0.08em' }}>★★★★★</span>
          <span style={{ color: '#859289' }}>(4.8)</span>
        </div>

        {/* Dietary badges */}
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          {item.is_vegan && <DietaryBadge label="Vegan" color="#A7C080" />}
          {!item.is_vegan && item.is_vegetarian && (
            <DietaryBadge label="Vegetarian" color="#83C092" />
          )}
          {item.is_spicy && <DietaryBadge label="Spicy 🌶" color="#E69875" />}
        </div>

        {/* ── Bottom row: Price + CTA ──────────────────────────────────── */}
        <div
          className="flex items-center justify-between mt-auto pt-4 border-t"
          style={{ borderColor: 'rgba(71,82,88,0.5)' }}
        >
          {/* Price */}
          <span
            className="font-display font-bold text-xl"
            style={{ color: '#D3C6AA' }}
          >
            ₹{Number(item.price).toFixed(2)}
          </span>

          {/* CTA */}
          {isOutOfStock ? (
            <span className="text-xs italic" style={{ color: '#859289' }}>
              Out of stock
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <div 
                className="flex items-center gap-2 rounded-lg px-1.5 py-1"
                style={{ 
                  background: 'rgba(71,82,88,0.2)', 
                  border: '1px solid rgba(71,82,88,0.4)' 
                }}
              >
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-6 h-6 flex items-center justify-center text-xl pb-1 rounded hover:bg-bg-elevated transition-colors"
                  style={{ color: '#859289' }}
                  aria-label="Decrease quantity"
                >
                  -
                </button>
                <span className="text-sm font-medium w-4 text-center select-none" style={{ color: '#D3C6AA' }}>
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(q => Math.min(item.stock_quantity, q + 1))}
                  className="w-6 h-6 flex items-center justify-center text-lg pb-0.5 rounded hover:bg-bg-elevated transition-colors"
                  style={{ color: '#859289' }}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <button
                onClick={handleAdd}
                className="px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200"
                style={{
                  background: 'transparent',
                  color: '#A7C080',
                  border: '1px solid rgba(167,192,128,0.5)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#A7C080'
                  e.currentTarget.style.color = '#2D353B'
                  e.currentTarget.style.borderColor = '#A7C080'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#A7C080'
                  e.currentTarget.style.borderColor = 'rgba(167,192,128,0.5)'
                }}
                aria-label={`Add ${quantity} ${item.name} to your order`}
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// Category Avatar Strip
// ---------------------------------------------------------------------------

function CategoryStrip({
  availableCategories,
  activeCategory,
  onSelect,
}: {
  availableCategories: string[]
  activeCategory: string
  onSelect: (cat: string) => void
}) {
  const displayCats =
    availableCategories.length > 0
      ? CATEGORY_META.filter((m) => availableCategories.includes(m.name))
      : CATEGORY_META

  return (
    <div className="mb-16">
      {/* Section header */}
      <div className="flex flex-col items-center mb-10">
        <span
          className="text-xs font-semibold tracking-[0.22em] uppercase mb-3"
          style={{ color: '#DBBC7F' }}
        >
          Browse By Category
        </span>
        <h2
          className="font-display font-bold mb-4"
          style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', color: '#D3C6AA' }}
        >
          Our Menu Categories
        </h2>
        {/* Decorative divider */}
        <div className="flex items-center gap-3">
          <span className="block h-px w-12" style={{ background: '#DBBC7F', opacity: 0.5 }} />
          <span style={{ color: '#DBBC7F', fontSize: '18px' }}>✦</span>
          <span className="block h-px w-12" style={{ background: '#DBBC7F', opacity: 0.5 }} />
        </div>
      </div>

      {/* Circular avatar row */}
      <div className="flex items-start justify-center gap-8 lg:gap-14 flex-wrap">
        {/* "All" option */}
        <button
          onClick={() => onSelect('All')}
          className="flex flex-col items-center gap-3 group"
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all duration-300"
            style={{
              background:
                activeCategory === 'All'
                  ? 'rgba(167,192,128,0.15)'
                  : 'rgba(71,82,88,0.4)',
              border:
                activeCategory === 'All'
                  ? '2px solid #A7C080'
                  : '2px solid rgba(71,82,88,0.6)',
              boxShadow:
                activeCategory === 'All'
                  ? '0 0 20px rgba(167,192,128,0.25)'
                  : 'none',
            }}
          >
            🍽
          </div>
          <span
            className="text-xs font-semibold tracking-wide transition-colors"
            style={{
              color: activeCategory === 'All' ? '#A7C080' : '#859289',
            }}
          >
            All Items
          </span>
        </button>

        {displayCats.map((cat) => {
          const isActive = activeCategory === cat.name
          return (
            <button
              key={cat.name}
              onClick={() => onSelect(cat.name)}
              className="flex flex-col items-center gap-3 group"
            >
              <div
                className="w-20 h-20 rounded-full overflow-hidden transition-all duration-300"
                style={{
                  border: isActive
                    ? '2px solid #A7C080'
                    : '2px solid rgba(71,82,88,0.6)',
                  boxShadow: isActive
                    ? '0 0 20px rgba(167,192,128,0.3), 0 4px 16px rgba(0,0,0,0.35)'
                    : '0 4px 12px rgba(0,0,0,0.25)',
                }}
              >
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <span
                className="text-xs font-semibold tracking-wide transition-colors"
                style={{ color: isActive ? '#A7C080' : '#859289' }}
              >
                {cat.name}
              </span>
            </button>
          )
        })}
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
        setItems(data.filter((item) => item.is_active))
      } catch {
        setError('Could not load the menu. Please refresh the page.')
      } finally {
        setIsLoading(false)
      }
    }
    void fetchMenu()
  }, [])

  const availableCategories = CATEGORY_META.map((m) => m.name).filter((cat) =>
    items.some((item) => item.category === cat),
  )

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
    <div>
      {/* ── 1. Category Avatar Strip ─────────────────────────────────────── */}
      {!isLoading && !error && (
        <CategoryStrip
          availableCategories={availableCategories}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />
      )}

      {/* ── 2. Chef's Recommendations section header ──────────────────────── */}
      <div className="flex flex-col items-center mb-10">
        <span
          className="text-xs font-semibold tracking-[0.22em] uppercase mb-3"
          style={{ color: '#DBBC7F' }}
        >
          {activeCategory === 'All' ? 'Curated Selection' : activeCategory}
        </span>
        <h2
          className="font-display font-bold mb-4"
          style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', color: '#D3C6AA' }}
        >
          {activeCategory === 'All' ? "Chef's Recommendations" : `${activeCategory} Menu`}
        </h2>
        <div className="flex items-center gap-3">
          <span className="block h-px w-12" style={{ background: '#DBBC7F', opacity: 0.5 }} />
          <span style={{ color: '#DBBC7F', fontSize: '18px' }}>✦</span>
          <span className="block h-px w-12" style={{ background: '#DBBC7F', opacity: 0.5 }} />
        </div>
        {!isLoading && (
          <p className="text-text-muted text-sm mt-4">
            {sortedItems.length} dish{sortedItems.length !== 1 ? 'es' : ''} available
          </p>
        )}
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div
          className="max-w-md mx-auto px-4 py-3 rounded-lg border text-sm text-center mb-8"
          style={{
            background: 'rgba(230,126,128,0.08)',
            borderColor: 'rgba(230,126,128,0.3)',
            color: '#E67E80',
          }}
        >
          {error}
        </div>
      )}

      {/* ── 3. Menu card grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <MenuCardSkeleton key={i} />)
          : sortedItems.map((item) => (
              <MenuCard key={item.id} item={item} onAddToOrder={onAddToOrder} />
            ))}

        {/* Empty state */}
        {!isLoading && !error && sortedItems.length === 0 && (
          <div className="col-span-3 py-16 text-center">
            <p className="font-display text-xl mb-2" style={{ color: '#D3C6AA' }}>
              No dishes here yet.
            </p>
            <p className="text-text-muted text-sm">
              Check back soon or browse another category.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
