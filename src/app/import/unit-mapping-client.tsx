"use client"

import { useState } from "react"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"
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
}

export function UnitMappingClient({ subjects }: Props) {
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id || "")
  const [mode, setMode] = useState<'groups' | 'questions'>('groups')
  const [previewData, setPreviewData] = useState<MapPreviewResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [selectedMappings, setSelectedMappings] = useState<Set<string>>(new Set())
  const [isConfirming, setIsConfirming] = useState(false)

  const handlePreview = async () => {
    if (!selectedSubjectId) {
      toast.error("請選擇科目")
      return
    }

    setIsLoading(true)
    try {
      const result = await previewUnitMapping(selectedSubjectId, mode)
      if (result.success && result.data) {
        setPreviewData(result.data)
        toast.success(`已載入 ${result.data.length} 個${mode === 'groups' ? '題組' : '題目'}`)
      } else {
        toast.error(result.error || "預覽失敗")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (selectedMappings.size === 0) {
      toast.error("至少選一個")
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
        toast.success(`已更新 ${result.updatedCount} 個的單元對應`)
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
            使用 AI 自動分析題組或單題，建議最合適的學習單元。可在確認前手動調整。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 科目 + 模式選擇 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">選擇科目</label>
              <Select value={selectedSubjectId} onValueChange={(value) => {
                if (value) setSelectedSubjectId(value)
              }}>
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

            <div>
              <label className="text-sm font-medium">驗證模式</label>
              <Select value={mode} onValueChange={(value) => {
                if (value === "groups" || value === "questions") {
                  setMode(value)
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="groups">題組</SelectItem>
                  <SelectItem value="questions">單題</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

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
              <>🤖 AI 分析建議</>
            )}
          </Button>

          {/* 預覽表格 */}
          {previewData.length > 0 && (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="selectAll"
                    checked={selectedMappings.size === previewData.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMappings(new Set(previewData.map((p) => p.groupId)))
                      } else {
                        setSelectedMappings(new Set())
                      }
                    }}
                    className="cursor-pointer"
                  />
                  <label htmlFor="selectAll" className="text-sm font-medium cursor-pointer">
                    全選 ({selectedMappings.size}/{previewData.length})
                  </label>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>目前 Topic</TableHead>
                      <TableHead>AI 建議</TableHead>
                      <TableHead className="w-20">信心度</TableHead>
                      <TableHead className="w-24">動作</TableHead>
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
                            className="cursor-pointer"
                          />
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{preview.topic}</TableCell>
                        <TableCell>
                          {preview.suggestedUnit ? (
                            <div>
                              <div className="font-medium">{preview.suggestedUnit.unitName}</div>
                              <div className="text-xs text-muted-foreground">{preview.suggestedUnit.reason}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">無建議</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {preview.suggestedUnit ? (
                            <span className="text-sm">{(preview.suggestedUnit.confidence * 100).toFixed(0)}%</span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {overrides[preview.groupId] ? (
                            <AlertCircle className="h-4 w-4 text-orange-500" />
                          ) : preview.suggestedUnit ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button
                onClick={handleConfirm}
                disabled={isConfirming || selectedMappings.size === 0}
                className="w-full"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    確認中...
                  </>
                ) : (
                  <>✅ 確認對應 ({selectedMappings.size})</>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
