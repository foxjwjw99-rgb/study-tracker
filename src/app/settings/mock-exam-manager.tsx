"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Plus, Clock } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { createMockExamRecord, deleteMockExamRecord } from "@/app/actions/exam-forecast"
import type { MockExamRecordItem, Subject } from "@/types"

type Props = {
  subjects: Pick<Subject, "id" | "name">[]
  initialRecords: MockExamRecordItem[]
}

export function MockExamManager({ subjects, initialRecords }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id ?? "")
  const [examDate, setExamDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [score, setScore] = useState("")
  const [fullScore, setFullScore] = useState("100")
  const [isTimed, setIsTimed] = useState(false)
  const [notes, setNotes] = useState("")

  const filtered = initialRecords.filter((r) => r.subjectId === selectedSubjectId)

  function handleAdd() {
    if (!selectedSubjectId || !examDate || !score) return
    const s = parseFloat(score)
    const fs = parseFloat(fullScore)
    if (isNaN(s) || isNaN(fs)) {
      toast.error("請輸入有效的分數。")
      return
    }
    startTransition(async () => {
      const result = await createMockExamRecord({
        subjectId: selectedSubjectId,
        examDate,
        score: s,
        fullScore: fs,
        isTimed,
        notes: notes || undefined,
      })
      if (result.success) {
        toast.success(result.message)
        setScore("")
        setNotes("")
        router.refresh()
      } else {
        toast.error(result.message)
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteMockExamRecord(id)
      if (result.success) {
        toast.success(result.message)
        router.refresh()
      } else {
        toast.error(result.message)
      }
    })
  }

  if (subjects.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">請先新增科目，再記錄模考成績。</p>
    )
  }

  return (
    <div className="space-y-5">
      {/* Subject selector */}
      <div className="space-y-2">
        <Label>選擇科目</Label>
        <Select
          value={selectedSubjectId}
          onValueChange={(v) => { if (v) setSelectedSubjectId(v) }}
        >
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="選擇科目" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Records list */}
      <div className="space-y-2">
        <span className="text-sm font-medium">模考紀錄</span>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">尚無紀錄。</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {filtered.map((r) => {
              const pct = Math.round((r.score / r.fullScore) * 100)
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm"
                >
                  <span className="w-24 shrink-0 text-muted-foreground">
                    {format(new Date(r.examDate), "yyyy/MM/dd")}
                  </span>
                  <span className="font-medium tabular-nums">
                    {r.score} / {r.fullScore}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    ({pct}%)
                  </span>
                  {r.isTimed && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Clock className="h-3 w-3" />
                      限時
                    </Badge>
                  )}
                  {r.notes && (
                    <span className="flex-1 truncate text-xs text-muted-foreground">
                      {r.notes}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(r.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Add form */}
      <div className="space-y-3">
        <span className="text-sm font-medium">新增模考紀錄</span>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="exam-date">考試日期</Label>
            <Input
              id="exam-date"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-36"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mock-score">分數</Label>
            <Input
              id="mock-score"
              type="number"
              min="0"
              placeholder="例如：72"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="w-24"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="full-score">滿分</Label>
            <Input
              id="full-score"
              type="number"
              min="1"
              value={fullScore}
              onChange={(e) => setFullScore(e.target.value)}
              className="w-20"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mock-notes">備注 (選填)</Label>
            <Input
              id="mock-notes"
              placeholder="例如：第三回全卷"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
            <input
              type="checkbox"
              checked={isTimed}
              onChange={(e) => setIsTimed(e.target.checked)}
              className="rounded"
            />
            限時作答
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={isPending || !score || !examDate}
          >
            <Plus className="mr-1 h-4 w-4" />
            新增
          </Button>
        </div>
      </div>
    </div>
  )
}
