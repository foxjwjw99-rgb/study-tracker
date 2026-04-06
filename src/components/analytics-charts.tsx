"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type {
  AccuracyTrendPoint,
  VocabularyDailyTrendPoint,
  VocabularyStatusDistributionItem,
} from "@/types"

const tooltipStyle = {
  borderRadius: "18px",
  border: "1px solid color-mix(in oklab, var(--color-border) 88%, transparent)",
  background: "color-mix(in oklab, var(--color-card) 96%, white)",
  boxShadow: "0 16px 40px rgba(76,95,140,0.12)",
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "#94a3b8",
  LEARNING: "#f59e0b",
  FAMILIAR: "#22c55e",
}

export function AccuracyChart({ data }: { data: AccuracyTrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 16, left: -16, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}%`}
          domain={[0, 100]}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [`${Number(value ?? 0)}%`, "正確率"]}
        />
        <Line
          type="monotone"
          dataKey="accuracy"
          stroke="currentColor"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
          className="stroke-primary"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function VocabularyStatusChart({ data }: { data: VocabularyStatusDistributionItem[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [`${Number(value ?? 0)} 個`, "單字數"]}
        />
        <Legend verticalAlign="bottom" height={24} />
        <Pie data={data} dataKey="count" nameKey="label" innerRadius={58} outerRadius={90} paddingAngle={3}>
          {data.map((entry) => (
            <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  )
}

export function VocabularyTrendChart({ data }: { data: VocabularyDailyTrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 16, left: -16, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend verticalAlign="top" height={28} />
        <Bar dataKey="reviewedWords" name="複習單字數" radius={[8, 8, 0, 0]} fill="#6366f1" />
        <Bar dataKey="reviewCount" name="複習次數" radius={[8, 8, 0, 0]} fill="#22c55e" />
      </BarChart>
    </ResponsiveContainer>
  )
}
