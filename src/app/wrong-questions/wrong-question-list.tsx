"use client"

import { useState, useTransition } from "react"
import { format } from "date-fns"
import { BookX, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { addToWrongBook, removeFromWrongBook } from "@/app/actions/wrong-questions"
import { updateWrongQuestionStatus } from "@/app/actions/review"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MathText } from "@/components/math-text"
import type { WrongQuestionWithQuestion } from "@/app/actions/wrong-questions"
import type { Subject } from "@/types"

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "未訂正",
  CORRECTED: "已訂正",
  MASTERED: "已掌握",
  ARCHIVED: "封存",
}

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "destructive",
  CORRECTED: "secondary",
  MASTERED: "default",
  ARCHIVED: "outline",
}

function safeParseOptions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed) && parsed.every((o) => typeof o === "string")) return parsed
  } catch {
    // ignore
  }
  return []
}

function WrongQuestionDetailDialog({
  item,
  open,
  onOpenChange,
}: {
  item: WrongQuestionWithQuestion | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!item) return null
  const q = item.question
  const isFib = q?.question_type === "fill_in_blank"
  const options = q ? safeParseOptions(q.options) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 text-sm font-semibold leading-snug">
            {item.subject.name}・{item.topic}
          </DialogTitle>
        </DialogHeader>

        {q ? (
          <div className="space-y-4">
            {/* Question text */}
            <div className="text-sm font-medium leading-relaxed">
              <MathText text={q.question} />
            </div>

            {/* Options or fill-in-blank */}
            {isFib ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/40 p-3 text-sm dark:bg-emerald-950/20">
                <span className="font-medium text-emerald-700 dark:text-emerald-300">正確答案：</span>
                <span className="text-foreground">{q.text_answer ?? "—"}</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {options.map((opt, idx) => {
                  const isCorrect = idx === q.answer
                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                        isCorrect
                          ? "border-emerald-500/40 bg-emerald-50/50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                          : "border-border/50 bg-background/50 text-muted-foreground"
                      }`}
                    >
                      <span className="shrink-0 font-mono font-semibold">{String.fromCharCode(65 + idx)}.</span>
                      <MathText text={opt} />
                      {isCorrect && <span className="ml-auto shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400">✓ 正確</span>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Explanation */}
            {q.explanation && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                <p className="font-medium text-foreground">解析</p>
                <p className="mt-1 text-muted-foreground">{q.explanation}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">此題目無完整資料（可能為手動加入）。</p>
        )}

        {/* Error reason / notes */}
        {(item.error_reason || item.notes) && (
          <div className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
            {item.error_reason && (
              <p className="text-muted-foreground"><span className="font-medium text-foreground">錯誤原因：</span>{item.error_reason}</p>
            )}
            {item.notes && (
              <p className="text-muted-foreground"><span className="font-medium text-foreground">備註：</span>{item.notes}</p>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <span>首錯：{format(new Date(item.first_wrong_date), "yyyy/MM/dd")}</span>
          <span>錯 {item.wrong_count} 次</span>
          <span>複習 {item.review_count} 次</span>
          {item.next_review_date && (
            <span>下次複習：{format(new Date(item.next_review_date), "yyyy/MM/dd")}</span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

type Props = {
  initialItems: WrongQuestionWithQuestion[]
  subjects: Subject[]
}

export function WrongQuestionList({ initialItems, subjects }: Props) {
  const [items, setItems] = useState(initialItems)
  const [filterSubject, setFilterSubject] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterCareless, setFilterCareless] = useState<boolean>(false)
  const [filterOverdue, setFilterOverdue] = useState<boolean>(false)
  const [isPending, startTransition] = useTransition()
  const [detailItem, setDetailItem] = useState<WrongQuestionWithQuestion | null>(null)

  const now = new Date()

  const filtered = items.filter((item) => {
    if (filterSubject !== "all" && item.subject_id !== filterSubject) return false
    if (filterStatus !== "all" && item.status !== filterStatus) return false
    if (filterCareless && !item.is_careless) return false
    if (filterOverdue) {
      if (!item.next_review_date) return false
      if (new Date(item.next_review_date) > now) return false
      if (item.status === "MASTERED" || item.status === "ARCHIVED") return false
    }
    return true
  })

  const handleStatusChange = (id: string, newStatus: "ACTIVE" | "CORRECTED" | "ARCHIVED") => {
    startTransition(async () => {
      try {
        await updateWrongQuestionStatus(id, newStatus)
        setItems((prev) => prev.map((item) => item.id === id ? { ...item, status: newStatus } : item))
        toast.success("已更新狀態。")
      } catch {
        toast.error("更新失敗。")
      }
    })
  }

  const handleRemove = (id: string) => {
    startTransition(async () => {
      const res = await removeFromWrongBook(id)
      if (res.success) {
        setItems((prev) => prev.map((item) => item.id === id ? { ...item, status: "ARCHIVED" } : item))
        toast.success(res.message)
      } else {
        toast.error(res.message)
      }
    })
  }

  const handleMarkCareless = (item: WrongQuestionWithQuestion) => {
    if (!item.question_id) return
    startTransition(async () => {
      const res = await addToWrongBook(item.question_id!, item.subject_id, "careless_mistake")
      if (res.success) {
        setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_careless: true, source_type: "careless_mistake" } : i))
        toast.success(res.message)
      } else {
        toast.error(res.message)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterSubject} onValueChange={(v) => setFilterSubject(v ?? "all")}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="所有科目" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有科目</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? "all")}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="所有狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有狀態</SelectItem>
            <SelectItem value="ACTIVE">未訂正</SelectItem>
            <SelectItem value="CORRECTED">已訂正</SelectItem>
            <SelectItem value="MASTERED">已掌握</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={filterOverdue ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterOverdue((v) => !v)}
        >
          今天到期
        </Button>

        <Button
          variant={filterCareless ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterCareless((v) => !v)}
        >
          粗心錯
        </Button>
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground">共 {filtered.length} 筆</p>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/60 px-5 py-10 text-center text-sm text-muted-foreground">
          <BookX className="mx-auto mb-3 h-8 w-8 opacity-40" />
          沒有符合條件的錯題。
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isOverdue = item.next_review_date && new Date(item.next_review_date) <= now && item.status !== "MASTERED" && item.status !== "ARCHIVED"
            return (
              <div key={item.id} className="rounded-xl border border-border/70 bg-background/70 p-4 space-y-3">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setDetailItem(item)}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{item.subject.name}</span>
                        <span className="text-sm text-muted-foreground">·</span>
                        <span className="text-sm text-muted-foreground">{item.topic}</span>
                        {item.is_careless && <Badge variant="outline" className="text-xs">粗心</Badge>}
                        {item.source_type === "guessed_correct" && <Badge variant="outline" className="text-xs">猜對不熟</Badge>}
                        {item.is_manual_added && <Badge variant="outline" className="text-xs">手動加入</Badge>}
                      </div>
                      {item.question && (
                        <p className="break-words text-sm text-foreground line-clamp-2">{item.question.question}</p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>首錯：{format(new Date(item.first_wrong_date), "yyyy/MM/dd")}</span>
                        <span>錯 {item.wrong_count} 次</span>
                        <span>複習 {item.review_count} 次</span>
                        {item.next_review_date && (
                          <span className={isOverdue ? "font-medium text-destructive" : ""}>
                            下次複習：{format(new Date(item.next_review_date), "yyyy/MM/dd")}{isOverdue ? "（到期）" : ""}
                          </span>
                        )}
                      </div>
                      {item.error_reason && (
                        <p className="text-xs text-muted-foreground">錯誤原因：{item.error_reason}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={STATUS_BADGE_VARIANT[item.status] ?? "outline"}>
                        {STATUS_LABELS[item.status] ?? item.status}
                      </Badge>
                    </div>
                  </div>
                </button>

                <div className="flex flex-wrap gap-2">
                  {item.status === "ACTIVE" && (
                    <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleStatusChange(item.id, "CORRECTED")}>
                      設為已訂正
                    </Button>
                  )}
                  {item.status === "CORRECTED" && (
                    <div className="self-center text-xs text-muted-foreground">
                      已訂正，但要走完 1 → 3 → 7 → 14 複習鏈才會變成已掌握。
                    </div>
                  )}
                  {item.status === "ACTIVE" && !item.is_careless && item.question_id && (
                    <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleMarkCareless(item)}>
                      標記粗心
                    </Button>
                  )}
                  {item.status !== "ARCHIVED" && (
                    <Button size="sm" variant="ghost" disabled={isPending} className="text-muted-foreground" onClick={() => handleRemove(item.id)}>
                      <Trash2 className="mr-1 h-3 w-3" />
                      移除
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <WrongQuestionDetailDialog
        item={detailItem}
        open={detailItem !== null}
        onOpenChange={(open) => { if (!open) setDetailItem(null) }}
      />
    </div>
  )
}
