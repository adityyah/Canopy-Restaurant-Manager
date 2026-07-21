// frontend/src/components/charts/TopItemsPieChart.tsx
// Phase 4 skeleton — receives data as a prop, renders the chart.
// Full wiring implemented in Phase 5 (§ 5.7).
// Per DESIGN.md: use Everforest greens/teals cycling for slices.

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

export interface TopItemDataPoint {
  item_name: string
  total_ordered: number
}

interface Props {
  data: TopItemDataPoint[]
  isLoading?: boolean
}

// Everforest slice palette — cycles for up to 8 items
const SLICE_COLORS = [
  '#A7C080', // accent-green
  '#83C092', // accent-teal
  '#7FBBB3', // accent-blue
  '#DBBC7F', // warning-yellow
  '#D699B6', // pink (from Everforest)
  '#E69875', // orange
  '#5C6A72', // grey-green
  '#475258', // bg-border
]

export default function TopItemsPieChart({ data, isLoading }: Props) {
  if (isLoading) {
    return <div className="skeleton h-64 w-full rounded-card" />
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total_ordered"
          nameKey="item_name"
          cx="50%"
          cy="45%"
          outerRadius={90}
          label={({ name, percent }) =>
            `${name} ${(percent * 100).toFixed(0)}%`
          }
          labelLine={{ stroke: '#475258' }}
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={SLICE_COLORS[index % SLICE_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#343F44', border: '1px solid #475258', borderRadius: 8 }}
          labelStyle={{ color: '#D3C6AA' }}
          itemStyle={{ color: '#D3C6AA' }}
          formatter={(value: number) => [value, 'Orders']}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: '#9DA9A0', paddingTop: 8 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
