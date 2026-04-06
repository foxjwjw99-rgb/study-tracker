import { Gift, Sparkles, Ticket } from "lucide-react"

import { getRewardsData } from "@/app/actions/rewards"
import { DrawRewardButton, RewardRedeemButton } from "@/app/rewards/rewards-client"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { REWARD_DRAW_COST_MINUTES, REWARD_POOL } from "@/lib/rewards"

export default async function RewardsPage() {
  const data = await getRewardsData()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:gap-8">
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="space-y-5 px-5 py-6 sm:px-6 sm:py-7">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Gift className="h-4 w-4" />
              讀書獎勵池
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                每讀滿 {REWARD_DRAW_COST_MINUTES} 分鐘，就幫自己抽一次獎。
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                這頁會把你的讀書時間換成抽獎次數。先把讀書累積起來，再看今天會不會抽到大獎。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">總學習 {formatMinutes(data.overview.totalStudyMinutes)}</Badge>
              <Badge variant="outline">已用 {data.overview.usedDraws} 抽</Badge>
              <Badge variant="outline">剩餘累積 {data.overview.carryMinutes} 分鐘</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>現在可抽</CardTitle>
            <CardDescription>每滿 60 分鐘就自動多 1 次機會。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-primary/20 bg-primary/8 p-4">
              <p className="text-sm text-muted-foreground">可用抽獎次數</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">{data.overview.availableDraws}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                再讀 {Math.max(0, REWARD_DRAW_COST_MINUTES - data.overview.carryMinutes)} 分鐘，就會多一抽。
              </p>
            </div>

            <DrawRewardButton availableDraws={data.overview.availableDraws} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <StatCard label="累積可得抽數" value={`${data.overview.earnedDraws}`} helper="由總讀書分鐘換算" />
        <StatCard label="總獎勵價值" value={`$${data.overview.totalRewardValue}`} helper="已抽到的總價值" />
        <StatCard label="待兌換價值" value={`$${data.overview.pendingRedeemValue}`} helper="還沒標記兌換的部分" />
        <StatCard label="期望值 / 每小時" value={`$${data.overview.expectedValuePerHour}`} helper="照目前機率計算" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>獎池內容</CardTitle>
            <CardDescription>目前先照你指定的機率直接抽。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {REWARD_POOL.map((prize) => (
              <div key={prize.key} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{prize.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {prize.type === "cash" ? "現金獎勵" : "實體獎品"}
                    </p>
                  </div>
                  <Badge variant="outline">{prize.probabilityLabel}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>抽獎紀錄</CardTitle>
            <CardDescription>先把每一次結果記清楚，後面你要做統計或控預算都方便。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentDraws.length > 0 ? (
              data.recentDraws.map((reward) => (
                <div key={reward.id} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{reward.prize_label}</p>
                        <Badge variant={reward.redeemed ? "secondary" : "outline"}>
                          {reward.redeemed ? "已兌換" : "未兌換"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(reward.created_at)} · 中獎機率 {reward.probability_label}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-lg font-semibold tracking-tight text-foreground">${reward.prize_value}</p>
                        <p className="text-xs text-muted-foreground">{reward.prize_type === "cash" ? "現金" : "獎品價值"}</p>
                      </div>
                      <RewardRedeemButton reward={reward} />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-background/60 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">你還沒抽過</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      先去累積第一個 60 分鐘，這裡就會開始長出紀錄。
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  return (
    <Card>
      <CardContent className="space-y-2 px-5 py-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Ticket className="h-4 w-4" />
          <p className="text-sm">{label}</p>
        </div>
        <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
}

function formatMinutes(totalMinutes: number) {
  if (totalMinutes < 60) {
    return `${totalMinutes} 分鐘`
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes === 0 ? `${hours} 小時` : `${hours} 小時 ${minutes} 分鐘`
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}
