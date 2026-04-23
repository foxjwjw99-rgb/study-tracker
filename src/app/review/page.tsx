import Link from "next/link"
import { getReviewTasks, completeReviewTask } from "@/app/actions/review"
import { getWrongQuestionsWithFilters, getWrongQuestionStats } from "@/app/actions/wrong-questions"
import { getSubjects } from "@/app/actions/subject"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { differenceInCalendarDays, format, startOfDay } from "date-fns"
import { Button } from "@/components/ui/button"
import { BookOpen, PlayCircle } from "lucide-react"
import { ManualReviewTaskForm } from "./manual-review-task-form"
import { VocabularyReviewTaskControls } from "./vocabulary-review-task-controls"
import { WrongQuestionList } from "@/app/wrong-questions/wrong-question-list"
import { ManualWrongQuestionForm } from "@/app/wrong-questions/manual-wrong-question-form"
import type { ReviewTaskItem } from "@/types"

export default async function ReviewPage() {
  const [subjects, reviews, wrongItems, wrongStats] = await Promise.all([
    getSubjects(),
    getReviewTasks(),
    getWrongQuestionsWithFilters({ limit: 200 }),
    getWrongQuestionStats(),
  ])

  const today = startOfDay(new Date())

  const overdueReviews = reviews.filter((task) => differenceInCalendarDays(today, new Date(task.review_date)) > 0)
  const dueTodayReviews = reviews.filter((task) => differenceInCalendarDays(today, new Date(task.review_date)) === 0)
  const overdueCount = overdueReviews.length

  return (
    <div className="mx-auto max-w-6xl space-y-6 lg:space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">複習與錯題</h1>
        <p className="text-sm leading-7 text-muted-foreground sm:text-base">
          先清逾期、再消今天、最後才開新題，節奏會穩很多。
        </p>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          建議順序：<span className="font-semibold">逾期複習 → 今天到期 → 再看錯題狀態</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="待處理複習" value={`${reviews.length} 項`} detail="今天以前該完成的任務" />
        <SummaryCard label="已逾期" value={`${overdueCount} 項`} detail={overdueCount > 0 ? "這些最值得先清掉" : "沒有逾期，節奏不錯"} tone={overdueCount > 0 ? "warning" : "default"} />
        <SummaryCard label="未掌握錯題" value={`${wrongStats.unresolvedCount} 題`} detail={wrongStats.dueCount > 0 ? `今天到期 ${wrongStats.dueCount} 題` : "今天沒有到期錯題"} />
      </div>

      {subjects.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>手動新增複習任務</CardTitle>
            <CardDescription>如果這筆任務不是從錯題或題庫練習自動產生，可以直接在這裡加入。</CardDescription>
          </CardHeader>
          <CardContent>
            <ManualReviewTaskForm subjects={subjects} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>今日複習任務</CardTitle>
          <CardDescription>排定於今日或已逾期的任務。</CardDescription>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background/60 px-5 py-8 text-center">
              <p className="text-sm font-medium text-foreground">目前沒有待複習任務！太棒了。</p>
              <p className="mt-1 text-xs text-muted-foreground">所有複習都已完成，繼續保持。</p>
            </div>
          ) : (
            <div className="space-y-5">
              {overdueReviews.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">先清逾期複習</p>
                      <p className="text-xs text-muted-foreground">這些最影響記憶保留，建議優先處理。</p>
                    </div>
                    <Badge variant="destructive">{overdueReviews.length} 項</Badge>
                  </div>
                  {overdueReviews.map((task: ReviewTaskItem) => {
                    const overdueDays = differenceInCalendarDays(today, new Date(task.review_date))
                    return (
                      <ReviewTaskCard key={task.id} task={task} overdueDays={overdueDays} />
                    )
                  })}
                </div>
              ) : null}

              {dueTodayReviews.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">今天到期</p>
                      <p className="text-xs text-muted-foreground">逾期清完後，再把今天該做的處理掉。</p>
                    </div>
                    <Badge variant="secondary">{dueTodayReviews.length} 項</Badge>
                  </div>
                  {dueTodayReviews.map((task: ReviewTaskItem) => (
                    <ReviewTaskCard key={task.id} task={task} overdueDays={0} />
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">錯題本</h2>
          <p className="text-sm text-muted-foreground">每題沿著 1 → 3 → 7 → 14 天複習鏈前進，走完才算掌握。</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="今天到期" value={wrongStats.dueCount} tone={wrongStats.dueCount > 0 ? "warning" : "default"} />
          <StatCard label="未掌握錯題" value={wrongStats.unresolvedCount} />
          <StatCard label="最近 7 天新增" value={wrongStats.recentAddedCount} />
          <StatCard label="最近 7 天已掌握" value={wrongStats.recentMasteredCount} />
        </div>

        {wrongStats.dueCount > 0 && (
          <div className="flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              有 <span className="font-semibold">{wrongStats.dueCount}</span> 題今天到期，可以開始複習了。
            </p>
            <Link href="/wrong-questions/review" className="inline-flex items-center justify-center rounded-xl border border-transparent bg-primary px-2.5 py-1 text-[0.8rem] font-medium text-primary-foreground transition-all hover:bg-primary/90">
              <PlayCircle className="mr-2 h-4 w-4" />
              開始複習
            </Link>
          </div>
        )}

        {subjects.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>手動加入錯題</CardTitle>
              <CardDescription>適合加入考卷、講義、自己算錯但不在題庫裡的題目。</CardDescription>
            </CardHeader>
            <CardContent>
              <ManualWrongQuestionForm subjects={subjects} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              所有錯題
            </CardTitle>
            <Link href="/wrong-questions/review" className="inline-flex items-center justify-center rounded-xl border border-border/90 bg-background/80 px-2.5 py-1 text-[0.8rem] font-medium text-foreground transition-all hover:bg-muted">
              複習到期錯題
            </Link>
          </CardHeader>
          <CardContent>
            <WrongQuestionList initialItems={wrongItems} subjects={subjects} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string
  value: string
  detail: string
  tone?: "default" | "warning"
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/75 p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p
        className={
          tone === "warning"
            ? "mt-2 text-3xl font-semibold tracking-tight text-amber-600"
            : "mt-2 text-3xl font-semibold tracking-tight text-foreground"
        }
      >
        {value}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number
  tone?: "default" | "warning"
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${tone === "warning" ? "text-destructive" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  )
}

function ReviewTaskCard({
  task,
  overdueDays,
}: {
  task: ReviewTaskItem
  overdueDays: number
}) {
  const isOverdue = overdueDays > 0

  return (
    <div
      className={
        isOverdue
          ? "flex flex-col gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
          : "flex flex-col gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between"
      }
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-semibold">
            {task.source_type === "vocabulary" && task.vocabulary_word
              ? task.vocabulary_word.word
              : `${task.subject?.name ?? "未分類"} - ${task.topic}`}
          </div>
          {task.source_type === "vocabulary" ? (
            <Badge variant="outline">{task.vocabulary_list?.name ?? "英文單字"}</Badge>
          ) : null}
          {isOverdue ? (
            <Badge variant="destructive">逾期 {overdueDays} 天</Badge>
          ) : (
            <Badge variant="secondary" className="bg-amber-500/12 text-amber-700 dark:bg-amber-500/18 dark:text-amber-200">
              今天到期
            </Badge>
          )}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          階段：第 {task.review_stage} 天 · 預定：{format(task.review_date, "yyyy/MM/dd")}
        </div>
        {task.source_type === "vocabulary" && task.vocabulary_word ? (
          <VocabularyReviewTaskControls
            taskId={task.id}
            word={task.vocabulary_word.word}
            meaning={task.vocabulary_word.meaning}
          />
        ) : null}
      </div>
      {task.source_type === "vocabulary" ? null
        : task.source_type === "wrong_question" ? (
          task.wrong_question_id ? (
            <Link href={`/wrong-questions/review?questionId=${task.wrong_question_id}`} className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 sm:w-auto">
              去作答
            </Link>
          ) : null
        ) : (
          <form
            action={async () => {
              "use server"
              await completeReviewTask(task.id, 100)
            }}
            className="w-full sm:w-auto"
          >
            <Button size="sm" className="w-full sm:w-auto">完成</Button>
          </form>
        )}
    </div>
  )
}
