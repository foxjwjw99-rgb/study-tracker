"use client"

import Link from "next/link"
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  FileQuestion,
  GraduationCap,
  Sparkles,
  TrendingUp,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import type { PriorityAction, PriorityActionKind } from "@/types"

const KIND_ICON: Record<PriorityActionKind, typeof AlertTriangle> = {
  wrong_questions: FileQuestion,
  overdue_reviews: BookOpenCheck,
  weak_unit: AlertTriangle,
  uncovered_unit: ClipboardList,
  mock_exam: GraduationCap,
}

const KIND_TONE: Record<PriorityActionKind, string> = {
  wrong_questions: "text-orange-600 bg-orange-50",
  overdue_reviews: "text-amber-600 bg-amber-50",
  weak_unit: "text-red-600 bg-red-50",
  uncovered_unit: "text-sky-600 bg-sky-50",
  mock_exam: "text-violet-600 bg-violet-50",
}

function ActionRow({ action, rank }: { action: PriorityAction; rank: number }) {
  const Icon = KIND_ICON[action.kind]
  const iconTone = KIND_TONE[action.kind]
  const isHashLink = action.href?.startsWith("#") ?? false

  const ctaClass = buttonVariants({ size: "sm", variant: "outline" })
  const cta =
    action.href && action.ctaLabel ? (
      isHashLink ? (
        <a href={action.href} className={ctaClass}>
          {action.ctaLabel}
        </a>
      ) : (
        <Link href={action.href} className={ctaClass}>
          {action.ctaLabel}
        </Link>
      )
    ) : null

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card px-3 py-3 sm:items-center">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
        {rank}
      </div>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconTone}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px]">
            {action.subjectName}
          </Badge>
          <p className="text-sm font-medium">{action.title}</p>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{action.description}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums text-emerald-600">
          <TrendingUp className="h-3 w-3" />+{action.estimatedPointGain}
        </span>
        {cta}
      </div>
    </div>
  )
}

export function PriorityActionsCard({ actions }: { actions: PriorityAction[] }) {
  if (actions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            本週優先行動
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>目前沒有明顯的補分機會，維持現有節奏即可。</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-amber-500" />
          本週優先行動
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          按預估補分排序，從最划算的開始；數字為對總分的預估加分。
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action, idx) => (
          <ActionRow key={action.id} action={action} rank={idx + 1} />
        ))}
      </CardContent>
    </Card>
  )
}
