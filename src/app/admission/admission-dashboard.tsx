"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Camera,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Target,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TargetProgramManager } from "./target-program-manager"
import {
  savePredictionSnapshot,
  getAdmissionEvaluationV2,
} from "@/app/actions/admission-evaluation"
import type {
  AdmissionEvaluationV2Data,
  AdmissionLevel,
  ConfidenceLevel,
  SubjectEvaluationV2Item,
} from "@/types"

// ─── label helpers ─────────────────────────────────────────────────────────────

const ADMISSION_LEVEL_LABELS: Record<AdmissionLevel, string> = {
  high_chance: "高機會",
  good_chance: "有機會",
  coin_flip: "五五波",
  risky: "偏危險",
  very_risky: "很危險",
}

const ADMISSION_LEVEL_BADGE: Record<AdmissionLevel, string> = {
  high_chance: "bg-emerald-100 text-emerald-800 border-emerald-200",
  good_chance: "bg-sky-100 text-sky-800 border-sky-200",
  coin_flip: "bg-amber-100 text-amber-800 border-amber-200",
  risky: "bg-orange-100 text-orange-800 border-orange-200",
  very_risky: "bg-red-100 text-red-800 border-red-200",
}

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: "高",
  medium: "中",
  low: "低",
}

const CONFIDENCE_BADGE: Record<ConfidenceLevel, string> = {
  high: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-50 text-slate-600 border-slate-200",
}

function GapBadge({ gap }: { gap: number }) {
  const isPositive = gap > 0
  const isNeutral = gap === 0
  const cls = isPositive
    ? "text-emerald-600"
    : isNeutral
      ? "text-muted-foreground"
      : "text-red-600"
  const Icon = isPositive ? TrendingUp : isNeutral ? Minus : TrendingDown
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {isPositive ? "+" : ""}
      {gap}
    </span>
  )
}

function getFeasibilityNote(sub: SubjectEvaluationV2Item): string {
  if (sub.estimatedScoreMedian >= 90) return "已接近滿分，提升空間有限。"
  if (sub.mainPenaltyReason === "待複習過多") return "先清待複習任務，可快速回血 5 分。"
  if (sub.mainPenaltyReason === "錯題未清") return "集中清錯題，性價比最高。"
  if (sub.mainPenaltyReason === "高權重單元太弱") return "集中攻克高權重弱點單元可有效提分。"
  if (sub.mainPenaltyReason === "長時間沒碰") return "恢復固定練習頻率是首要任務。"
  if (sub.estimatedScoreMedian >= 70) return "目前表現穩定，集中攻克高權重弱點單元可有效提分。"
  if (sub.estimatedScoreMedian >= 50) return "尚有明顯提升空間，優先清錯題、補覆蓋率效果最佳。"
  return "基礎尚待強化，建議優先提升單元掌握度與增加模考次數。"
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  initialData: AdmissionEvaluationV2Data
}

export function AdmissionDashboard({ initialData }: Props) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(
    initialData.targetProgram?.id ?? null,
  )
  const [isSaving, startSaveTransition] = useTransition()
  const [isProgramSwitching, startProgramTransition] = useTransition()
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set())

  function handleSelectProgram(id: string) {
    setSelectedProgramId(id)
    startProgramTransition(async () => {
      const result = await getAdmissionEvaluationV2(id)
      setData(result)
      router.replace(`/admission?target=${id}`, { scroll: false })
    })
  }

  function toggleSubject(subjectId: string) {
    setExpandedSubjects((prev) => {
      const next = new Set(prev)
      if (next.has(subjectId)) {
        next.delete(subjectId)
      } else {
        next.add(subjectId)
      }
      return next
    })
  }

  function handleSaveSnapshot() {
    if (!selectedProgramId) {
      toast.error("請先選擇目標校系。")
      return
    }
    startSaveTransition(async () => {
      const result = await savePredictionSnapshot(selectedProgramId)
      if (result.success) {
        toast.success(result.message)
        // Reload data to pick up new snapshot
        const updated = await getAdmissionEvaluationV2(selectedProgramId)
        setData(updated)
      } else {
        toast.error(result.message)
      }
    })
  }

  const snapshotChartData = data.snapshots.map((s) => ({
    date: new Date(s.snapshotDate).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" }),
    median: s.estimatedTotalMedian,
    conservative: s.estimatedTotalConservative,
    optimistic: s.estimatedTotalOptimistic,
  }))

  return (
    <div className={`space-y-6 transition-opacity duration-200 ${isProgramSwitching ? "opacity-50 pointer-events-none" : ""}`}>
      {/* Target program manager */}
      <TargetProgramManager
        programs={data.allTargetPrograms}
        selectedProgramId={selectedProgramId}
        onSelect={handleSelectProgram}
      />

      {/* Not configured state */}
      {!data.isConfigured && (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
            <p className="font-medium">尚未設定考試大綱</p>
            <p className="mt-1 text-sm text-muted-foreground">
              請先到「設定」頁面新增科目與考試大綱單元，評估系統才能運算。
            </p>
            <a
              href="/settings"
              className="mt-4 inline-flex h-7 items-center rounded-[min(var(--radius-md),12px)] border border-border/90 bg-background/80 px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-muted"
            >
              前往設定
            </a>
          </CardContent>
        </Card>
      )}

      {data.isConfigured && (
        <>
          {/* ── Section 1: Overview ── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">總覽</CardTitle>
                  {data.targetProgram && (
                    <CardDescription>
                      {data.targetProgram.schoolName} {data.targetProgram.departmentName}（
                      {data.targetProgram.examYear} 年）
                    </CardDescription>
                  )}
                </div>
                {data.targetProgram && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveSnapshot}
                    disabled={isSaving || !data.admissionLevel}
                  >
                    <Camera className="mr-1.5 h-3.5 w-3.5" />
                    {isSaving ? "儲存中…" : "儲存快照"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Score range */}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  預估總分區間
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">
                    {data.totalScore.median}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    保守 {data.totalScore.conservative} ～ 樂觀 {data.totalScore.optimistic}
                  </span>
                </div>
                {/* Range bar */}
                <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 rounded-full bg-primary/30"
                    style={{
                      left: `${data.totalScore.conservative}%`,
                      width: `${data.totalScore.optimistic - data.totalScore.conservative}%`,
                    }}
                  />
                  <div
                    className="absolute inset-y-0 w-0.5 -translate-x-0.5 rounded-full bg-primary"
                    style={{ left: `${data.totalScore.median}%` }}
                  />
                </div>
              </div>

              {/* Gaps table */}
              {data.gaps && data.targetProgram && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    距離目標線差距（中位預估）
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      {
                        label: "去年上榜線",
                        line: data.targetProgram.lastYearLine,
                        gap: data.gaps.vsLastYearLine,
                      },
                      {
                        label: "安全線",
                        line: data.targetProgram.safeLine,
                        gap: data.gaps.vsSafeLine,
                      },
                      {
                        label: "理想線",
                        line: data.targetProgram.idealLine,
                        gap: data.gaps.vsIdealLine,
                      },
                    ].map(({ label, line, gap }) => (
                      <div
                        key={label}
                        className="rounded-lg border bg-muted/30 px-3 py-2 text-center"
                      >
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm font-medium tabular-nums">{line}</p>
                        <GapBadge gap={gap} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Level + confidence */}
              <div className="flex flex-wrap gap-3">
                {data.admissionLevel && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">上榜等級</span>
                    <Badge
                      variant="outline"
                      className={`font-semibold ${ADMISSION_LEVEL_BADGE[data.admissionLevel]}`}
                    >
                      {ADMISSION_LEVEL_LABELS[data.admissionLevel]}
                    </Badge>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">信心度</span>
                  <Badge
                    variant="outline"
                    className={CONFIDENCE_BADGE[data.confidenceLevel]}
                  >
                    {CONFIDENCE_LABELS[data.confidenceLevel]}
                  </Badge>
                </div>
              </div>

              {!data.targetProgram && (
                <p className="text-sm text-muted-foreground">
                  新增目標校系後，可查看差距與上榜等級。
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Section 2: Snapshot trend chart ── */}
          {snapshotChartData.length > 1 && data.targetProgram && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">預估走勢</CardTitle>
                <CardDescription>最近 {snapshotChartData.length} 次快照</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={snapshotChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="medianGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
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
                    {data.targetProgram.lastYearLine > 0 && (
                      <ReferenceLine
                        y={data.targetProgram.lastYearLine}
                        stroke="hsl(var(--destructive))"
                        strokeDasharray="3 3"
                        label={{ value: "上榜線", position: "right", fontSize: 10 }}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* ── Section 3: Subject cards ── */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              三科拆解
            </h2>
            <div className="space-y-3">
              {data.subjects.map((sub) => {
                const isExpanded = expandedSubjects.has(sub.subjectId)
                return (
                  <Card key={sub.subjectId}>
                    <CardHeader
                      className="cursor-pointer pb-2 pt-4"
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onClick={() => toggleSubject(sub.subjectId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          toggleSubject(sub.subjectId)
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div>
                            <CardTitle className="text-base">{sub.subjectName}</CardTitle>
                            {sub.examWeight != null && (
                              <CardDescription className="text-xs">
                                佔比 {Math.round(sub.examWeight * 100)}%
                              </CardDescription>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-lg font-bold tabular-nums">
                              {sub.estimatedScoreMedian}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {sub.estimatedScoreConservative}～{sub.estimatedScoreOptimistic}
                              <span className="ml-1 text-muted-foreground/60">
                                (±{sub.volatility})
                              </span>
                            </p>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* Score bar */}
                      <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="absolute inset-y-0 rounded-full bg-primary/25"
                          style={{
                            left: `${sub.estimatedScoreConservative}%`,
                            width: `${sub.estimatedScoreOptimistic - sub.estimatedScoreConservative}%`,
                          }}
                        />
                        <div
                          className="absolute inset-y-0 w-0.5 rounded-full bg-primary"
                          style={{ left: `${sub.estimatedScoreMedian}%` }}
                        />
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="space-y-4 border-t pt-4">
                        {/* Factor breakdown */}
                        <div>
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            分數構成
                          </p>
                          <div className="space-y-1.5">
                            {[
                              {
                                label: "模考成績",
                                value: sub.mockExamScore,
                                weight: sub.mockExamCount > 0 ? "45%" : "—",
                                note: sub.mockExamCount > 0
                                  ? `${sub.mockExamCount} 次`
                                  : "無資料（使用備用公式）",
                              },
                              {
                                label: "近期做題換算",
                                value: sub.recentPracticeScore,
                                weight: sub.mockExamCount > 0 ? "20%" : "40%",
                              },
                              {
                                label: "單元掌握度",
                                value: sub.unitMasteryScore,
                                weight: sub.mockExamCount > 0 ? "15%" : "25%",
                              },
                              {
                                label: "範圍覆蓋",
                                value: sub.coverageScore,
                                weight: sub.mockExamCount > 0 ? "10%" : "20%",
                              },
                              {
                                label: "穩定度",
                                value: sub.stabilityScore,
                                weight: sub.mockExamCount > 0 ? "10%" : "15%",
                              },
                            ].map(({ label, value, weight, note }) => (
                              <div key={label} className="flex items-center gap-2">
                                <span className="w-28 shrink-0 text-xs text-muted-foreground">
                                  {label}
                                </span>
                                <div className="flex-1">
                                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-sky-400"
                                      style={{ width: `${value ?? 0}%` }}
                                    />
                                  </div>
                                </div>
                                <span className="w-12 text-right text-xs font-medium tabular-nums">
                                  {value != null ? `${value}` : "—"}
                                </span>
                                <span className="w-10 text-right text-xs text-muted-foreground">
                                  {weight}
                                </span>
                                {note && (
                                  <span className="text-xs text-muted-foreground">({note})</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Penalties */}
                        {sub.totalPenalty > 0 && (
                          <div>
                            <p className="mb-2 text-xs font-medium text-muted-foreground">
                              懲罰項（-{sub.totalPenalty} 分）
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {sub.penaltyBreakdown.overdueReview > 0 && (
                                <Badge variant="outline" className="text-xs text-amber-700 border-amber-200 bg-amber-50">
                                  待複習過多 -{sub.penaltyBreakdown.overdueReview}
                                </Badge>
                              )}
                              {sub.penaltyBreakdown.wrongQuestions > 0 && (
                                <Badge variant="outline" className="text-xs text-orange-700 border-orange-200 bg-orange-50">
                                  錯題未清 -{sub.penaltyBreakdown.wrongQuestions}
                                </Badge>
                              )}
                              {sub.penaltyBreakdown.inactive > 0 && (
                                <Badge variant="outline" className="text-xs text-slate-700 border-slate-200 bg-slate-50">
                                  長時間沒碰 -{sub.penaltyBreakdown.inactive}
                                </Badge>
                              )}
                              {sub.penaltyBreakdown.highWeightWeakUnit > 0 && (
                                <Badge variant="outline" className="text-xs text-red-700 border-red-200 bg-red-50">
                                  高權重單元太弱 -{sub.penaltyBreakdown.highWeightWeakUnit}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Feasibility note */}
                        <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">再提升 5 分可行性：</span>
                          {getFeasibilityNote(sub)}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          </div>

          {/* ── Section 4: Score gain ── */}
          {data.scoreGainMetric && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4 text-amber-500" />
                  最划算補分點
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Top recommendation */}
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-900">
                        優先投入：{data.scoreGainMetric.subjectName}
                      </p>
                      <p className="text-sm text-amber-700">
                        每 5 小時預計可增加約{" "}
                        <strong>{data.scoreGainMetric.estimatedPointsPer5Hours}</strong> 分
                      </p>
                    </div>
                  </div>
                </div>

                {/* All subjects ranked (server-sorted, no client recalculation) */}
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">各科效益排名</p>
                  <div className="space-y-2">
                    {data.scoreGainCandidates.map((candidate) => {
                      const isTop = candidate.subjectId === data.scoreGainMetric?.subjectId
                      const sub = data.subjects.find((s) => s.subjectId === candidate.subjectId)
                      return (
                        <div
                          key={candidate.subjectId}
                          className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                            isTop ? "bg-amber-50 ring-1 ring-amber-200" : "bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isTop ? (
                              <CheckCircle2 className="h-4 w-4 text-amber-500" />
                            ) : (
                              <div className="h-4 w-4" />
                            )}
                            <span className="text-sm font-medium">{candidate.subjectName}</span>
                            {sub && (
                              <span className="text-xs text-muted-foreground">
                                目前 {sub.estimatedScoreMedian} 分
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-medium tabular-nums">
                            +{candidate.estimatedPointsPer5Hours} 分/5h
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
