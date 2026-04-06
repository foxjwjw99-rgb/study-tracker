"use client"

import { useState, useMemo } from "react"
import { Loader2, CheckCircle2, AlertCircle, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import {
  previewUnitMapping,
  confirmUnitMapping,
  type MapPreviewResult,
  type MappingConfirmation,
} from "@/app/actions/ai-generation"

type Props = {
  subjects: Array<{ id: string; name: string }>
  subjectUnits: Array<{ id: string; subjectId: string; name: string }>
}

export function UnitMappingClient({ subjects, subjectUnits }: Props) {
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id || "")
  const [previewData, setPreviewData] = useState<MapPreviewResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [selectedMappings, setSelectedMappings] = useState<Set<string>>(new Set())
  const [isConfirming, setIsConfirming] = useState(false)

  const availableUnits = useMemo(
    () => subjectUnits.filter((u) => u.subjectId === selectedSubjectId),
    [selectedSubjectId, subjectUnits]
  )

  const handlePreview = async () => {
    if (!selectedSubjectId) {
      toast.error("請選擇科目")
      return
    }

    setIsLoading(true)
    try {
      const result = await previewUnitMapping(selectedSubjectId)
      if (result.success && result.data) {
        setPreviewData(result.data)
        setOverrides({})
        setSelectedMappings(new Set(result.data.map((r) => r.groupId)))
        toast.success(`預覽 ${result.data.length} 個題組`)
      } else {
        toast.error(result.error || "預覽失敗")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (selectedMappings.size === 0) {
      toast.error("至少選一個題組")
      return
    }

    const toConfirm: MappingConfirmation[] = []

    for (const preview of previewData) {
      if (!selectedMappings.has(preview.groupId)) continue

      const overriddenUnitId = overrides[preview.groupId]
      const suggestion = preview.suggestedUnit

      if (overriddenUnitId) {
        toConfirm.push({
          groupId: preview.groupId,
          unitId: overriddenUnitId,
          confidence: 0,
          reason: "手動覆蓋",
        })
      } else if (suggestion) {
        toConfirm.push({
          groupId: preview.groupId,
          unitId: suggestion.unitId,
          confidence: suggestion.confidence,
          reason: suggestion.reason,
        })
      }
    }

    if (toConfirm.length === 0) {
      toast.error("沒有有效的對應可確認")
      return
    }

    setIsConfirming(true)
    try {
      const result = await confirmUnitMapping(selectedSubjectId, toConfirm)
      if (result.success) {
        toast.success(`已更新 ${result.updatedCount} 個題組的單元對應`)
        setPreviewData([])
        setOverrides({})
        setSelectedMappings(new Set())
      } else {
        toast.error(result.error || "確認失敗")
      }
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>批量驗證單元對應</CardTitle>
          <CardDescription>
            使用 AI 自動分析題組，建議最合適的學習單元。可在確認前手動調整。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 科目選擇 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">選擇科目</label>
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={handlePreview}
                disabled={isLoading || !selectedSubjectId}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    分析中...
                  </>
                ) : (
                  "🤖 AI 分析建議"
                )}
              </Button>
            </div>
          </div>

          {/* 預覽表格 */}
          {previewData.length > 0 && (
            <div className="space-y-4">
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedMappings.size === previewData.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMappings(new Set(previewData.map((r) => r.groupId)))
                            } else {
                              setSelectedMappings(new Set())
                            }
                          }}
                          className="rounded"
                        />
                      </TableHead>
                      <TableHead>Topic</TableHead>
                      <TableHead>目前單元</TableHead>
                      <TableHead>AI 建議</TableHead>
                      <TableHead>信心度</TableHead>
                      <TableHead>手動選擇</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((preview) => (
                      <TableRow key={preview.groupId}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedMappings.has(preview.groupId)}
                            onChange={(e) => {
                              const newSet = new Set(selectedMappings)
                              if (e.target.checked) {
                                newSet.add(preview.groupId)
                              } else {
                                newSet.delete(preview.groupId)
                              }
                              setSelectedMappings(newSet)
                            }}
                            className="rounded"
                          />
                        </TableCell>
                        <TableCell className="text-sm font-medium">{preview.topic}</TableCell>
                        <TableCell className="text-sm">{preview.currentUnitName || "未設定"}</TableCell>
                        <TableCell>
                          {preview.suggestedUnit ? (
                            <div className="text-sm">
                              <p className="font-medium">{preview.suggestedUnit.unitName}</p>
                              <p className="text-xs text-muted-foreground">{preview.suggestedUnit.reason}</p>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">—</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {preview.suggestedUnit && (
                            <span
                              className={`text-sm font-medium ${
                                preview.suggestedUnit.confidence > 0.8
                                  ? "text-green-600"
                                  : preview.suggestedUnit.confidence > 0.6
                                    ? "text-yellow-600"
                                    : "text-orange-600"
                              }`}
                            >
                              {(preview.suggestedUnit.confidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={overrides[preview.groupId] || ""}
                            onValueChange={(value) => {
                              const newOverrides = { ...overrides }
                              if (value) {
                                newOverrides[preview.groupId] = value
                              } else {
                                delete newOverrides[preview.groupId]
                              }
                              setOverrides(newOverrides)
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="選擇" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">AI 建議</SelectItem>
                              {availableUnits.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleConfirm}
                  disabled={isConfirming || selectedMappings.size === 0}
                  className="flex-1"
                  variant="default"
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      確認中...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      ✅ 確認對應 ({selectedMappings.size})
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setPreviewData([])
                    setOverrides({})
                    setSelectedMappings(new Set())
                  }}
                  variant="outline"
                >
                  取消
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
