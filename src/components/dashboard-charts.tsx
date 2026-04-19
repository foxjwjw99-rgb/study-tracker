"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

type TrendData = {
  date: string
  minutes: number
}

type SubjectData = {
  subject: string
  minutes: number
}

const axisStyle = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 12,
}

const tooltipStyle = {
  borderRadius: "18px",
  border: "1px solid color-mix(in oklab, var(--color-border) 88%, transparent)",
  background: "color-mix(in oklab, var(--color-card) 96%, white)",
  boxShadow: "var(--shadow-brand-deep)",
}

export function TrendChart({ data }: { data: TrendData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barCategoryGap="24%">
        <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} {...axisStyle} />
        <YAxis
          tickLine={false}
          axisLine={false}
          {...axisStyle}
          tickFormatter={(value) => `${value}m`}
        />
        <Tooltip
          cursor={{ fill: "color-mix(in oklab, var(--color-primary) 10%, transparent)" }}
          contentStyle={tooltipStyle}
        />
        <Bar dataKey="minutes" fill="var(--color-chart-1)" radius={[10, 10, 4, 4]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function SubjectChart({ data }: { data: SubjectData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" barCategoryGap="20%" margin={{ left: 8 }}>
        <CartesianGrid horizontal={false} stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          {...axisStyle}
          tickFormatter={(value) => `${value}m`}
        />
        <YAxis
          type="category"
          dataKey="subject"
          tickLine={false}
          axisLine={false}
          width={72}
          {...axisStyle}
        />
        <Tooltip
          cursor={{ fill: "color-mix(in oklab, var(--color-secondary) 20%, transparent)" }}
          contentStyle={tooltipStyle}
        />
        <Bar dataKey="minutes" fill="var(--color-chart-3)" radius={[0, 10, 10, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
