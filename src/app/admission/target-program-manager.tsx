"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Plus, Pencil, X, Check } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  upsertTargetProgram,
  deleteTargetProgram,
} from "@/app/actions/admission-evaluation"
import type { TargetProgramItem } from "@/types"

type Props = {
  programs: TargetProgramItem[]
  selectedProgramId: string | null
  onSelect: (id: string) => void
}

type FormState = {
  schoolName: string
  departmentName: string
  examYear: string
  lastYearLine: string
  safeLine: string
  idealLine: string
  notes: string
}

const defaultForm: FormState = {
  schoolName: "",
  departmentName: "",
  examYear: new Date().getFullYear().toString(),
  lastYearLine: "",
  safeLine: "",
  idealLine: "",
  notes: "",
}

export function TargetProgramManager({ programs, selectedProgramId, onSelect }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm)

  function startAdd() {
    setEditingId(null)
    setForm(defaultForm)
    setShowForm(true)
  }

  function startEdit(program: TargetProgramItem) {
    setEditingId(program.id)
    setForm({
      schoolName: program.schoolName,
      departmentName: program.departmentName,
      examYear: String(program.examYear),
      lastYearLine: String(program.lastYearLine),
      safeLine: String(program.safeLine),
      idealLine: String(program.idealLine),
      notes: program.notes ?? "",
    })
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(defaultForm)
  }

  function handleSave() {
    const year = parseInt(form.examYear)
    const last = parseFloat(form.lastYearLine)
    const safe = parseFloat(form.safeLine)
    const ideal = parseFloat(form.idealLine)

    if (!form.schoolName.trim() || !form.departmentName.trim()) {
      toast.error("請填寫學校和科系名稱。")
      return
    }
    if (isNaN(last) || isNaN(safe) || isNaN(ideal)) {
      toast.error("請輸入有效的分數線。")
      return
    }

    startTransition(async () => {
      const result = await upsertTargetProgram({
        id: editingId ?? undefined,
        schoolName: form.schoolName,
        departmentName: form.departmentName,
        examYear: isNaN(year) ? new Date().getFullYear() : year,
        lastYearLine: last,
        safeLine: safe,
        idealLine: ideal,
        notes: form.notes || undefined,
      })

      if (result.success) {
        toast.success(result.message)
        cancelForm()
        router.refresh()
      } else {
        toast.error(result.message)
      }
    })
  }

  function handleDelete(id: string, label: string) {
    if (!confirm(`確定要刪除「${label}」嗎？`)) return
    startTransition(async () => {
      const result = await deleteTargetProgram(id)
      if (result.success) {
        toast.success(result.message)
        router.refresh()
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">目標校系</CardTitle>
          {!showForm && (
            <Button variant="outline" size="sm" onClick={startAdd} disabled={isPending}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              新增
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Program list */}
        {programs.length > 0 && !showForm && (
          <div className="space-y-2">
            {programs.map((p) => (
              <div
                key={p.id}
                className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                  selectedProgramId === p.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent/40"
                }`}
                onClick={() => onSelect(p.id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {p.schoolName} {p.departmentName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.examYear} 年｜上榜線 {p.lastYearLine}／安全線 {p.safeLine}／理想線 {p.idealLine}
                  </p>
                </div>
                <div className="ml-2 flex shrink-0 gap-1">
                  {selectedProgramId === p.id && (
                    <Badge variant="secondary" className="text-xs">
                      已選
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation()
                      startEdit(p)
                    }}
                    disabled={isPending}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(p.id, `${p.schoolName} ${p.departmentName}`)
                    }}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {programs.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground">尚未新增目標校系，點擊「新增」開始設定。</p>
        )}

        {/* Add / Edit form */}
        {showForm && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">{editingId ? "編輯目標校系" : "新增目標校系"}</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">學校名稱</Label>
                <Input
                  placeholder="例：國立成功大學"
                  value={form.schoolName}
                  onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">科系名稱</Label>
                <Input
                  placeholder="例：經濟學系"
                  value={form.departmentName}
                  onChange={(e) => setForm({ ...form, departmentName: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs">考試年份</Label>
                <Input
                  type="number"
                  placeholder="2026"
                  value={form.examYear}
                  onChange={(e) => setForm({ ...form, examYear: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">去年上榜線</Label>
                <Input
                  type="number"
                  placeholder="202"
                  value={form.lastYearLine}
                  onChange={(e) => setForm({ ...form, lastYearLine: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">安全線</Label>
                <Input
                  type="number"
                  placeholder="208"
                  value={form.safeLine}
                  onChange={(e) => setForm({ ...form, safeLine: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">理想線</Label>
                <Input
                  type="number"
                  placeholder="212"
                  value={form.idealLine}
                  onChange={(e) => setForm({ ...form, idealLine: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">備注（選填）</Label>
              <Input
                placeholder="例：示意資料"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="h-8 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={cancelForm} disabled={isPending}>
                <X className="mr-1 h-3.5 w-3.5" />
                取消
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isPending}>
                <Check className="mr-1 h-3.5 w-3.5" />
                {isPending ? "儲存中…" : "儲存"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
