// frontend/src/components/charts/InventoryBarChart.tsx
// Phase 4 skeleton — receives data as a prop, renders the chart.
// Full wiring implemented in Phase 5 (§ 5.7).
// Per DESIGN.md / PHASES.md § 5.7:
//   • Default bars: accent-green (#A7C080)
//   • Low-stock bars (is_low_stock=true): warning-yellow (#DBBC7F)
//   • Dashed reference line at stock_quantity=5 labelled "Low Stock Threshold"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Cell, ResponsiveContainer
} from 'recharts'

export interface InventoryDataPoint {
  item_name: string
  stock_quantity: number
  is_low_stock: boolean
}

interface Props {
  data: InventoryDataPoint[]
  isLoading?: boolean
}

const COLOR_NORMAL   = '#A7C080'  // accent-green
const COLOR_LOW      = '#DBBC7F'  // warning-yellow
const LOW_THRESHOLD  = 5

export default function InventoryBarChart({ data, isLoading }: Props) {
  if (isLoading) {
    return <div className="skeleton h-64 w-full rounded-card" />
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#475258" />
        <XAxis
          dataKey="item_name"
          tick={{ fill: '#9DA9A0', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          tick={{ fill: '#9DA9A0', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{ background: '#343F44', border: '1px solid #475258', borderRadius: 8 }}
          labelStyle={{ color: '#D3C6AA' }}
          itemStyle={{ color: '#D3C6AA' }}
          formatter={(value: number) => [value, 'In stock']}
        />
        {/* Low stock threshold reference line */}
        <ReferenceLine
          y={LOW_THRESHOLD}
          stroke="#DBBC7F"
          strokeDasharray="4 4"
          label={{ value: 'Low Stock Threshold', fill: '#DBBC7F', fontSize: 10 }}
        />
        <Bar dataKey="stock_quantity" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.is_low_stock ? COLOR_LOW : COLOR_NORMAL}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
