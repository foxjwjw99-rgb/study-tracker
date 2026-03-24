import type { ComponentType } from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Target,
  TrendingUp,
} from "lucide-react"

import { getDashboardData } from "@/app/actions/dashboard"
import { TrendChart, SubjectChart } from "@/components/dashboard-charts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type {
  DashboardPlanItem,
  DashboardReviewFocusItem,
  DashboardSubjectCoverageItem,
  DashboardSubjectReadinessItem,
  DashboardSubjectTopicSectionItem,
  DashboardTopicDetailItem,
  DashboardWeakAreaItem,
} from "@/types"

const summaryCards = [
  {
    key: "study",
    label: "今日學習時間",
    helper: "專注投入",
    icon: Clock3,
    accent: "text-primary",
  },
  {
    key: "accuracy",
    label: "今日正確率",
    helper: "做題表現",
    icon: Target,
    accent: "text-emerald-600",
  },
  {
    key: "review",
    label: "待複習數",
    helper: "今天要處理",
    icon: CalendarClock,
    accent: "text-amber-600",
  },
  {
    key: "exam",
    label: "距離考試",
    helper: "剩餘時間",
    icon: TrendingUp,
    accent: "text-sky-600",
  },
] as const

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
                <Link href="/settings" className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[0_10px_24px_color-mix(in_oklab,var(--primary)_28%,transparent)] transition-all duration-200 hover:bg-primary/92 hover:shadow-[0_14px_30px_color-mix(in_oklab,var(--primary)_32%,transparent)] sm:w-auto">
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

  const examValue = data.daysUntilExam !== null ? `${data.daysUntilExam} 天` : "未設定"
  const examHelper =
    data.daysUntilExam !== null ? (data.daysUntilExam <= 14 ? "進入衝刺期" : "穩定推進中") : "去設定目標日"

  const reviewStatus = data.pendingReviews > 0 ? `${data.pendingReviews} 項` : "已清空"
  const reviewHelper = data.pendingReviews > 0 ? "先處理到期複習" : "今天沒有積壓"

  const todayStatusTone = data.completedToday ? "success" : data.pendingReviews > 0 ? "warning" : "normal"

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:gap-8">
      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="overflow-hidden">
          <CardContent className="space-y-6 px-5 py-6 sm:px-6 sm:py-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  <Target className="h-4 w-4" />
                  轉學考備考中心
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                    先看現在哪科危險，再決定今天先救哪裡。
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                    這個首頁現在不只看統計，而是直接幫你整理準備度、弱點單元、範圍覆蓋率和下一步要做什麼。
                  </p>
                </div>
              </div>

              <div className="surface-subtle min-w-0 max-w-md p-4">
                <div className="flex items-start gap-3">
                  <div className={statusBadgeClass(todayStatusTone)}>
                    {data.completedToday ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : data.pendingReviews > 0 ? (
                      <CircleAlert className="h-4 w-4" />
                    ) : (
                      <TrendingUp className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground">今日總結</p>
                    <p className="text-sm leading-6 text-muted-foreground">{data.recommendation}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label={summaryCards[0].label}
                value={`${data.todaysStudyMinutes} 分鐘`}
                helper={summaryCards[0].helper}
                detail={data.streakDays > 0 ? `已連續學習 ${data.streakDays} 天` : "今天也值得開始一小段"}
                icon={summaryCards[0].icon}
                accent={summaryCards[0].accent}
              />
              <SummaryCard
                label={summaryCards[1].label}
                value={data.todaysAccuracy !== null ? `${data.todaysAccuracy}%` : "尚無資料"}
                helper={summaryCards[1].helper}
                detail={data.todaysAccuracy !== null ? "用結果校準練習節奏" : "做一組題目後就會出現"}
                icon={summaryCards[1].icon}
                accent={summaryCards[1].accent}
              />
              <SummaryCard
                label={summaryCards[2].label}
                value={reviewStatus}
                helper={summaryCards[2].helper}
                detail={reviewHelper}
                icon={summaryCards[2].icon}
                accent={summaryCards[2].accent}
              />
              <SummaryCard
                label={summaryCards[3].label}
                value={examValue}
                helper={summaryCards[3].helper}
                detail={examHelper}
                icon={summaryCards[3].icon}
                accent={summaryCards[3].accent}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>今天的三步驟</CardTitle>
            <CardDescription>不要想太多，照這個順序做就好。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.todayPlan.length > 0 ? (
              data.todayPlan.map((item, index) => <PlanStep key={item.id} item={item} index={index} />)
            ) : (
              <InlineEmptyState
                title="今天還沒有明確建議"
                description="先補一筆學習紀錄或做一組題目，系統就會開始排優先順序。"
                href="/study-log"
                cta="去記錄"
              />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="section-heading">三科準備狀態</h2>
          <p className="section-copy">把每一科拆開看，直接知道目前穩不穩、卡在哪裡、下一步該怎麼補。</p>
        </div>

        {data.subjectReadiness.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {data.subjectReadiness.map((item) => (
              <SubjectReadinessCard key={item.subjectId} item={item} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8">
              <InlineEmptyState
                title="還沒有科目準備度"
                description="先新增科目，再記錄幾筆學習或做題資料，這裡就會開始顯示每科狀態。"
                href="/settings"
                cta="去設定科目"
              />
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="section-heading">考試範圍覆蓋率</h2>
          <p className="section-copy">先確認每科有哪些 topic 已碰過、哪些還是空白，避免考前才發現漏章節。</p>
        </div>

        {data.subjectCoverage.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {data.subjectCoverage.map((item) => (
              <CoverageOverviewCard key={item.subjectId} item={item} />
            ))}
          </div>
        ) : null}

        {data.subjectTopicSections.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-3">
            {data.subjectTopicSections.map((section) => (
              <SubjectTopicSectionCard key={section.subjectId} section={section} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8">
              <InlineEmptyState
                title="還沒有 topic 明細"
                description="先匯入題目或記錄學習，系統才抓得到你的章節覆蓋狀況。"
                href="/import"
                cta="去匯入題庫"
              />
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="section-heading">最近節奏</h2>
          <p className="section-copy">拉開到一週來看，確認你的時間分配是不是正在往對的方向走。</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-7">
          <Card className="xl:col-span-4">
            <CardHeader>
              <CardTitle>7 日學習趨勢</CardTitle>
              <CardDescription>每天投入的學習分鐘數。</CardDescription>
            </CardHeader>
            <CardContent className="pl-2 pr-4 sm:pl-4">
              <div className="h-[300px] sm:h-[360px]">
                <TrendChart data={data.trendData} />
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-3">
            <CardHeader>
              <CardTitle>本週科目分配</CardTitle>
              <CardDescription>看看你的時間目前偏向哪一科。</CardDescription>
            </CardHeader>
            <CardContent>
              {data.subjectHours.length > 0 ? (
                <div className="h-[300px] sm:h-[360px]">
                  <SubjectChart data={data.subjectHours} />
                </div>
              ) : (
                <InlineEmptyState
                  title="本週還沒有科目分配資料"
                  description="先記一筆學習紀錄，這裡就會開始顯示你的投入比例。"
                  href="/study-log"
                  cta="去新增紀錄"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="section-heading">現在最該補的地方</h2>
          <p className="section-copy">不是把資料堆上來，而是幫你把真正會掉分的地方挑出來。</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>弱點單元雷達</CardTitle>
              <CardDescription>先處理分數最低、最容易失血的章節。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.weakestAreas.length > 0 ? (
                data.weakestAreas.slice(0, 4).map((item) => (
                  <WeakAreaRow key={item.key} item={item} />
                ))
              ) : (
                <InlineEmptyState
                  title="目前沒有明顯弱點單元"
                  description="繼續做題吧；一旦累積到足夠資料，這裡就會開始幫你抓出最危險的章節。"
                  href="/practice"
                  cta="去做練習"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>下一個複習重點</CardTitle>
              <CardDescription>把注意力先放在今天已經到期的東西。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.nextReviewFocus.length > 0 ? (
                data.nextReviewFocus.map((task) => (
                  <ReviewFocusRow key={task.id} task={task} />
                ))
              ) : (
                <InlineEmptyState
                  title="今天沒有待辦複習"
                  description="任務中心目前是清的。你可以去做一組新練習，讓系統重新排程。"
                  href="/practice"
                  cta="開始練習"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>直接去做</CardTitle>
              <CardDescription>最短路徑，不用想太多。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ActionTile
                href="/review"
                title={data.pendingReviews > 0 ? "先清今日複習" : "檢查任務中心"}
                description={
                  data.pendingReviews > 0
                    ? `有 ${data.pendingReviews} 個到期任務，先把記憶債清掉。`
                    : "確認今天真的沒有漏掉的複習。"
                }
              />
              <ActionTile
                href="/practice"
                title="做一組題目"
                description="最快能更新準備度，也最容易看出哪個 topic 真正有問題。"
              />
              <ActionTile
                href="/study-log"
                title="補上學習紀錄"
                description="如果今天其實有讀，記下來後首頁判斷會更準。"
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {data.completedToday ? (
        <div className="surface-subtle flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-500/12 p-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">今天的待辦已經清空</p>
              <p className="text-sm text-muted-foreground">可以休息一下，或再做一組練習替明天暖身。</p>
            </div>
          </div>
          <Link href="/practice" className="inline-flex h-8 items-center justify-center rounded-xl border border-border/90 bg-background/80 px-3 text-sm font-medium transition-all duration-200 hover:bg-muted hover:text-foreground">
            再做一組練習
          </Link>
        </div>
      ) : null}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  helper,
  detail,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  helper: string
  detail: string
  icon: ComponentType<{ className?: string }>
  accent: string
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/75 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{helper}</p>
          <p className="mt-2 text-sm font-medium text-foreground">{label}</p>
        </div>
        <div className={`rounded-2xl bg-muted/80 p-2 ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-5 text-3xl font-semibold tracking-tight text-foreground">{value}</div>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

function SubjectReadinessCard({ item }: { item: DashboardSubjectReadinessItem }) {
  const ctaHref = item.dueReviews > 0 || item.vocabularyDue > 0 ? "/review" : "/practice"

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Subject readiness</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{item.subjectName}</h3>
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-medium ${readinessBadgeClass(item.level)}`}>
            {readinessLabel(item.level)}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-end justify-between gap-3">
            <div className="text-4xl font-semibold tracking-tight text-foreground">{item.score}</div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{momentumLabel(item.momentum)}</p>
              <p>{item.lastActivityDays !== null ? `上次碰這科：${item.lastActivityDays} 天前` : "還沒有活動紀錄"}</p>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${readinessBarClass(item.level)}`}
              style={{ width: `${item.score}%` }}
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <MetricChip label="7 日投入" value={`${item.studyMinutes7d} 分`} />
          <MetricChip
            label="14 日正確率"
            value={item.practiceAccuracy14d !== null ? `${item.practiceAccuracy14d}%` : "尚無資料"}
          />
          <MetricChip label="待複習" value={`${item.dueReviews} 項`} />
          <MetricChip label="未掌握錯題" value={`${item.unresolvedWrongCount} 題`} />
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm">
          <p className="font-medium text-foreground">
            目前弱點：{item.weakTopic ? `${item.subjectName}・${item.weakTopic}` : "還在累積資料"}
          </p>
          <p className="mt-2 leading-6 text-muted-foreground">{item.suggestedAction}</p>
          {item.vocabularyFamiliarRate !== null ? (
            <p className="mt-2 text-xs text-muted-foreground">
              單字熟悉度 {item.vocabularyFamiliarRate}% · 到期單字 {item.vocabularyDue} 個
            </p>
          ) : null}
        </div>

        <Link href={ctaHref} className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-border/90 bg-background/80 px-4 text-sm font-medium transition-all duration-200 hover:border-primary/30 hover:bg-muted hover:text-foreground">
          直接去處理這科
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  )
}

function CoverageOverviewCard({ item }: { item: DashboardSubjectCoverageItem }) {
  return (
    <Card>
      <CardContent className="space-y-4 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Coverage</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{item.subjectName}</h3>
          </div>
          <div className="text-right">
            <p className="text-3xl font-semibold tracking-tight text-foreground">{item.coverageRate}%</p>
            <p className="text-xs text-muted-foreground">已覆蓋 {item.coveredTopics}/{item.totalTopics}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${coverageBarClass(item.coverageRate)}`}
              style={{ width: `${item.coverageRate}%` }}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <MetricChip label="已碰過" value={`${item.coveredTopics} 個`} />
            <MetricChip label="還沒碰" value={`${item.untouchedTopics} 個`} />
            <MetricChip label="最近活躍" value={`${item.activeTopics} 個`} />
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm">
          <p className="font-medium text-foreground">目前最該留意：{item.weakTopic ?? "還沒有明顯弱點"}</p>
          <p className="mt-2 text-muted-foreground">
            {item.totalTopics > 0
              ? item.untouchedTopics > 0
                ? `還有 ${item.untouchedTopics} 個 topic 沒正式碰過，這些最容易在考前變成盲區。`
                : "這科目前沒有明顯的範圍空洞，接下來要做的是把弱點拉穩。"
              : "目前還沒有足夠的 topic 資料。"}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function SubjectTopicSectionCard({ section }: { section: DashboardSubjectTopicSectionItem }) {
  const visibleTopics = section.topics.slice(0, 6)
  const remainingCount = Math.max(0, section.topics.length - visibleTopics.length)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{section.subjectName} topic 明細</CardTitle>
        <CardDescription>
          已覆蓋 {section.coverage.coveredTopics}/{section.coverage.totalTopics} 個 topic · 未碰 {section.coverage.untouchedTopics} 個
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleTopics.length > 0 ? (
          visibleTopics.map((topic) => <TopicDetailRow key={topic.key} item={topic} />)
        ) : (
          <InlineEmptyState
            title="這科還沒有 topic 資料"
            description="先匯入題目或記錄學習，這裡就會開始整理章節明細。"
            href="/import"
            cta="去匯入"
          />
        )}

        {remainingCount > 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background/60 px-4 py-3 text-sm text-muted-foreground">
            還有 {remainingCount} 個 topic 沒有展開，之後可以再把這區做成獨立頁面。
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function TopicDetailRow({ item }: { item: DashboardTopicDetailItem }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{item.topic}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
        </div>
        <div className={`rounded-full px-2.5 py-1 text-xs font-medium ${readinessBadgeClass(item.status)}`}>
          {readinessLabel(item.status)}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <MiniMetric label="分數" value={`${item.score}`} />
        <MiniMetric label="7 日投入" value={`${item.studyMinutes7d} 分`} />
        <MiniMetric
          label="14 日正確率"
          value={item.practiceAccuracy14d !== null ? `${item.practiceAccuracy14d}%` : item.hasActivity ? "—" : "未覆蓋"}
        />
        <MiniMetric label="待補量" value={`${item.dueReviews + item.wrongCount}`} />
      </div>
    </div>
  )
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function PlanStep({ item, index }: { item: DashboardPlanItem; index: number }) {
  return (
    <Link href={item.href} className="block rounded-2xl border border-border/70 bg-background/70 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-background">
      <div className="flex items-start gap-3">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${planStepToneClass(item.tone)}`}>
          {index + 1}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">{item.title}</p>
          <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
          <p className="text-xs text-muted-foreground">{item.reason}</p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    </Link>
  )
}

function WeakAreaRow({ item }: { item: DashboardWeakAreaItem }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {item.subjectName}・{item.topic}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityBadgeClass(item.priority)}`}>
          {priorityLabel(item.priority)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MiniMetric label="分數" value={`${item.score}`} />
        <MiniMetric
          label="正確率"
          value={item.practiceAccuracy !== null ? `${item.practiceAccuracy}%` : "—"}
        />
        <MiniMetric label="待補量" value={`${item.dueReviews + item.wrongCount}`} />
      </div>
    </div>
  )
}

function ReviewFocusRow({ task }: { task: DashboardReviewFocusItem }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {task.subject.name}・{task.topic}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            複習日：{format(task.reviewDate, "yyyy/MM/dd")} · Day {task.reviewStage}
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          Stage {task.reviewStage}
        </span>
      </div>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function ActionTile({
  href,
  title,
  description,
}: {
  href: string
  title: string
  description: string
}) {
  return (
    <Link href={href} className="block rounded-2xl border border-border/70 bg-background/70 p-4 transition-all duration-200 hover:border-primary/30 hover:bg-background">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </Link>
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
    <div className="flex h-full min-h-[220px] flex-col items-start justify-center rounded-2xl border border-dashed border-border bg-background/60 p-5 text-left">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <Link href={href} className="mt-4 inline-flex h-8 items-center justify-center rounded-xl border border-border/90 bg-background/80 px-3 text-sm font-medium transition-all duration-200 hover:bg-muted hover:text-foreground">
        {cta}
      </Link>
    </div>
  )
}

function EmptyStateHint({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

function readinessLabel(level: DashboardSubjectReadinessItem["level"] | DashboardTopicDetailItem["status"]) {
  switch (level) {
    case "strong":
      return "穩定"
    case "steady":
      return "可控"
    case "warning":
      return "偏危險"
    default:
      return "急救中"
  }
}

function readinessBadgeClass(level: DashboardSubjectReadinessItem["level"] | DashboardTopicDetailItem["status"]) {
  switch (level) {
    case "strong":
      return "bg-emerald-500/12 text-emerald-700"
    case "steady":
      return "bg-sky-500/12 text-sky-700"
    case "warning":
      return "bg-amber-500/12 text-amber-700"
    default:
      return "bg-rose-500/12 text-rose-700"
  }
}

function readinessBarClass(level: DashboardSubjectReadinessItem["level"]) {
  switch (level) {
    case "strong":
      return "bg-emerald-500"
    case "steady":
      return "bg-sky-500"
    case "warning":
      return "bg-amber-500"
    default:
      return "bg-rose-500"
  }
}

function coverageBarClass(rate: number) {
  if (rate >= 80) return "bg-emerald-500"
  if (rate >= 60) return "bg-sky-500"
  if (rate >= 40) return "bg-amber-500"
  return "bg-rose-500"
}

function momentumLabel(momentum: DashboardSubjectReadinessItem["momentum"]) {
  switch (momentum) {
    case "up":
      return "狀態往上"
    case "down":
      return "需要拉回"
    default:
      return "先穩住節奏"
  }
}

function priorityLabel(priority: DashboardWeakAreaItem["priority"]) {
  switch (priority) {
    case "high":
      return "高優先"
    case "medium":
      return "中優先"
    default:
      return "觀察中"
  }
}

function priorityBadgeClass(priority: DashboardWeakAreaItem["priority"]) {
  switch (priority) {
    case "high":
      return "bg-rose-500/12 text-rose-700"
    case "medium":
      return "bg-amber-500/12 text-amber-700"
    default:
      return "bg-sky-500/12 text-sky-700"
  }
}

function planStepToneClass(tone: DashboardPlanItem["tone"]) {
  switch (tone) {
    case "danger":
      return "bg-rose-500/12 text-rose-700"
    case "warning":
      return "bg-amber-500/12 text-amber-700"
    case "success":
      return "bg-emerald-500/12 text-emerald-700"
    default:
      return "bg-primary/12 text-primary"
  }
}

function statusBadgeClass(tone: "success" | "warning" | "normal") {
  if (tone === "success") {
    return "rounded-2xl bg-emerald-500/12 p-2 text-emerald-600"
  }

  if (tone === "warning") {
    return "rounded-2xl bg-amber-500/12 p-2 text-amber-600"
  }

  return "rounded-2xl bg-primary/12 p-2 text-primary"
}
