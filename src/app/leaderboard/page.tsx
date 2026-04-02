import Link from "next/link"
import { Trophy } from "lucide-react"

import { getStudyLeaderboardData } from "@/app/actions/study-group"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LeaderboardPeriod } from "@/types"

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ groupId?: string; period?: LeaderboardPeriod }>
}) {
  const params = (await searchParams) ?? {}
  const period = params.period === "today" ? "today" : "week"
  const data = await getStudyLeaderboardData({
    groupId: params.groupId,
    period,
  })

  if (!data.activeGroup) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Card>
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <Trophy className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">你還沒有加入任何讀書房</h1>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                先到設定頁建立一個房間，或輸入朋友給你的邀請碼加入，這裡就會出現排行榜。
              </p>
            </div>
            <Link href="/settings" className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[0_10px_24px_color-mix(in_oklab,var(--primary)_28%,transparent)] transition-all duration-200 hover:bg-primary/92 hover:shadow-[0_14px_30px_color-mix(in_oklab,var(--primary)_32%,transparent)]">
              前往設定
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:gap-8">
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="space-y-4 px-5 py-5 sm:space-y-5 sm:px-6 sm:py-7">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Trophy className="h-4 w-4" />
              讀書排行榜
            </div>
            <div className="hidden space-y-2 sm:block">
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                和朋友比的，不只是熱血，是實際累積下來的計時讀書時間。
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                目前只計算計時器產生的學習紀錄，手動補登不進榜，這樣比較公平。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.groups.map((group) => (
                <Link
                  key={group.id}
                  href={`/leaderboard?groupId=${group.id}&period=${data.activePeriod}`}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-all duration-200",
                    group.id === data.activeGroup?.id
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/70 bg-background/80 text-muted-foreground hover:border-primary/20 hover:text-foreground"
                  )}
                >
                  {group.name}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{data.activeGroup.name}</CardTitle>
            <CardDescription>邀請碼 {data.activeGroup.invite_code} · {data.activeGroup.memberCount} 人</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <PeriodLink groupId={data.activeGroup.id} period="today" activePeriod={data.activePeriod}>
                今日
              </PeriodLink>
              <PeriodLink groupId={data.activeGroup.id} period="week" activePeriod={data.activePeriod}>
                本週
              </PeriodLink>
            </div>

            {data.currentUserEntry ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/8 p-4">
                <p className="text-sm font-medium text-foreground">你的目前位置</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-2xl font-semibold tracking-tight text-foreground">第 {data.currentUserEntry.rank} 名</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatMinutes(data.currentUserEntry.totalMinutes)} · {data.currentUserEntry.totalSessions} 次 session
                    </p>
                  </div>
                  <Badge variant="secondary">{data.activePeriod === "today" ? "今日" : "本週"}</Badge>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{data.activePeriod === "today" ? "今日排行" : "本週排行"}</CardTitle>
          <CardDescription>依照 timer session 累積分鐘數排序，平手時再看 session 次數。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background/60 p-5">
              <p className="text-sm font-medium text-foreground">還沒有人開始計時讀書</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">先去學習紀錄頁開一輪番茄鐘，這裡就會開始變動了。</p>
            </div>
          ) : (
            data.entries.map((entry) => (
              <div
                key={entry.userId}
                className={cn(
                  "rounded-2xl border p-4 transition-all duration-200",
                  entry.isCurrentUser
                    ? "border-primary/25 bg-primary/7"
                    : "border-border/70 bg-background/70"
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-semibold",
                      entry.rank === 1 && "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
                      entry.rank === 2 && "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-300",
                      entry.rank === 3 && "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
                      entry.rank > 3 && "bg-muted text-foreground"
                    )}>
                      {entry.rank <= 3 ? ["", "🥇", "🥈", "🥉"][entry.rank] : `#${entry.rank}`}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-foreground">{entry.userName}</p>
                        {entry.isCurrentUser ? <Badge variant="outline">你</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{entry.totalSessions} 次 timer session</p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-2xl font-semibold tracking-tight text-foreground">{formatMinutes(entry.totalMinutes)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{entry.totalMinutes} 分鐘</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PeriodLink({
  groupId,
  period,
  activePeriod,
  children,
}: {
  groupId: string
  period: LeaderboardPeriod
  activePeriod: LeaderboardPeriod
  children: React.ReactNode
}) {
  return (
    <Link
      href={`/leaderboard?groupId=${groupId}&period=${period}`}
      className={cn(
        activePeriod === period
          ? "inline-flex min-w-20 items-center justify-center rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground shadow-[0_10px_24px_color-mix(in_oklab,var(--primary)_28%,transparent)] transition-all duration-200 hover:bg-primary/92"
          : "inline-flex min-w-20 items-center justify-center rounded-xl border border-border/90 bg-background/80 px-3 text-sm font-medium transition-all duration-200 hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </Link>
  )
}

function formatMinutes(totalMinutes: number) {
  if (totalMinutes < 60) {
    return `${totalMinutes} 分`
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (minutes === 0) {
    return `${hours} 小時`
  }

  return `${hours} 小時 ${minutes} 分`
}
