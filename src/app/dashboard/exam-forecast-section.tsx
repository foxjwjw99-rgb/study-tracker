import Link from "next/link"
import { Settings, TrendingUp, AlertTriangle } from "lucide-react"

import { getExamForecastData } from "@/app/actions/exam-forecast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { SubjectForecastItem } from "@/types"

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

function SubjectBar({ subject }: { subject: SubjectForecastItem }) {
  const pct = Math.min(subject.estimatedScore, 100)
  const targetPct = Math.min(subject.targetScore, 100)
  const examWeightLabel =
    subject.examWeight != null ? `佔總分 ${Math.round(subject.examWeight * 100)}%` : "比重未設定"

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">{subject.subjectName}</span>
          <span className="text-xs text-muted-foreground">{examWeightLabel}</span>
        </div>
        <span className="tabular-nums text-xs text-muted-foreground">
          {Math.round(subject.estimatedScore)} / {subject.targetScore} 分
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
        {/* Progress bar */}
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
        {/* Target marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-amber-400"
          style={{ left: `${targetPct}%` }}
          title={`目標：${subject.targetScore}`}
        />
      </div>
    </div>
  )
}

export async function ExamForecastSection() {
  const data = await getExamForecastData()

  if (!data.isConfigured) {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="section-heading">預估考上機率</h2>
          <p className="section-copy">根據各單元答對率與目標分數，預測目前通過考試的機率。</p>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <TrendingUp className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">尚未設定考試範圍</p>
            <p className="mt-1 text-xs text-muted-foreground">
              前往設定頁，輸入各科的考試單元、佔分比重與目標分數，機率就會自動計算。
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
        <h2 className="section-heading">預估考上機率</h2>
        <p className="section-copy">
          根據近 90 天各單元答對率與目標分數加權計算，每次練習後自動更新。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* Probability card */}
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <span className={`text-7xl font-bold tabular-nums ${probabilityColor(probability)}`}>
              {probability}%
            </span>
            <span className="mt-2 text-sm font-medium text-muted-foreground">
              {probabilityLabel(probability)}
            </span>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span>預估 {Math.round(estimatedTotalScore)} 分</span>
              <span>／</span>
              <span>目標 {Math.round(targetTotalScore)} 分</span>
            </div>
          </CardContent>
        </Card>

        {/* Subject breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">各科預估分數</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {subjectBreakdown.map((subject) => (
              <SubjectBar key={subject.subjectId} subject={subject} />
            ))}
            <p className="text-xs text-muted-foreground">
              橘色線為目標分數，藍色進度條為目前預估分數。
            </p>
          </CardContent>
        </Card>
      </div>

      {/* High-risk units */}
      {highRiskUnits.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-medium">高風險單元</CardTitle>
              <span className="text-xs text-muted-foreground">佔比高但答對率偏低，優先加強</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {highRiskUnits.map((unit, i) => (
                <div
                  key={`${unit.subjectName}-${unit.unitName}-${i}`}
                  className="flex items-center justify-between px-5 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{unit.unitName}</span>
                    <span className="text-xs text-muted-foreground">{unit.subjectName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      佔 {Math.round(unit.weight * 100)}%
                    </Badge>
                    {unit.isCovered ? (
                      <span className="tabular-nums text-xs text-destructive">
                        {Math.round((unit.accuracy ?? 0) * 100)}% 答對
                      </span>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        未練習
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
