import Link from "next/link"
import { BookOpen, PlayCircle } from "lucide-react"

import { getWrongQuestionsWithFilters, getWrongQuestionStats } from "@/app/actions/wrong-questions"
import { getSubjects } from "@/app/actions/subject"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { WrongQuestionList } from "./wrong-question-list"

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: "warning" | "default" }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${tone === "warning" ? "text-destructive" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  )
}

export default async function WrongQuestionsPage() {
  const [subjects, items, stats] = await Promise.all([
    getSubjects(),
    getWrongQuestionsWithFilters({ limit: 200 }),
    getWrongQuestionStats(),
  ])

  return (
    <div className="mx-auto max-w-4xl space-y-6 lg:space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">錯題本</h1>
        <p className="text-sm leading-7 text-muted-foreground sm:text-base">
          管理所有錯題，安排複習，追蹤掌握進度。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="今天到期" value={stats.dueCount} tone={stats.dueCount > 0 ? "warning" : "default"} />
        <StatCard label="未掌握錯題" value={stats.unresolvedCount} />
        <StatCard label="最近 7 天新增" value={stats.recentAddedCount} />
        <StatCard label="最近 7 天已掌握" value={stats.recentMasteredCount} />
      </div>

      {stats.dueCount > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            有 <span className="font-semibold">{stats.dueCount}</span> 題今天到期，可以開始複習了。
          </p>
          <Link href="/wrong-questions/review" className={cn(buttonVariants({ size: "sm" }))}>
            <PlayCircle className="mr-2 h-4 w-4" />
            開始複習
          </Link>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            所有錯題
          </CardTitle>
          <Link href="/wrong-questions/review" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
            複習到期錯題
          </Link>
        </CardHeader>
        <CardContent>
          <WrongQuestionList initialItems={items} subjects={subjects} />
        </CardContent>
      </Card>
    </div>
  )
}
