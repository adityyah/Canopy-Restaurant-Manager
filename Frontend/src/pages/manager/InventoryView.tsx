// frontend/src/pages/manager/InventoryView.tsx
// =============================================================================
// InventoryView — Menu & Inventory Management
// =============================================================================
// Displays all menu items (including inactive ones) in a clean data table.
// The manager can see stock levels at a glance and set the Daily Delight.
//
// Endpoints used:
//   GET  /manager/menu                 — fetch all items (incl. inactive)
//   POST /manager/menu/auto-delight    — assign the Daily Delight (Phase 3.5)
//
// Table columns: Name · Category · Price · Stock · Status · Daily Delight
//
// Design:
//   Per DESIGN.md § 4.8 table rules:
//     - bg-elevated header row, text-muted 12px uppercase labels
//     - bg-surface body rows, 1px border-bg-border between rows
//     - Low-stock rows: 4px warning-yellow left border + faint yellow tint
//   The "Set Daily Delight" CTA is a prominent accent-green button at the top.
// =============================================================================

import { useCallback, useEffect, useState } from 'react'
import { api, type CanopyApiError } from '@/api/client'
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

interface DelightResponse {
  id: number
  name: string
  message: string
}

interface ImageUploadResponse {
  message: string
  image_url: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LOW_STOCK = 5

function StockPill({ qty }: { qty: number }) {
  if (qty === 0) {
    return (
      <span className="badge" style={{ background: 'rgba(230,126,128,0.12)', color: '#E67E80' }}>
        Out of stock
      </span>
    )
  }
  if (qty <= LOW_STOCK) {
    return (
      <span className="badge" style={{ background: 'rgba(219,188,127,0.12)', color: '#DBBC7F' }}>
        ⚠ {qty} left
      </span>
    )
  }
  return <span className="font-mono text-text-primary text-sm">{qty}</span>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InventoryView() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [delightLoading, setDelightLoading] = useState(false)
  const [delightResult, setDelightResult] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [editStock, setEditStock] = useState<number>(0)
  const [editActive, setEditActive] = useState<boolean>(true)
  
  // Add New Item state
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Mains',
    stock_quantity: '',
    is_active: true,
    is_vegetarian: false,
    is_vegan: false,
    is_spicy: false,
  })
  const [newItemImage, setNewItemImage] = useState<File | null>(null)

  const handleEditClick = (item: MenuItem) => {
    setEditingItem(item)
    setEditStock(item.stock_quantity)
    setEditActive(item.is_active)
  }

  const submitEdit = async () => {
    if (!editingItem) return
    setError(null)
    try {
      await api.patch(`/manager/menu/${editingItem.id}`, {
        stock_quantity: editStock,
        is_active: editActive,
      })
      await fetchMenu()
    } catch (err: unknown) {
      const apiErr = err as CanopyApiError
      setError(apiErr.friendlyMessage ?? 'Could not update item.')
    } finally {
      setEditingItem(null)
    }
  }

  const fetchMenu = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.get<MenuItem[]>('/manager/menu')
      // Sort: daily delight first, then by category + name
      setItems(
        [...data].sort((a, b) => {
          if (a.is_daily_delight !== b.is_daily_delight)
            return a.is_daily_delight ? -1 : 1
          if (a.category !== b.category) return a.category.localeCompare(b.category)
          return a.name.localeCompare(b.name)
        }),
      )
    } catch (err: unknown) {
      const apiErr = err as CanopyApiError
      setError(apiErr.friendlyMessage ?? 'Could not load menu items.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchMenu()
  }, [fetchMenu])

  const handleAutoDelight = async () => {
    setDelightLoading(true)
    setDelightResult(null)
    try {
      const data = await api.post<DelightResponse>('/manager/menu/auto-delight')
      setDelightResult(data.message)
      await fetchMenu() // Refresh table to show updated ribbon
    } catch (err: unknown) {
      const apiErr = err as CanopyApiError
      setDelightResult(`Error: ${apiErr.friendlyMessage ?? 'Could not set Daily Delight.'}`)
    } finally {
      setDelightLoading(false)
    }
  }

  const handleImageUpload = async (itemId: number, file: File) => {
    setError(null)
    const formData = new FormData()
    formData.append('file', file)

    try {
      await api.post<ImageUploadResponse>(`/manager/menu/${itemId}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      await fetchMenu()
    } catch (err: unknown) {
      const apiErr = err as CanopyApiError
      setError(apiErr.friendlyMessage ?? 'Could not upload image.')
    }
  }

  const submitNewItem = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    
    try {
      // 1. Create item
      const createdItem = await api.post<MenuItem>('/manager/menu', {
        name: newItem.name,
        description: newItem.description || null,
        price: parseFloat(newItem.price) || 0,
        category: newItem.category,
        stock_quantity: parseInt(newItem.stock_quantity) || 0,
        is_active: newItem.is_active,
        is_vegetarian: newItem.is_vegetarian,
        is_vegan: newItem.is_vegan,
        is_spicy: newItem.is_spicy, // Maps to backend schema if needed (backend has is_gluten_free)
      })

      // 2. Upload image if selected
      if (newItemImage) {
        const formData = new FormData()
        formData.append('file', newItemImage)
        await api.post(`/manager/menu/${createdItem.id}/image`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      }

      setDelightResult(`Successfully added ${createdItem.name}!`)
      setShowAddModal(false)
      
      // Reset form
      setNewItem({
        name: '', description: '', price: '', category: 'Mains', stock_quantity: '',
        is_active: true, is_vegetarian: false, is_vegan: false, is_spicy: false
      })
      setNewItemImage(null)
      
      await fetchMenu()
    } catch (err: unknown) {
      const apiErr = err as CanopyApiError
      setError(apiErr.friendlyMessage ?? 'Failed to create menu item.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display font-bold text-text-heading text-2xl mb-0.5">
            Inventory & Menu
          </h1>
          <p className="text-text-muted text-sm">
            {isLoading ? 'Loading…' : `${items.length} items · ${items.filter(i => i.is_active).length} active`}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
            style={{ background: '#A7C080', color: '#2D353B', boxShadow: '0 2px 8px rgba(167,192,128,0.3)' }}
          >
            + Add New Item
          </button>
          
          {/* Daily Delight CTA */}
          <button
            onClick={() => void handleAutoDelight()}
            disabled={delightLoading || isLoading}
            className="btn-primary flex items-center gap-2 text-sm font-semibold px-4 py-2.5"
            style={{ boxShadow: '0 2px 8px rgba(167,192,128,0.3)' }}
          >
            {delightLoading ? (
              <><LoadingSpinner size="sm" /> Setting…</>
            ) : (
              <>★ Set Daily Delight</>
            )}
          </button>
        </div>
      </div>

      {/* Delight result banner */}
      {delightResult && (
        <div
          className="mb-4 px-4 py-3 rounded-lg border text-sm animate-fade-in"
          style={{
            background: delightResult.startsWith('Error')
              ? 'rgba(230,126,128,0.08)'
              : 'rgba(167,192,128,0.08)',
            borderColor: delightResult.startsWith('Error')
              ? 'rgba(230,126,128,0.3)'
              : 'rgba(167,192,128,0.3)',
            color: delightResult.startsWith('Error') ? '#E67E80' : '#A7C080',
          }}
        >
          {delightResult}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-lg border text-sm"
          style={{ background: 'rgba(230,126,128,0.08)', borderColor: 'rgba(230,126,128,0.3)', color: '#E67E80' }}
          role="alert"
        >
          {error}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div
          className="card overflow-hidden"
          style={{ padding: 0 }}
        >
          {/* Table header — DESIGN.md § 4.8 */}
          <div
            className="grid text-text-muted text-xs font-semibold uppercase tracking-widest px-5 py-3 border-b border-bg-border"
            style={{
              background: '#3D484D',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr',
            }}
          >
            <span>Item</span>
            <span>Category</span>
            <span>Price</span>
            <span>Stock</span>
            <span>Status</span>
            <span>Delight</span>
            <span className="text-center">Photo</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Table body */}
          <div className="divide-y divide-bg-border">
            {items.map((item) => {
              const isLow = item.stock_quantity > 0 && item.stock_quantity <= LOW_STOCK
              const isOut = item.stock_quantity === 0

              return (
                <div
                  key={item.id}
                  className="grid items-center px-5 py-3 hover:bg-bg-elevated transition-colors duration-100"
                  style={{
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr',
                    // DESIGN.md § 4.8 low-stock row
                    borderLeft: isLow || isOut
                      ? `4px solid ${isOut ? '#E67E80' : '#DBBC7F'}`
                      : '4px solid transparent',
                    background: (isLow && !isOut)
                      ? 'rgba(219,188,127,0.03)'
                      : undefined,
                  }}
                >
                  {/* Name */}
                  <div>
                    <p className="text-text-primary text-sm font-medium">{item.name}</p>
                    {item.is_daily_delight && (
                      <span className="text-accent-green text-xs font-semibold">★ Today's Delight</span>
                    )}
                  </div>

                  {/* Category */}
                  <span className="text-text-muted text-sm">{item.category}</span>

                  {/* Price */}
                  <span className="font-mono text-text-primary text-sm">₹{item.price.toFixed(2)}</span>

                  {/* Stock */}
                  <StockPill qty={item.stock_quantity} />

                  {/* Status */}
                  <span
                    className="badge text-xs"
                    style={
                      item.is_active
                        ? { background: 'rgba(167,192,128,0.12)', color: '#A7C080' }
                        : { background: 'rgba(157,169,160,0.1)', color: '#9DA9A0' }
                    }
                  >
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>

                  {/* Daily Delight indicator */}
                  <span className="text-sm">
                    {item.is_daily_delight ? '🌟' : <span className="text-text-muted">—</span>}
                  </span>

                  {/* Photo Upload */}
                  <div className="text-center">
                    <label className="cursor-pointer btn-ghost text-xs px-2 py-1 rounded inline-block border border-bg-border hover:border-accent-teal hover:text-accent-green transition-colors">
                      Upload
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleImageUpload(item.id, file)
                        }}
                      />
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="text-right">
                    <button
                      onClick={() => handleEditClick(item)}
                      className="btn-ghost text-xs px-3 py-1 rounded border border-bg-border hover:border-accent-gold hover:text-accent-gold transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {items.length === 0 && (
            <div className="py-12 text-center text-text-muted text-sm">
              No menu items found.
            </div>
          )}
        </div>
      )}
      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-xl shadow-2xl p-6 w-full max-w-sm border border-bg-border">
            <h3 className="text-lg font-display text-text-heading font-semibold mb-4">Edit {editingItem.name}</h3>
            
            <div className="mb-4">
              <label className="block text-sm text-text-muted mb-1">Stock Quantity</label>
              <input 
                type="number" 
                min="0"
                value={editStock}
                onChange={e => setEditStock(parseInt(e.target.value) || 0)}
                className="w-full bg-bg-elevated border border-bg-border rounded px-3 py-2 text-text-primary focus:border-accent-green outline-none"
              />
            </div>
            
            <div className="mb-6 flex items-center gap-3">
              <label className="text-sm text-text-muted">Is Active?</label>
              <input 
                type="checkbox" 
                checked={editActive}
                onChange={e => setEditActive(e.target.checked)}
                className="w-4 h-4 accent-accent-green"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setEditingItem(null)}
                className="btn-ghost px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={() => void submitEdit()}
                className="btn-primary px-4 py-2 text-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-bg-surface rounded-xl shadow-2xl w-full max-w-2xl border border-bg-border my-8">
            <div className="p-6 border-b border-bg-border">
              <h3 className="text-xl font-display text-text-heading font-semibold">Add New Menu Item</h3>
            </div>
            
            <form onSubmit={submitNewItem} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                
                {/* Left Column */}
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Name *</label>
                    <input 
                      required
                      type="text" 
                      value={newItem.name}
                      onChange={e => setNewItem({...newItem, name: e.target.value})}
                      className="w-full bg-bg-elevated border border-bg-border rounded px-3 py-2 text-text-primary focus:border-accent-green outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Description</label>
                    <textarea 
                      value={newItem.description}
                      onChange={e => setNewItem({...newItem, description: e.target.value})}
                      className="w-full bg-bg-elevated border border-bg-border rounded px-3 py-2 text-text-primary focus:border-accent-green outline-none min-h-[80px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">Price (₹) *</label>
                      <input 
                        required
                        type="number" 
                        step="0.01"
                        min="0"
                        value={newItem.price}
                        onChange={e => setNewItem({...newItem, price: e.target.value})}
                        className="w-full bg-bg-elevated border border-bg-border rounded px-3 py-2 text-text-primary focus:border-accent-green outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">Stock *</label>
                      <input 
                        required
                        type="number" 
                        min="0"
                        value={newItem.stock_quantity}
                        onChange={e => setNewItem({...newItem, stock_quantity: e.target.value})}
                        className="w-full bg-bg-elevated border border-bg-border rounded px-3 py-2 text-text-primary focus:border-accent-green outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Category *</label>
                    <select
                      value={newItem.category}
                      onChange={e => setNewItem({...newItem, category: e.target.value})}
                      className="w-full bg-bg-elevated border border-bg-border rounded px-3 py-2 text-text-primary focus:border-accent-green outline-none"
                    >
                      <option value="Starters">Starters</option>
                      <option value="Mains">Mains</option>
                      <option value="Desserts">Desserts</option>
                      <option value="Beverages">Beverages</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Image</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={e => setNewItemImage(e.target.files?.[0] || null)}
                      className="w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-bg-elevated file:text-text-primary hover:file:bg-bg-border transition-colors cursor-pointer"
                    />
                  </div>

                  <div className="mt-2 space-y-3 p-4 rounded bg-bg-elevated border border-bg-border">
                    <label className="flex items-center gap-3 text-sm text-text-primary cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newItem.is_active}
                        onChange={e => setNewItem({...newItem, is_active: e.target.checked})}
                        className="w-4 h-4 accent-accent-green"
                      />
                      Active (Visible to customers)
                    </label>
                    <label className="flex items-center gap-3 text-sm text-text-primary cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newItem.is_vegetarian}
                        onChange={e => setNewItem({...newItem, is_vegetarian: e.target.checked})}
                        className="w-4 h-4 accent-accent-green"
                      />
                      Vegetarian
                    </label>
                    <label className="flex items-center gap-3 text-sm text-text-primary cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newItem.is_vegan}
                        onChange={e => setNewItem({...newItem, is_vegan: e.target.checked})}
                        className="w-4 h-4 accent-accent-green"
                      />
                      Vegan
                    </label>
                    <label className="flex items-center gap-3 text-sm text-text-primary cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newItem.is_spicy}
                        onChange={e => setNewItem({...newItem, is_spicy: e.target.checked})}
                        className="w-4 h-4 accent-accent-green"
                      />
                      Spicy
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-bg-border">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-ghost px-5 py-2.5 text-sm"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2"
                >
                  {isSubmitting ? <><LoadingSpinner size="sm" /> Creating…</> : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
