"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Plus } from "lucide-react"
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
import {
  upsertExamSyllabusUnit,
  deleteExamSyllabusUnit,
  updateUnitMastery,
} from "@/app/actions/exam-forecast"
import { updateSubjectExamWeight } from "@/app/actions/subject"
import type { Subject, UnitDangerLevel } from "@/types"

type SyllabusUnit = {
  id: string
  unit_name: string
  weight: number        // stored 0.0–1.0
  mastery_score: number | null
}

type SubjectWithUnits = Subject & {
  exam_syllabus_units: SyllabusUnit[]
}

type Props = {
  subjects: SubjectWithUnits[]
}

const MASTERY_OPTIONS = [
  { value: "null", label: "未評估" },
  { value: "0",   label: "0 — 完全不會" },
  { value: "1",   label: "1 — 大概知道" },
  { value: "2",   label: "2 — 了解概念" },
  { value: "3",   label: "3 — 會做多數題" },
  { value: "4",   label: "4 — 幾乎全對" },
  { value: "5",   label: "5 — 完全掌握" },
]

function getDangerLevel(masteryScore: number | null): UnitDangerLevel {
  if (masteryScore == null || masteryScore === 0) return "D"
  if (masteryScore <= 2) return "C"
  if (masteryScore === 3) return "B"
  return "A"
}

const DANGER_BADGE: Record<UnitDangerLevel, { label: string; className: string }> = {
  A: { label: "A 掌握",   className: "border-emerald-500 text-emerald-600 bg-emerald-50" },
  B: { label: "B 穩定",   className: "border-blue-400 text-blue-600 bg-blue-50" },
  C: { label: "C 待加強", className: "border-amber-400 text-amber-600 bg-amber-50" },
  D: { label: "D 危險",   className: "border-destructive text-destructive bg-destructive/5" },
}

export function ExamSyllabusManager({ subjects }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id ?? "")
  const [unitName, setUnitName] = useState("")
  const [unitWeight, setUnitWeight] = useState("")
  const [subjectWeightInput, setSubjectWeightInput] = useState<string>(() => {
    const s = subjects[0]
    return s?.exam_weight != null ? String(Math.round(s.exam_weight * 100)) : ""
  })

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId)
  const units = selectedSubject?.exam_syllabus_units ?? []
  const totalWeight = units.reduce((s, u) => s + u.weight * 100, 0)
  const isOverweight = totalWeight > 100.5

  function handleSelectSubject(id: string | null) {
    if (!id) return
    setSelectedSubjectId(id)
    const sub = subjects.find((s) => s.id === id)
    setSubjectWeightInput(
      sub?.exam_weight != null ? String(Math.round(sub.exam_weight * 100)) : "",
    )
    setUnitName("")
    setUnitWeight("")
  }

  function handleAddUnit() {
    if (!selectedSubjectId || !unitName.trim() || !unitWeight) return
    const w = parseFloat(unitWeight)
    if (isNaN(w) || w <= 0 || w > 100) {
      toast.error("比重必須介於 1–100 之間。")
      return
    }
    startTransition(async () => {
      const result = await upsertExamSyllabusUnit({
        subjectId: selectedSubjectId,
        unitName: unitName.trim(),
        weight: w,
      })
      if (result.success) {
        toast.success(result.message)
        setUnitName("")
        setUnitWeight("")
        router.refresh()
      } else {
        toast.error(result.message)
      }
    })
  }

  function handleDeleteUnit(id: string) {
    startTransition(async () => {
      const result = await deleteExamSyllabusUnit(id)
      if (result.success) {
        toast.success(result.message)
        router.refresh()
      } else {
        toast.error(result.message)
      }
    })
  }

  function handleMasteryChange(unitId: string, value: string) {
    const score = value === "null" ? null : parseInt(value, 10)
    startTransition(async () => {
      const result = await updateUnitMastery(unitId, score)
      if (result.success) {
        router.refresh()
      } else {
        toast.error(result.message)
      }
    })
  }

  function handleSaveSubjectWeight() {
    if (!selectedSubjectId) return
    const w = subjectWeightInput === "" ? null : parseFloat(subjectWeightInput)
    if (w !== null && (isNaN(w) || w <= 0 || w > 100)) {
      toast.error("科目比重必須介於 1–100 之間。")
      return
    }
    startTransition(async () => {
      const result = await updateSubjectExamWeight(selectedSubjectId, w != null ? w / 100 : null)
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
      <p className="text-sm text-muted-foreground">請先在上方新增科目，再設定考試範圍。</p>
    )
  }

  return (
    <div className="space-y-5">
      {/* Subject selector */}
      <div className="space-y-2">
        <Label>選擇科目</Label>
        <Select value={selectedSubjectId} onValueChange={handleSelectSubject}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="選擇科目" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
                {s.exam_weight != null && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({Math.round(s.exam_weight * 100)}%)
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedSubject && (
        <>
          {/* Subject exam weight + target score display */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="subject-weight">此科佔總分比重 %</Label>
              <Input
                id="subject-weight"
                type="number"
                min="1"
                max="100"
                placeholder="例如：40"
                value={subjectWeightInput}
                onChange={(e) => setSubjectWeightInput(e.target.value)}
                className="w-36"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveSubjectWeight}
              disabled={isPending}
            >
              儲存
            </Button>
            {selectedSubject.target_score != null && (
              <p className="text-xs text-muted-foreground self-end pb-1">
                目標分數：{selectedSubject.target_score} 分
                （可至「學習科目」區修改）
              </p>
            )}
          </div>

          {/* Units list */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">考試單元</span>
              {isOverweight ? (
                <Badge variant="destructive" className="text-xs">
                  合計 {Math.round(totalWeight)}% — 超過 100%，系統會自動正規化
                </Badge>
              ) : units.length > 0 ? (
                <span className="text-xs text-muted-foreground">合計 {Math.round(totalWeight)}%</span>
              ) : null}
            </div>

            {units.length === 0 ? (
              <p className="text-sm text-muted-foreground">尚未設定任何單元。</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {units.map((unit) => {
                  const dl = getDangerLevel(unit.mastery_score)
                  const badge = DANGER_BADGE[dl]
                  return (
                    <li
                      key={unit.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 text-sm"
                    >
                      <span className="flex-1 font-medium">{unit.unit_name}</span>
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {Math.round(unit.weight * 100)}%
                      </span>
                      {/* Mastery selector */}
                      <Select
                        value={unit.mastery_score?.toString() ?? "null"}
                        onValueChange={(v) => { if (v) handleMasteryChange(unit.id, v) }}
                        disabled={isPending}
                      >
                        <SelectTrigger className="h-7 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MASTERY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* Danger badge */}
                      <Badge
                        variant="outline"
                        className={`text-xs ${badge.className}`}
                      >
                        {badge.label}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteUnit(unit.id)}
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

          {/* Add unit form */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="unit-name">單元名稱</Label>
              <Input
                id="unit-name"
                placeholder="例如：三角函數"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                className="w-44"
                onKeyDown={(e) => e.key === "Enter" && handleAddUnit()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-weight">佔此科比重 %</Label>
              <Input
                id="unit-weight"
                type="number"
                min="1"
                max="100"
                placeholder="例如：20"
                value={unitWeight}
                onChange={(e) => setUnitWeight(e.target.value)}
                className="w-28"
                onKeyDown={(e) => e.key === "Enter" && handleAddUnit()}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddUnit}
              disabled={isPending || !unitName.trim() || !unitWeight}
            >
              <Plus className="mr-1 h-4 w-4" />
              新增單元
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            單元名稱需與「練習紀錄」的主題名稱相同，系統才能自動對應答對率。新增後可點選掌握度下拉調整自評分數。
          </p>
        </>
      )}
    </div>
  )
}
