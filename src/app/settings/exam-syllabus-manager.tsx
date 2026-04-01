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
} from "@/app/actions/exam-forecast"
import { updateSubjectExamWeight } from "@/app/actions/subject"
import type { Subject } from "@/types"

type SyllabusUnit = {
  id: string
  unit_name: string
  weight: number  // stored 0.0–1.0
}

type SubjectWithUnits = Subject & {
  exam_syllabus_units: SyllabusUnit[]
}

type Props = {
  subjects: SubjectWithUnits[]
}

export function ExamSyllabusManager({ subjects }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id ?? "")
  const [unitName, setUnitName] = useState("")
  const [unitWeight, setUnitWeight] = useState("")
  const [subjectWeightInput, setSubjectWeightInput] = useState<string>("")

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
          {/* Subject exam weight */}
          <div className="flex items-end gap-3">
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
            <Button variant="outline" size="sm" onClick={handleSaveSubjectWeight} disabled={isPending}>
              儲存
            </Button>
          </div>

          {/* Units list */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">考試單元</span>
              {isOverweight && (
                <Badge variant="destructive" className="text-xs">
                  比重合計 {Math.round(totalWeight)}%（超過 100%，系統計算時會自動正規化）
                </Badge>
              )}
              {!isOverweight && units.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  合計 {Math.round(totalWeight)}%
                </span>
              )}
            </div>

            {units.length === 0 ? (
              <p className="text-sm text-muted-foreground">尚未設定任何單元。</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {units.map((unit) => (
                  <li key={unit.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{unit.unit_name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{Math.round(unit.weight * 100)}%</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteUnit(unit.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
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
            單元名稱需與「練習紀錄」的主題名稱相同，系統才能自動對應你的答對率。
          </p>
        </>
      )}
    </div>
  )
}
