import Link from "next/link"
import {
  ArrowRight,
  BookOpen,
  Clock3,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

import { getDashboardData } from "@/app/actions/dashboard"
import { AnimatedNumber } from "@/components/animated-number"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type {
  AdmissionLevel,
  ConfidenceLevel,
  DashboardAdmissionSummary,
  DashboardReviewFocusItem,
  DashboardSubjectMasteryItem,
  DashboardTrendPoint,
  DashboardWeakAreaItem,
} from "@/types"

const ADMISSION_LEVEL_LABELS: Record<AdmissionLevel, string> = {
  high_chance: "高機會",
  good_chance: "有機會",
  coin_flip: "五五波",
  risky: "偏危險",
  very_risky: "很危險",
}

const ADMISSION_LEVEL_TONE: Record<AdmissionLevel, string> = {
  high_chance: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  good_chance: "bg-sky-500/12 text-sky-700 dark:text-sky-400",
  coin_flip: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
  risky: "bg-orange-500/12 text-orange-700 dark:text-orange-400",
  very_risky: "bg-red-500/12 text-red-700 dark:text-red-400",
}

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: "高",
  medium: "中",
  low: "低",
}

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes))
  const hours = Math.floor(safeMinutes / 60)
  const mins = safeMinutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  if (!data.hasData) {
    return (
      <div className="mx-auto flex min-h-[72vh] max-w-5xl items-center">
        <Card className="w-full overflow-hidden">
          <CardContent className="grid gap-8 px-6 py-8 md:grid-cols-[1.15fr_0.85fr] md:px-8 md:py-10">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                <BookOpen className="h-4 w-4" />
                開始建立你的學習控制台
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
                  先把科目與目標設好，儀表板才會開始有意義。
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  這裡之後會顯示你的備考狀態、弱點單元、topic 覆蓋率與今天該先讀什麼。現在先新增科目，讓 app 開始追蹤你的準備進度。
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/settings"
                  className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[0_10px_24px_color-mix(in_oklab,var(--primary)_28%,transparent)] transition-all duration-200 hover:bg-primary/92 hover:shadow-[0_14px_30px_color-mix(in_oklab,var(--primary)_32%,transparent)] sm:w-auto"
                >
                  先新增科目
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/import"
                  className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-border/90 bg-background/80 px-4 text-sm font-medium transition-all duration-200 hover:bg-muted hover:text-foreground sm:w-auto"
                >
                  之後去匯入題目
                </Link>
              </div>
            </div>

            <div className="grid gap-3 self-start rounded-3xl border border-border/70 bg-background/75 p-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
              <EmptyStateHint
                title="沒有科目"
                description="先建立微積分、經濟、英文之類的主科，準備度才有東西可以算。"
              />
              <EmptyStateHint
                title="沒有考試日期"
                description="設定考試日後，首頁就能顯示倒數與節奏提醒。"
              />
              <EmptyStateHint
                title="沒有練習資料"
                description="匯入題目或手動記錄一次測驗，才能開始判斷哪科危險。"
              />
              <EmptyStateHint
                title="沒有複習任務"
                description="做題和單字練習後，任務中心會開始幫你排複習。"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="stagger-children grid gap-4 md:grid-cols-3">
        <TodayStudyCard
          todaysStudyMinutes={data.todaysStudyMinutes}
          goalMinutes={data.dailyStudyGoalMinutes}
        />
        <WeeklyTotalCard
          thisWeekMinutes={data.thisWeekMinutes}
          lastWeekMinutes={data.lastWeekMinutes}
          trendData={data.trendData}
        />
        <AdmissionCard summary={data.admissionSummary} />
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle>各科投入與掌握度</CardTitle>
            <CardDescription>近 14 天累積時數與目前準備度</CardDescription>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            近 14 天
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.subjectMastery14d.length > 0 ? (
            <div className="stagger-children stagger-fast space-y-4">
              {data.subjectMastery14d.map((item) => (
                <SubjectMasteryRow key={item.subjectId} item={item} />
              ))}
            </div>
          ) : (
            <InlineEmptyState
              title="還沒有科目資料"
              description="先新增科目並補上學習紀錄，這裡才會出現每科的投入與掌握度。"
              href="/settings"
              cta="去設定科目"
            />
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        <TodayReviewCard
          pendingReviews={data.pendingReviews}
          nextReviewFocus={data.nextReviewFocus}
        />
        <RecentWrongCard weakestAreas={data.weakestAreas} />
      </section>
    </div>
  )
}

function TodayStudyCard({
  todaysStudyMinutes,
  goalMinutes,
}: {
  todaysStudyMinutes: number
  goalMinutes: number
}) {
  const progress = goalMinutes > 0 ? Math.min(100, Math.round((todaysStudyMinutes / goalMinutes) * 100)) : 0
  const remaining = Math.max(0, goalMinutes - todaysStudyMinutes)
  const done = todaysStudyMinutes >= goalMinutes

  return (
    <Card>
      <CardContent className="space-y-4 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              今日讀書時間
            </p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground tabular-nums">
              <AnimatedNumber value={todaysStudyMinutes} format="minutes" />
            </p>
          </div>
          <div className="rounded-xl bg-primary/12 p-2.5 text-primary">
            <Clock3 className="h-4 w-4" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {done
              ? "今日目標已達成 🎉"
              : `目標 ${formatMinutes(goalMinutes)}・剩 ${formatMinutes(remaining)}`}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function WeeklyTotalCard({
  thisWeekMinutes,
  lastWeekMinutes,
  trendData,
}: {
  thisWeekMinutes: number
  lastWeekMinutes: number
  trendData: DashboardTrendPoint[]
}) {
  const delta = thisWeekMinutes - lastWeekMinutes
  const maxMinutes = Math.max(1, ...trendData.map((p) => p.minutes))
  const deltaLabel = (() => {
    if (lastWeekMinutes === 0 && thisWeekMinutes === 0) return "本週還沒開始讀書"
    if (lastWeekMinutes === 0) return "上週沒有紀錄"
    if (delta === 0) return "與上週持平"
    if (delta > 0) return `比上週多 ${formatMinutes(delta)}`
    return `比上週少 ${formatMinutes(-delta)}`
  })()

  return (
    <Card>
      <CardContent className="space-y-4 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              本週累積
            </p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground tabular-nums">
              <AnimatedNumber value={thisWeekMinutes} format="minutes" />
            </p>
          </div>
          <div
            className={cn(
              "rounded-xl p-2.5",
              delta >= 0
                ? "bg-emerald-500/12 text-emerald-600"
                : "bg-amber-500/12 text-amber-600",
            )}
          >
            {delta >= 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex h-10 items-end gap-1.5">
            {trendData.map((point, index) => {
              const heightPct = Math.round((point.minutes / maxMinutes) * 100)
              const isToday = index === trendData.length - 1
              return (
                <div
                  key={point.date}
                  className="flex flex-1 items-end"
                  title={`${point.date}: ${formatMinutes(point.minutes)}`}
                >
                  <div
                    className={cn(
                      "w-full rounded-sm transition-[height] duration-700 ease-out",
                      isToday ? "bg-primary" : "bg-primary/40",
                    )}
                    style={{ height: `${Math.max(4, heightPct)}%` }}
                  />
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">{deltaLabel}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function AdmissionCard({
  summary,
}: {
  summary: DashboardAdmissionSummary | null
}) {
  if (!summary) {
    return (
      <Card>
        <CardContent className="flex h-full flex-col justify-between gap-4 px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                上榜評估
              </p>
              <p className="mt-3 text-base font-medium text-foreground">
                還沒有目標校系
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                設定目標後這裡會顯示上榜機率與落差。
              </p>
            </div>
            <div className="rounded-xl bg-primary/12 p-2.5 text-primary">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <Link
            href="/admission"
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-border/90 bg-background/80 px-4 text-sm font-medium transition-all duration-200 hover:border-primary/30 hover:bg-muted hover:text-foreground"
          >
            去設定目標校系
            <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    )
  }

  const gap = summary.gapVsLastYearLine
  const gapDisplay = `${gap > 0 ? "+" : ""}${gap}`
  const gapTone =
    gap >= 3
      ? "text-emerald-600 dark:text-emerald-400"
      : gap >= -2
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400"

  return (
    <Card>
      <CardContent className="space-y-4 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              上榜評估
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  ADMISSION_LEVEL_TONE[summary.admissionLevel],
                )}
              >
                {ADMISSION_LEVEL_LABELS[summary.admissionLevel]}
              </span>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                信心：{CONFIDENCE_LABELS[summary.confidenceLevel]}
              </span>
            </div>
          </div>
          <div className="rounded-xl bg-primary/12 p-2.5 text-primary">
            <Target className="h-4 w-4" />
          </div>
        </div>

        <div>
          <p className="truncate text-lg font-semibold text-foreground">
            {summary.schoolName} {summary.departmentName}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            去年上榜線落差{" "}
            <span className={cn("font-semibold", gapTone)}>{gapDisplay} 分</span>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function SubjectMasteryRow({ item }: { item: DashboardSubjectMasteryItem }) {
  const masteryPct = Math.max(0, Math.min(100, Math.round(item.masteryRate)))
  const barTone =
    masteryPct >= 75
      ? "bg-emerald-500"
      : masteryPct >= 55
        ? "bg-primary"
        : masteryPct >= 35
          ? "bg-amber-500"
          : "bg-red-500"

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-sm font-medium text-foreground">
          {item.subjectName}
        </p>
        <div className="flex items-baseline gap-3 text-xs text-muted-foreground">
          <span>{formatMinutes(item.minutes14d)}</span>
          <span className="font-semibold text-foreground tabular-nums">
            {masteryPct}%
          </span>
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out", barTone)}
          style={{ width: `${masteryPct}%` }}
        />
      </div>
    </div>
  )
}

function TodayReviewCard({
  pendingReviews,
  nextReviewFocus,
}: {
  pendingReviews: number
  nextReviewFocus: DashboardReviewFocusItem[]
}) {
  type Grouped = {
    key: string
    subjectId: string
    subjectName: string
    topic: string
    count: number
  }
  const grouped = new Map<string, Grouped>()
  for (const task of nextReviewFocus) {
    const key = `${task.subject.id}::${task.topic}`
    const current = grouped.get(key)
    if (current) {
      current.count += 1
    } else {
      grouped.set(key, {
        key,
        subjectId: task.subject.id,
        subjectName: task.subject.name,
        topic: task.topic,
        count: 1,
      })
    }
  }
  const rows = Array.from(grouped.values())

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>今日該複習</CardTitle>
          <CardDescription>先清到期複習，避免記憶債堆積。</CardDescription>
        </div>
        <span className="rounded-full bg-amber-500/12 px-3 py-1 text-xs font-medium text-amber-700">
          {pendingReviews} 題
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingReviews === 0 ? (
          <InlineEmptyState
            title="今日複習已清空"
            description="這段時間很穩，可以再做一組題目替明天暖身。"
            href="/practice"
            cta="去做題"
          />
        ) : rows.length > 0 ? (
          rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/70 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {row.subjectName}・{row.topic}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {row.count} 題
                </p>
              </div>
              <Link
                href={`/review?subject=${encodeURIComponent(row.subjectId)}&topic=${encodeURIComponent(row.topic)}`}
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                開始
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ))
        ) : (
          <Link
            href="/review"
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-border/90 bg-background/80 px-4 text-sm font-medium transition-all duration-200 hover:border-primary/30 hover:bg-muted hover:text-foreground"
          >
            去複習中心看看
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </CardContent>
    </Card>
  )
}

function RecentWrongCard({
  weakestAreas,
}: {
  weakestAreas: DashboardWeakAreaItem[]
}) {
  const rows = weakestAreas.slice(0, 3)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>最近錯題</CardTitle>
          <CardDescription>挑出最容易掉分的單元。</CardDescription>
        </div>
        <Link
          href="/wrong-questions"
          className="text-xs font-medium text-primary hover:underline"
        >
          查看全部
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <InlineEmptyState
            title="沒有最近錯題"
            description="做一組題目後，系統就會把危險單元挑出來。"
            href="/practice"
            cta="去做練習"
          />
        ) : (
          rows.map((item) => (
            <Link
              key={item.key}
              href="/wrong-questions"
              className="group flex items-start justify-between gap-3 rounded-2xl border border-border/70 bg-background/70 p-3 transition-all duration-150 hover:border-primary/30 hover:bg-background"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  {item.subjectName}
                </p>
                <p className="mt-1 truncate text-sm font-medium text-foreground">
                  {item.topic}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.note}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                #wrong
              </span>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function InlineEmptyState({
  title,
  description,
  href,
  cta,
}: {
  title: string
  description: string
  href: string
  cta: string
}) {
  return (
    <div className="flex h-full min-h-[120px] flex-col items-start justify-center rounded-2xl border border-dashed border-border bg-background/60 p-4 text-left">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      <Link
        href={href}
        className="mt-3 inline-flex h-8 items-center justify-center rounded-xl border border-border/90 bg-background/80 px-3 text-sm font-medium transition-all duration-200 hover:bg-muted hover:text-foreground"
      >
        {cta}
      </Link>
    </div>
  )
}

function EmptyStateHint({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}
