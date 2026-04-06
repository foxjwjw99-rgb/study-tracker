import Link from "next/link"
import { Settings, TrendingUp, AlertTriangle } from "lucide-react"

import { getExamForecastData } from "@/app/actions/exam-forecast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { SubjectForecastItem, UnitDangerLevel } from "@/types"

// ─── helpers ──────────────────────────────────────────────────────────────────

function probabilityColor(p: number) {
  if (p >= 70) return "text-emerald-600"
  if (p >= 50) return "text-amber-500"
  return "text-destructive"
}

function probabilityLabel(p: number) {
  if (p >= 80) return "很有機會"
  if (p >= 65) return "尚在掌控中"
  if (p >= 50) return "邊緣，需加把勁"
  if (p >= 35) return "風險較高"
  return "準備不足"
}

const DANGER_BADGE: Record<UnitDangerLevel, { label: string; className: string }> = {
  A: { label: "A",  className: "border-emerald-500 text-emerald-600 bg-emerald-50" },
  B: { label: "B",  className: "border-blue-400 text-blue-600 bg-blue-50" },
  C: { label: "C",  className: "border-amber-400 text-amber-600 bg-amber-50" },
  D: { label: "D",  className: "border-destructive text-destructive bg-destructive/5" },
}

const FACTORS = [
  { key: "mastery",        label: "掌握度",   weight: "30%", color: "bg-violet-500" },
  { key: "mockScore",      label: "考古實戰", weight: "35%", color: "bg-blue-500" },
  { key: "correctionRate", label: "錯題修正", weight: "15%", color: "bg-emerald-500" },
  { key: "stability",      label: "穩定度",   weight: "10%", color: "bg-amber-500" },
  { key: "slope",          label: "進步斜率", weight: "10%", color: "bg-rose-500" },
] as const

// ─── sub-components ───────────────────────────────────────────────────────────

function FactorBar({
  label,
  weight,
  score,
  color,
  isEstimated,
}: {
  label: string
  weight: string
  score: number
  color: string
  isEstimated?: boolean
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground">{weight}</span>
          {isEstimated && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">估算中</Badge>
          )}
        </div>
        <span className="tabular-nums text-muted-foreground">{Math.round(score)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  )
}

function SubjectCard({ subject }: { subject: SubjectForecastItem }) {
  const { factors } = subject
  const examWeightLabel =
    subject.examWeight != null
      ? `佔總分 ${Math.round(subject.examWeight * 100)}%`
      : "比重未設定"

  return (
    <div className="space-y-3 rounded-xl border bg-card/70 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{subject.subjectName}</p>
          <p className="text-xs text-muted-foreground">{examWeightLabel} · 目標 {subject.targetScore} 分</p>
        </div>
        <span className="text-2xl font-bold tabular-nums text-primary">
          {Math.round(factors.composite)}
        </span>
      </div>

      {/* 5-factor breakdown */}
      <div className="space-y-2">
        {FACTORS.map((f) => (
          <FactorBar
            key={f.key}
            label={f.label}
            weight={f.weight}
            score={factors[f.key]}
            color={f.color}
            isEstimated={f.key === "mockScore" && factors.mockScoreIsEstimated}
          />
        ))}
      </div>

      {/* Mastery detail */}
      {(factors.masteryManual != null || factors.masteryAccuracy != null) && (
        <p className="text-[11px] text-muted-foreground">
          掌握度 =
          {factors.masteryManual != null && ` 自評 ${Math.round(factors.masteryManual)}`}
          {factors.masteryManual != null && factors.masteryAccuracy != null && " +"}
          {factors.masteryAccuracy != null && ` 答對率 ${Math.round(factors.masteryAccuracy)}`}
          {factors.masteryManual != null && factors.masteryAccuracy != null && " (取平均)"}
        </p>
      )}

      {/* Unit list */}
      {subject.units.length > 0 && (
        <div className="space-y-1 pt-1">
          <p className="text-[11px] font-medium text-muted-foreground">各單元狀態</p>
          <div className="flex flex-wrap gap-1.5">
            {subject.units.map((unit) => {
              const badge = DANGER_BADGE[unit.dangerLevel]
              return (
                <div
                  key={unit.unitName}
                  className="flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-[11px]"
                  title={`掌握度：${unit.masteryScore ?? "未評估"}　答對率：${unit.accuracy != null ? Math.round(unit.accuracy * 100) + "%" : "無資料"}　比重：${Math.round(unit.weight * 100)}%`}
                >
                  <Badge
                    variant="outline"
                    className={`h-4 w-4 p-0 flex items-center justify-center text-[10px] font-bold ${badge.className}`}
                  >
                    {badge.label}
                  </Badge>
                  <span>{unit.unitName}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── main export ──────────────────────────────────────────────────────────────

export async function ExamForecastSection() {
  const data = await getExamForecastData()

  if (!data.isConfigured) {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="section-heading">上榜機率指數</h2>
          <p className="section-copy">
            5 因子加權指數：掌握度、考古實戰、錯題修正率、穩定度、進步斜率。
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <TrendingUp className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">尚未設定考試範圍</p>
            <p className="mt-1 text-xs text-muted-foreground">
              前往設定頁，輸入各科的考試單元、比重與目標分數，指數就會自動計算。
            </p>
            <Link
              href="/settings"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <Settings className="h-4 w-4" />
              前往設定考試範圍
            </Link>
          </CardContent>
        </Card>
      </section>
    )
  }

  const { probability, estimatedTotalScore, targetTotalScore, subjectBreakdown, highRiskUnits } =
    data

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="section-heading">上榜機率指數</h2>
        <p className="section-copy">
          5 因子加權：掌握度(30%) + 考古實戰(35%) + 錯題修正(15%) + 穩定度(10%) + 進步斜率(10%)
        </p>
      </div>

      {/* Top summary card */}
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 sm:flex-row sm:gap-12">
          <div className="flex flex-col items-center">
            <span className={`text-7xl font-bold tabular-nums ${probabilityColor(probability)}`}>
              {probability}%
            </span>
            <span className="mt-1 text-sm font-medium text-muted-foreground">
              {probabilityLabel(probability)}
            </span>
          </div>
          <div className="mt-4 space-y-1 text-center sm:mt-0 sm:text-left">
            <p className="text-sm text-muted-foreground">
              預估總分 <span className="font-semibold text-foreground tabular-nums">{Math.round(estimatedTotalScore)}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              目標總分 <span className="font-semibold text-foreground tabular-nums">{Math.round(targetTotalScore)}</span>
            </p>
            <p className="text-xs text-muted-foreground pt-1">
              差距 <span className={`font-medium ${estimatedTotalScore >= targetTotalScore ? "text-emerald-600" : "text-destructive"}`}>
                {estimatedTotalScore >= targetTotalScore ? "+" : ""}{Math.round(estimatedTotalScore - targetTotalScore)}
              </span> 分
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Per-subject cards */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {subjectBreakdown.map((subject) => (
          <SubjectCard key={subject.subjectId} subject={subject} />
        ))}
      </div>

      {/* High-risk units */}
      {highRiskUnits.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-medium">高風險單元</CardTitle>
              <span className="text-xs text-muted-foreground">比重高且掌握度低，優先加強</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {highRiskUnits.map((unit, i) => {
                const badge = DANGER_BADGE[unit.dangerLevel]
                return (
                  <div
                    key={`${unit.subjectName}-${unit.unitName}-${i}`}
                    className="flex items-center justify-between px-5 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${badge.className}`}>
                        {unit.dangerLevel}
                      </Badge>
                      <span className="font-medium">{unit.unitName}</span>
                      <span className="text-xs text-muted-foreground">{unit.subjectName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>比重 {Math.round(unit.weight * 100)}%</span>
                      {unit.masteryScore != null && (
                        <span>自評 {unit.masteryScore}/5</span>
                      )}
                      {unit.isCovered ? (
                        <span className="text-destructive">答對 {Math.round((unit.accuracy ?? 0) * 100)}%</span>
                      ) : (
                        <Badge variant="secondary" className="text-xs">未練習</Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
