import Link from "next/link"
import { BookOpen, Clock3, Flame, PlusCircle, Trash2 } from "lucide-react"

import { getSubjects } from "@/app/actions/subject"
import { deleteStudyLog, getStudyLogs } from "@/app/actions/study-log"
import { formatDateTimeInTaipei } from "@/lib/date-utils"
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
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Header — compact */}
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">學習紀錄</h1>
        <div className="grid grid-cols-3 gap-3">
          <MiniStat icon={Clock3} label="今日累積" value={`${todayStudyMinutes} 分`} />
          <MiniStat icon={Flame} label="完成進度" value={`${completedTodayCount} 筆`} />
          <MiniStat icon={BookOpen} label="投入科目" value={`${uniqueSubjectCount} 科`} />
        </div>
      </div>

      {/* Form or empty state */}
      {subjects.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <PlusCircle className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">先新增科目</h2>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                建立科目後就能開始計時讀書、累積學習紀錄。
              </p>
            </div>
            <Link href="/settings" className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/92">
              前往設定新增科目
            </Link>
          </CardContent>
        </Card>
      ) : (
        <StudyLogForm subjects={subjects} todayStudyMinutes={todayStudyMinutes} />
      )}

      {/* Logs — single card */}
      <Card>
        <CardHeader>
          <CardTitle>學習紀錄</CardTitle>
          <CardDescription>最近的學習紀錄，最多顯示 10 筆。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {logs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background/60 px-5 py-8 text-center">
              <p className="text-sm font-medium text-foreground">還沒有學習紀錄</p>
              <p className="mt-1 text-xs text-muted-foreground">開一個番茄鐘或手動補登，這裡就會開始累積。</p>
            </div>
          ) : (
            logs.slice(0, 10).map((log) => <StudyLogCard key={log.id} log={log} isToday={new Date(log.study_date).toDateString() === todayKey} />)
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/75 px-4 py-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  )
}

function StudyLogCard({ log, isToday }: { log: StudyLogListItem; isToday: boolean }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {log.subject.name} · {log.topic}
            </p>
            <Badge variant="secondary">{log.study_type}</Badge>
            {isToday ? <Badge variant="outline">今天</Badge> : null}
            {log.planned_done ? <Badge variant="outline">已完成</Badge> : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{formatDateTimeInTaipei(log.study_date)}</span>
            <span>{log.duration_minutes} 分鐘</span>
            <span>專注 {log.focus_score}/5</span>
          </div>

          {log.notes ? (
            <p className="text-sm leading-6 text-muted-foreground">{log.notes}</p>
          ) : null}
        </div>

        <form
          action={async () => {
            "use server"
            await deleteStudyLog(log.id)
          }}
          className="shrink-0"
        >
          <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </div>
  )
}
