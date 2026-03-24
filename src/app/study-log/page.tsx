import Link from "next/link"
import { format } from "date-fns"
import { BookOpen, Clock3, Flame, PlusCircle, Trash2 } from "lucide-react"

import { getSubjects } from "@/app/actions/subject"
import { deleteStudyLog, getStudyLogs } from "@/app/actions/study-log"
import { StudyLogForm } from "./study-log-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { StudyLogListItem } from "@/types"

export default async function StudyLogPage() {
  const subjects = await getSubjects()
  const logs = await getStudyLogs()

  const todayKey = new Date().toDateString()
  const todayLogs = logs.filter((log) => new Date(log.study_date).toDateString() === todayKey)
  const todayStudyMinutes = todayLogs.reduce((sum, log) => sum + log.duration_minutes, 0)
  const completedTodayCount = todayLogs.filter((log) => log.planned_done).length
  const uniqueSubjectCount = new Set(todayLogs.map((log) => log.subject.id)).size

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:gap-8">
      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardContent className="space-y-5 px-5 py-6 sm:px-6 sm:py-7">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Clock3 className="h-4 w-4" />
              學習紀錄 · 計時主導
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                把讀書這件事，變成一個可以開始、暫停、完成的 session。
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                這頁現在以計時與番茄鐘為主，不只是補資料。你可以先開一段專注 session，結束後再補上專注度與備註，讓紀錄更自然。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="今日累積" value={`${todayStudyMinutes} 分鐘`} detail="來自今天已儲存的學習紀錄" icon={Clock3} />
              <StatCard label="完成進度" value={`${completedTodayCount} 筆`} detail="標記為有完成預定內容" icon={Flame} />
              <StatCard label="投入科目" value={`${uniqueSubjectCount} 科`} detail="今天有碰到的科目數量" icon={BookOpen} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>今天適合怎麼用</CardTitle>
            <CardDescription>先開始，再補細節，不要一上來就填很多欄位。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>• 要開始讀書：直接開番茄鐘</p>
            <p>• 剛讀完想補記錄：切到手動補登</p>
            <p>• 想追蹤節奏：看下方今天 / 最近紀錄</p>
          </CardContent>
        </Card>
      </section>

      {subjects.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[300px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <PlusCircle className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">先新增科目，計時器才知道在記什麼</h2>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                例如數學、英文、物理。建立好之後，這頁就能用 session 的方式把你的讀書過程記下來。
              </p>
            </div>
            <Link href="/settings" className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[0_10px_24px_color-mix(in_oklab,var(--primary)_28%,transparent)] transition-all duration-200 hover:bg-primary/92 hover:shadow-[0_14px_30px_color-mix(in_oklab,var(--primary)_32%,transparent)]">
              前往設定新增科目
            </Link>
          </CardContent>
        </Card>
      ) : (
        <StudyLogForm subjects={subjects} todayStudyMinutes={todayStudyMinutes} />
      )}

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>今天的紀錄</CardTitle>
            <CardDescription>看今天實際讀了哪些東西，節奏有沒有跑掉。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayLogs.length === 0 ? (
              <InlineEmptyState
                title="今天還沒有紀錄"
                description="先開一個專注 session 吧。讀完第一輪，這裡就會開始累積。"
              />
            ) : (
              todayLogs.map((log) => <StudyLogCard key={log.id} log={log} />)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最近紀錄</CardTitle>
            <CardDescription>保留最近的學習痕跡，方便回頭接著讀。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {logs.length === 0 ? (
              <InlineEmptyState
                title="還沒有任何學習紀錄"
                description="從第一個番茄鐘開始吧，這裡會慢慢變成你的讀書軌跡。"
              />
            ) : (
              logs.slice(0, 8).map((log) => <StudyLogCard key={log.id} log={log} />)
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
  detail,
  icon: Icon,
}: {
  label: string
  value: string
  detail: string
  icon: typeof Clock3
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/75 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

function StudyLogCard({ log }: { log: StudyLogListItem }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {log.subject.name}・{log.topic}
            </p>
            <Badge variant="secondary">{log.study_type}</Badge>
            {log.planned_done ? <Badge variant="outline">已完成</Badge> : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{format(log.study_date, "yyyy/MM/dd HH:mm")}</span>
            <span>{log.duration_minutes} 分鐘</span>
            <span>專注度 {log.focus_score}/5</span>
          </div>

          {log.notes ? (
            <p className="rounded-2xl bg-card/80 px-3 py-2 text-sm leading-6 text-muted-foreground">
              {log.notes}
            </p>
          ) : null}
        </div>

        <form
          action={async () => {
            "use server"
            await deleteStudyLog(log.id)
          }}
          className="sm:self-center"
        >
          <Button type="submit" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="h-4 w-4" />
            刪除
          </Button>
        </form>
      </div>
    </div>
  )
}

function InlineEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-start justify-center rounded-2xl border border-dashed border-border bg-background/60 p-5">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}
