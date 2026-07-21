// frontend/src/components/StatusBadge.tsx
// Colored pill badge for order status values.
// Colors follow DESIGN.md § 2.3 strictly.

// Must match the backend's OrderStatus enum values (models/order.py)
export type OrderStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  DRAFT:            { label: 'Draft',    className: 'badge-draft'     },
  PENDING_APPROVAL: { label: 'Pending',  className: 'badge-pending'   },
  APPROVED:         { label: 'Approved', className: 'badge-approved'  },
  REJECTED:         { label: 'Rejected', className: 'badge-rejected'  },
  CANCELLED:        { label: 'Cancelled',className: 'badge-cancelled' },
}

interface Props {
  status: OrderStatus
}

export default function StatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'badge' }
  return <span className={config.className}>{config.label}</span>
}
