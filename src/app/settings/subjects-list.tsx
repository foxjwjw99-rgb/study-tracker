"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { toast } from "sonner"

import { deleteSubject, deleteSubjectCascade, getSubjectDeletionImpact } from "@/app/actions/subject"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { Subject, SubjectDeletionImpact } from "@/types"

type SubjectsListProps = {
  subjects: Subject[]
}

export function SubjectsList({ subjects }: SubjectsListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [impact, setImpact] = useState<SubjectDeletionImpact | null>(null)

  const handleDelete = (subjectId: string) => {
    startTransition(async () => {
      try {
        const subjectImpact = await getSubjectDeletionImpact(subjectId)

        if (subjectImpact.totalCount === 0) {
          const result = await deleteSubject(subjectId)

          if (!result.success) {
            toast.error(result.message)
            return
          }

          toast.success(result.message)
          router.refresh()
          return
        }

        setImpact(subjectImpact)
        setDialogOpen(true)
      } catch {
        toast.error("讀取科目刪除資訊失敗。")
      }
    })
  }

  const handleCascadeDelete = () => {
    if (!impact) {
      return
    }

    startTransition(async () => {
      try {
        const result = await deleteSubjectCascade(impact.subjectId)

        if (!result.success) {
          toast.error(result.message)
          return
        }

        toast.success(result.message)
        setDialogOpen(false)
        setImpact(null)
        router.refresh()
      } catch {
        toast.error("刪除科目失敗。")
      }
    })
  }

  if (subjects.length === 0) {
    return <div className="py-4 text-center text-sm text-muted-foreground">尚未新增任何科目。</div>
  }

  return (
    <>
      <div className="grid grid-cols-1 divide-y">
        {subjects.map((subject) => (
          <div
            key={subject.id}
            className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="break-words font-medium">{subject.name}</div>
              {subject.target_score !== null ? (
                <div className="text-sm text-muted-foreground">
                  目標分數：{subject.target_score}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="w-full text-left text-sm text-destructive hover:underline sm:w-auto sm:text-right"
              disabled={isPending}
              onClick={() => handleDelete(subject.id)}
            >
              {isPending ? "處理中..." : "刪除"}
            </button>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              刪除科目與相關資料
            </DialogTitle>
            <DialogDescription>
              {impact
                ? `「${impact.subjectName}」底下已經有資料。若要刪除科目，就必須把這些資料一起刪掉。`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {impact ? (
            <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm">
              <ImpactRow label="學習紀錄" value={impact.studyLogsCount} />
              <ImpactRow label="練習紀錄" value={impact.practiceLogsCount} />
              <ImpactRow label="錯題" value={impact.wrongQuestionsCount} />
              <ImpactRow label="複習任務" value={impact.reviewTasksCount} />
              <ImpactRow label="題庫題目" value={impact.questionsCount} />
              <ImpactRow label="單字" value={impact.vocabularyWordsCount} />
              <div className="border-t border-border/70 pt-3 font-medium text-foreground">
                總共會刪除 {impact.totalCount} 筆相關資料
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button type="button" variant="destructive" disabled={isPending} onClick={handleCascadeDelete}>
              {isPending ? "刪除中..." : "確認整包刪除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ImpactRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-muted-foreground">
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}
