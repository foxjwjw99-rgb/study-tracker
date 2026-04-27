"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export type SnapshotChartPoint = {
  date: string
  median: number
  conservative: number
  optimistic: number
}

type SnapshotChartProps = {
  data: SnapshotChartPoint[]
  lastYearLine: number
}

export default function SnapshotChart({ data, lastYearLine }: SnapshotChartProps) {
  return (
    <ResponsiveContainer width="100%" height={160} debounce={50}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="medianGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          domain={[
            (min: number) => Math.max(0, Math.floor(min - 5)),
            (max: number) => Math.min(100, Math.ceil(max + 5)),
          ]}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(value, name) => {
            const labels: Record<string, string> = { median: "中位", conservative: "保守", optimistic: "樂觀" }
            return [value, labels[String(name)] ?? name]
          }}
        />
        <Area
          type="monotone"
          dataKey="conservative"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={1}
          strokeDasharray="4 2"
          fill="transparent"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="median"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#medianGrad)"
          dot={{ r: 3, fill: "hsl(var(--primary))" }}
        />
        <Area
          type="monotone"
          dataKey="optimistic"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={1}
          strokeDasharray="4 2"
          fill="transparent"
          dot={false}
        />
        {lastYearLine > 0 && (
          <ReferenceLine
            y={lastYearLine}
            stroke="hsl(var(--destructive))"
            strokeDasharray="3 3"
            label={{ value: "上榜線", position: "right", fontSize: 10 }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}
