"use client"

import { useState, useCallback, useId } from "react"
import { create, all } from "mathjs"
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"

const math = create(all)

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
]

const tooltipStyle = {
  borderRadius: "14px",
  border: "1px solid color-mix(in oklab, var(--color-border) 88%, transparent)",
  background: "color-mix(in oklab, var(--color-card) 96%, white)",
  boxShadow: "var(--shadow-brand-deep)",
  fontSize: 12,
}

type DataPoint = { x: number; [key: string]: number | null }

function evaluateFunction(expr: string, xValues: number[]): Array<number | null> {
  try {
    const compiled = math.compile(expr)
    return xValues.map((x) => {
      try {
        const result = compiled.evaluate({ x })
        if (typeof result !== "number" || !isFinite(result)) return null
        return Math.round(result * 10000) / 10000
      } catch {
        return null
      }
    })
  } catch {
    return xValues.map(() => null)
  }
}

function buildChartData(
  expressions: string[],
  xMin: number,
  xMax: number,
  steps: number
): DataPoint[] {
  const dx = (xMax - xMin) / steps
  const xValues = Array.from({ length: steps + 1 }, (_, i) =>
    Math.round((xMin + i * dx) * 10000) / 10000
  )

  const evaluated = expressions.map((expr) => evaluateFunction(expr, xValues))

  return xValues.map((x, i) => {
    const point: DataPoint = { x }
    expressions.forEach((expr, j) => {
      point[`f${j}`] = evaluated[j][i]
    })
    return point
  })
}

function isValidExpression(expr: string): boolean {
  if (!expr.trim()) return false
  try {
    math.compile(expr).evaluate({ x: 1 })
    return true
  } catch {
    return false
  }
}

type FunctionEntry = { expr: string; error: string | null }

export function MathGraph() {
  const labelId = useId()
  const [functions, setFunctions] = useState<FunctionEntry[]>([
    { expr: "sin(x)", error: null },
  ])
  const [xMin, setXMin] = useState(-10)
  const [xMax, setXMax] = useState(10)
  const [yMin, setYMin] = useState<number | "auto">(-5)
  const [yMax, setYMax] = useState<number | "auto">(5)
  const [rangeError, setRangeError] = useState<string | null>(null)

  const validFunctions = functions
    .map((f) => f.expr.trim())
    .filter((expr, i) => expr && functions[i].error === null && isValidExpression(expr))

  const chartData =
    validFunctions.length > 0 && xMin < xMax
      ? buildChartData(validFunctions, xMin, xMax, 400)
      : []

  const updateExpr = useCallback((index: number, value: string) => {
    setFunctions((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f
        const trimmed = value.trim()
        let error: string | null = null
        if (trimmed && !isValidExpression(trimmed)) {
          error = "無效的表達式"
        }
        return { expr: value, error }
      })
    )
  }, [])

  const addFunction = useCallback(() => {
    setFunctions((prev) => [...prev, { expr: "", error: null }])
  }, [])

  const removeFunction = useCallback((index: number) => {
    setFunctions((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateXRange = (min: number, max: number) => {
    if (min >= max) {
      setRangeError("X 最小值必須小於最大值")
      return
    }
    setRangeError(null)
    setXMin(min)
    setXMax(max)
  }

  const updateYRange = (min: number | "auto", max: number | "auto") => {
    if (min !== "auto" && max !== "auto" && min >= max) {
      setRangeError("Y 最小值必須小於最大值")
      return
    }
    setRangeError(null)
    setYMin(min)
    setYMax(max)
  }

  const yDomain: [number | "auto", number | "auto"] = [yMin, yMax]

  return (
    <div className="space-y-6">
      {/* Function inputs */}
      <div className="space-y-3">
        <label className="text-sm font-medium" id={labelId}>
          函數（使用 x 作為變數，例如：sin(x)、x^2、log(x)）
        </label>
        {functions.map((f, index) => (
          <div key={index} className="flex items-center gap-2">
            <span
              className="min-w-[14px] h-3.5 w-3.5 rounded-full shrink-0"
              style={{ background: COLORS[index % COLORS.length] }}
            />
            <span className="shrink-0 text-sm text-muted-foreground w-6">
              f{index + 1}=
            </span>
            <div className="flex-1 relative">
              <input
                aria-labelledby={labelId}
                type="text"
                value={f.expr}
                onChange={(e) => updateExpr(index, e.target.value)}
                placeholder="例如：sin(x)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              {f.error && (
                <p className="mt-1 text-xs text-destructive">{f.error}</p>
              )}
            </div>
            {functions.length > 1 && (
              <button
                onClick={() => removeFunction(index)}
                className="shrink-0 text-muted-foreground hover:text-destructive text-lg leading-none transition-colors"
                aria-label="移除此函數"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {functions.length < 5 && (
          <button
            onClick={addFunction}
            className="text-sm text-primary hover:underline"
          >
            + 新增函數
          </button>
        )}
      </div>

      {/* Range controls */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <RangeInput
          label="X 最小值"
          value={xMin}
          onChange={(v) => updateXRange(v, xMax)}
        />
        <RangeInput
          label="X 最大值"
          value={xMax}
          onChange={(v) => updateXRange(xMin, v)}
        />
        <RangeInput
          label="Y 最小值"
          value={yMin === "auto" ? -5 : yMin}
          onChange={(v) => updateYRange(v, yMax)}
        />
        <RangeInput
          label="Y 最大值"
          value={yMax === "auto" ? 5 : yMax}
          onChange={(v) => updateYRange(yMin, v)}
        />
      </div>

      {rangeError && <p className="text-sm text-destructive">{rangeError}</p>}

      {/* Chart */}
      <div className="h-80 w-full">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" debounce={50}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="color-mix(in oklab, var(--color-border) 60%, transparent)"
              />
              <XAxis
                dataKey="x"
                type="number"
                domain={[xMin, xMax]}
                tickCount={9}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
                tickFormatter={(v: number) => v.toString()}
              />
              <YAxis
                domain={yDomain}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
                width={40}
                tickFormatter={(v: number) => v.toString()}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(v) => `x = ${v}`}
                formatter={(value, name) => {
                  const nameStr = String(name ?? "")
                  const idx = parseInt(nameStr.replace("f", ""))
                  const label = functions[idx]?.expr || nameStr
                  return [value != null ? (value as number) : "未定義", label]
                }}
              />
              <ReferenceLine
                x={0}
                stroke="color-mix(in oklab, var(--color-border) 80%, transparent)"
                strokeWidth={1}
              />
              <ReferenceLine
                y={0}
                stroke="color-mix(in oklab, var(--color-border) 80%, transparent)"
                strokeWidth={1}
              />
              {validFunctions.map((_, i) => (
                <Line
                  key={`f${i}`}
                  dataKey={`f${i}`}
                  type="monotone"
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            請輸入至少一個有效的函數表達式
          </div>
        )}
      </div>

      {/* Supported syntax hint */}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground">支援的語法</summary>
        <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-3">
          {[
            ["x^2", "二次方"],
            ["sqrt(x)", "平方根"],
            ["abs(x)", "絕對值"],
            ["sin(x) / cos(x) / tan(x)", "三角函數"],
            ["asin(x) / acos(x) / atan(x)", "反三角函數"],
            ["log(x)", "自然對數 ln(x)"],
            ["log10(x)", "常用對數"],
            ["exp(x)", "e^x"],
            ["floor(x) / ceil(x)", "取整"],
            ["pi", "π ≈ 3.14159"],
            ["e", "e ≈ 2.71828"],
          ].map(([syntax, desc]) => (
            <div key={syntax} className="flex gap-1">
              <code className="shrink-0 font-mono">{syntax}</code>
              <span className="text-muted-foreground/70">— {desc}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}

function RangeInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!isNaN(v)) onChange(v)
        }}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
    </div>
  )
}
