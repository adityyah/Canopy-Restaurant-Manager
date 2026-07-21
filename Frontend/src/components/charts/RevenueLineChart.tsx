// frontend/src/components/charts/RevenueLineChart.tsx
// Phase 4 skeleton — receives data as a prop, renders the chart.
// Full wiring implemented in Phase 5 (§ 5.7).
// Per DESIGN.md: line color = accent-green (#A7C080).

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'

export interface RevenueDataPoint {
  date: string      // e.g. "2026-07-10"
  revenue: number   // total approved revenue for that day
}

interface Props {
  data: RevenueDataPoint[]
  isLoading?: boolean
}

export default function RevenueLineChart({ data, isLoading }: Props) {
  if (isLoading) {
    return <div className="skeleton h-64 w-full rounded-card" />
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#475258" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#9DA9A0', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#9DA9A0', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `₹${v}`}
        />
        <Tooltip
          contentStyle={{ background: '#343F44', border: '1px solid #475258', borderRadius: 8 }}
          labelStyle={{ color: '#D3C6AA' }}
          itemStyle={{ color: '#A7C080' }}
          formatter={(value: number) => [`₹${value.toFixed(2)}`, 'Revenue']}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#A7C080"   /* accent-green per DESIGN.md */
          strokeWidth={2}
          dot={{ fill: '#A7C080', r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
