"use client"

import { useEffect, useState, useTransition } from "react"
import { Pencil, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  deleteQuestion,
  deleteQuestions,
  getQuestionsForManagement,
  getPracticeQuestionTopics,
  updateQuestion,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

  // Search
  const [searchText, setSearchText] = useState("")

  // Batch select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false)

  // Edit
  const [editingQuestion, setEditingQuestion] = useState<QuestionManagementItem | null>(null)
  const [editTopic, setEditTopic] = useState("")
  const [editQuestion, setEditQuestion] = useState("")
  const [editOptions, setEditOptions] = useState<string[]>([])
  const [editAnswer, setEditAnswer] = useState(0)
  const [editExplanation, setEditExplanation] = useState("")

  useEffect(() => {
    if (!selectedSubjectId) return
    setSelectedTopic("")
    setTopics([])
    setQuestions([])
    setSelectedIds(new Set())
    setIsLoadingTopics(true)
    getPracticeQuestionTopics(selectedSubjectId)
      .then(setTopics)
      .catch(() => toast.error("載入單元失敗。"))
      .finally(() => setIsLoadingTopics(false))
  }, [selectedSubjectId])

  useEffect(() => {
    if (!selectedSubjectId) return
    setIsLoadingQuestions(true)
    setSelectedIds(new Set())
    getQuestionsForManagement(selectedSubjectId, selectedTopic || undefined)
      .then(setQuestions)
      .catch(() => toast.error("載入題目失敗。"))
      .finally(() => setIsLoadingQuestions(false))
  }, [selectedSubjectId, selectedTopic])

  const filteredQuestions = searchText.trim()
    ? questions.filter((q) => q.question.toLowerCase().includes(searchText.toLowerCase()))
    : questions

  const confirmDelete = (id: string) => setConfirmDeleteId(id)

  const handleDelete = () => {
    if (!confirmDeleteId) return
    const id = confirmDeleteId
    setConfirmDeleteId(null)

    startTransition(async () => {
      try {
        await deleteQuestion(id)
        setQuestions((prev) => prev.filter((q) => q.id !== id))
        setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next })
        toast.success("題目已刪除。")
      } catch {
        toast.error("刪除失敗，請再試一次。")
      }
    })
  }

  const handleBatchDelete = () => {
    const ids = Array.from(selectedIds)
    setConfirmBatchDelete(false)
    startTransition(async () => {
      try {
        await deleteQuestions(ids)
        setQuestions((prev) => prev.filter((q) => !selectedIds.has(q.id)))
        setSelectedIds(new Set())
        toast.success(`已刪除 ${ids.length} 道題目。`)
      } catch {
        toast.error("批次刪除失敗，請再試一次。")
      }
    })
  }

  const openEdit = (q: QuestionManagementItem) => {
    setEditingQuestion(q)
    setEditTopic(q.topic)
    setEditQuestion(q.question)
    setEditOptions([...q.options])
    setEditAnswer(q.answer)
    setEditExplanation(q.explanation ?? "")
  }

  const handleSaveEdit = () => {
    if (!editingQuestion) return
    const id = editingQuestion.id
    setEditingQuestion(null)

    startTransition(async () => {
      try {
        await updateQuestion(id, {
          topic: editTopic,
          question: editQuestion,
          options: editOptions,
          answer: editAnswer,
          explanation: editExplanation || null,
        })
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === id
              ? { ...q, topic: editTopic, question: editQuestion, options: editOptions, answer: editAnswer, explanation: editExplanation || null }
              : q
          )
        )
        toast.success("題目已更新。")
      } catch {
        toast.error("更新失敗，請再試一次。")
      }
    })
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQuestions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredQuestions.map((q) => q.id)))
    }
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
          <CardDescription>瀏覽、編輯並刪除自己匯入的題目。僅顯示你自己的題庫，不包含讀書房共享的他人題目。</CardDescription>
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

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="搜尋題目內容…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="border rounded-md divide-y">
            {isLoadingQuestions ? (
              <div className="p-6 text-center text-sm text-muted-foreground">載入中…</div>
            ) : filteredQuestions.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">沒有符合條件的題目。</div>
            ) : (
              <>
                <div className="px-4 py-2 flex items-center gap-3 bg-muted/30">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    checked={selectedIds.size === filteredQuestions.length && filteredQuestions.length > 0}
                    onChange={toggleSelectAll}
                    aria-label="全選"
                  />
                  <span className="text-xs text-muted-foreground">全選（{filteredQuestions.length} 題）</span>
                </div>
                {filteredQuestions.map((q) => (
                  <div key={q.id} className="p-4 flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-border accent-primary cursor-pointer"
                      checked={selectedIds.has(q.id)}
                      onChange={() => toggleSelect(q.id)}
                      aria-label="選取"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="text-xs">{q.topic}</Badge>
                        {q.visibility === "study_group" && (
                          <Badge variant="outline" className="text-xs">共享</Badge>
                        )}
                      </div>
                      <p className="text-sm break-words line-clamp-3">{q.question}</p>
                      {q.question_type === "fill_in_blank" ? (
                        <p className="text-xs text-muted-foreground">填空答案：{q.text_answer}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          正確答案：{String.fromCharCode(65 + q.answer)}. {q.options[q.answer]}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(q)}
                        disabled={isPending}
                        aria-label="編輯題目"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => confirmDelete(q.id)}
                        disabled={isPending}
                        aria-label="刪除題目"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {filteredQuestions.length > 0 && (
            <p className="text-xs text-muted-foreground">共 {filteredQuestions.length} 題{searchText ? "（已過濾）" : ""}</p>
          )}
        </CardContent>
      </Card>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border bg-background px-5 py-3 shadow-lg">
          <span className="text-sm font-medium">已選取 {selectedIds.size} 題</span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmBatchDelete(true)}
            disabled={isPending}
          >
            批次刪除
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
            取消
          </Button>
        </div>
      )}

      {/* Single delete dialog */}
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

      {/* Batch delete dialog */}
      <Dialog open={confirmBatchDelete} onOpenChange={setConfirmBatchDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認批次刪除</DialogTitle>
            <DialogDescription>
              即將刪除 {selectedIds.size} 道題目，刪除後無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBatchDelete(false)}>取消</Button>
            <Button variant="destructive" onClick={handleBatchDelete} disabled={isPending}>
              {isPending ? "刪除中…" : `確認刪除 ${selectedIds.size} 題`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editingQuestion !== null} onOpenChange={(open) => { if (!open) setEditingQuestion(null) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>編輯題目</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>單元</Label>
              <Input value={editTopic} onChange={(e) => setEditTopic(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>題目</Label>
              <textarea value={editQuestion} onChange={(e) => setEditQuestion(e.target.value)} rows={3} className="min-h-[72px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" />
            </div>
            {editingQuestion?.question_type !== "fill_in_blank" && (
              <>
                <div className="space-y-2">
                  <Label>選項</Label>
                  {editOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm font-medium w-5 shrink-0">{String.fromCharCode(65 + i)}.</span>
                      <Input value={opt} onChange={(e) => {
                        const next = [...editOptions]
                        next[i] = e.target.value
                        setEditOptions(next)
                      }} />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label>正確答案</Label>
                  <Select value={String(editAnswer)} onValueChange={(v) => setEditAnswer(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {editOptions.map((opt, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {String.fromCharCode(65 + i)}. {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>解析（選填）</Label>
              <textarea value={editExplanation} onChange={(e) => setEditExplanation(e.target.value)} rows={2} className="min-h-[48px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingQuestion(null)}>取消</Button>
            <Button onClick={handleSaveEdit} disabled={isPending}>
              {isPending ? "儲存中…" : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
