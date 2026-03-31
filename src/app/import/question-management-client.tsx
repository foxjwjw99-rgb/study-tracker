"use client"

import { useEffect, useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  deleteQuestion,
  getQuestionsForManagement,
  getPracticeQuestionTopics,
  type QuestionManagementItem,
} from "@/app/actions/practice-log"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import type { PracticeQuestionBankSummary } from "@/types"

type QuestionManagementClientProps = {
  questionBank: PracticeQuestionBankSummary[]
}

export function QuestionManagementClient({ questionBank }: QuestionManagementClientProps) {
  const ownedBank = questionBank.filter((item) => !item.subject_id.startsWith("shared:"))

  const [selectedSubjectId, setSelectedSubjectId] = useState(ownedBank[0]?.subject_id ?? "")
  const [selectedTopic, setSelectedTopic] = useState("")
  const [topics, setTopics] = useState<{ topic: string; count: number }[]>([])
  const [questions, setQuestions] = useState<QuestionManagementItem[]>([])
  const [isLoadingTopics, setIsLoadingTopics] = useState(false)
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!selectedSubjectId) return
    setSelectedTopic("")
    setTopics([])
    setQuestions([])
    setIsLoadingTopics(true)
    getPracticeQuestionTopics(selectedSubjectId)
      .then(setTopics)
      .catch(() => toast.error("載入單元失敗。"))
      .finally(() => setIsLoadingTopics(false))
  }, [selectedSubjectId])

  useEffect(() => {
    if (!selectedSubjectId) return
    setIsLoadingQuestions(true)
    getQuestionsForManagement(selectedSubjectId, selectedTopic || undefined)
      .then(setQuestions)
      .catch(() => toast.error("載入題目失敗。"))
      .finally(() => setIsLoadingQuestions(false))
  }, [selectedSubjectId, selectedTopic])

  const confirmDelete = (id: string) => setConfirmDeleteId(id)

  const handleDelete = () => {
    if (!confirmDeleteId) return
    const id = confirmDeleteId
    setConfirmDeleteId(null)

    startTransition(async () => {
      try {
        await deleteQuestion(id)
        setQuestions((prev) => prev.filter((q) => q.id !== id))
        toast.success("題目已刪除。")
      } catch {
        toast.error("刪除失敗，請再試一次。")
      }
    })
  }

  if (ownedBank.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>管理題目</CardTitle>
          <CardDescription>目前沒有自己的題庫可管理。</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">先匯入題目後，才可以在這裡瀏覽或刪除。</p>
        </CardContent>
      </Card>
    )
  }

  const selectedSubject = ownedBank.find((item) => item.subject_id === selectedSubjectId)
  const questionToDelete = questions.find((q) => q.id === confirmDeleteId)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>管理題目</CardTitle>
          <CardDescription>瀏覽並刪除自己匯入的題目。僅顯示你自己的題庫，不包含讀書房共享的他人題目。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">科目</label>
              <Select
                value={selectedSubjectId}
                onValueChange={(value) => setSelectedSubjectId(value ?? ownedBank[0]?.subject_id ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {selectedSubject
                      ? `${selectedSubject.subject_name} (${selectedSubject.private_question_count} 題)`
                      : "選擇科目"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ownedBank.map((item) => (
                    <SelectItem key={item.subject_id} value={item.subject_id}>
                      {item.subject_name} ({item.private_question_count} 題)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">單元（選填）</label>
              <Select
                value={selectedTopic || "__all__"}
                onValueChange={(value) => setSelectedTopic(value === "__all__" ? "" : (value ?? ""))}
                disabled={isLoadingTopics || topics.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {selectedTopic
                      ? `${selectedTopic} (${topics.find((t) => t.topic === selectedTopic)?.count ?? 0} 題)`
                      : "全部單元"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部單元</SelectItem>
                  {topics.map((t) => (
                    <SelectItem key={t.topic} value={t.topic}>
                      {t.topic} ({t.count} 題)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-md divide-y">
            {isLoadingQuestions ? (
              <div className="p-6 text-center text-sm text-muted-foreground">載入中…</div>
            ) : questions.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">沒有符合條件的題目。</div>
            ) : (
              questions.map((q) => (
                <div key={q.id} className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-xs">{q.topic}</Badge>
                      {q.visibility === "study_group" && (
                        <Badge variant="outline" className="text-xs">共享</Badge>
                      )}
                    </div>
                    <p className="text-sm break-words line-clamp-3">{q.question}</p>
                    <p className="text-xs text-muted-foreground">
                      正確答案：{String.fromCharCode(65 + q.answer)}. {q.options[q.answer]}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => confirmDelete(q.id)}
                    disabled={isPending}
                    aria-label="刪除題目"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {questions.length > 0 && (
            <p className="text-xs text-muted-foreground">共 {questions.length} 題</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmDeleteId !== null} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除題目</DialogTitle>
            <DialogDescription>
              刪除後無法復原。這道題目的所有相關練習記錄不受影響，但之後無法再作答。
            </DialogDescription>
          </DialogHeader>
          {questionToDelete && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm break-words">
              {questionToDelete.question}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "刪除中…" : "確認刪除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
