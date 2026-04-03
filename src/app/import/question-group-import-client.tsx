"use client"

import { useState, useMemo } from "react"
import { z } from "zod"
import { toast } from "sonner"
import {
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
  FileSpreadsheet,
  RefreshCcw,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { importQuestionGroupsSchema, type ImportedQuestionGroup } from "./schema"
import { importQuestionGroups, type ImportGroupResult } from "@/app/actions/import"
import { parseCsvToQuestionGroups, parseXlsxToQuestionGroups } from "@/lib/parse-question-table"
import type { QuestionVisibility, StudyGroupSummary } from "@/types"

type Props = {
  studyGroups: StudyGroupSummary[]
}

function formatGroupIssues(error: z.ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path
      if (typeof path[0] === "number") {
        return `第 ${path[0] + 1} 個題組，${path.slice(1).join(".") || "資料"}：${issue.message}`
      }
      return `${path.join(".") || "資料"}：${issue.message}`
    })
    .join("\n")
}

function validateGroups(data: unknown): { data: ImportedQuestionGroup[] } | { error: string } {
  const parsed = importQuestionGroupsSchema.safeParse(data)
  if (!parsed.success) {
    return { error: `格式不符。\n${formatGroupIssues(parsed.error)}` }
  }
  return { data: parsed.data }
}

export function QuestionGroupImportClient({ studyGroups }: Props) {
  const [jsonText, setJsonText] = useState("")
  const [previewData, setPreviewData] = useState<ImportedQuestionGroup[] | null>(null)
  const [parsingError, setParsingError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<ImportGroupResult | null>(null)
  const [visibility, setVisibility] = useState<QuestionVisibility>("private")
  const [sharedStudyGroupId, setSharedStudyGroupId] = useState<string>(studyGroups[0]?.id ?? "")

  const canShareToGroup = studyGroups.length > 0
  const selectedGroup = useMemo(
    () => studyGroups.find((g) => g.id === sharedStudyGroupId) ?? null,
    [sharedStudyGroupId, studyGroups]
  )

  const previewSummary = useMemo(() => {
    if (!previewData) return null
    const totalQuestions = previewData.reduce((sum, g) => sum + g.questions.length, 0)
    return { groupCount: previewData.length, totalQuestions }
  }, [previewData])

  const resetState = () => {
    setParsingError(null)
    setPreviewData(null)
    setResult(null)
  }

  const applyParsed = (groups: ImportedQuestionGroup[]) => {
    resetState()
    const validated = validateGroups(groups)
    if ("error" in validated) {
      setParsingError(validated.error)
      return
    }
    setPreviewData(validated.data)
  }

  const handleJsonPreview = () => {
    resetState()
    const trimmed = jsonText.trim()
    if (!trimmed) {
      setParsingError("請先貼上 JSON。")
      return
    }
    try {
      const parsed = JSON.parse(trimmed)
      applyParsed(parsed)
    } catch {
      setParsingError("解析失敗。請確認內容是有效的 JSON 陣列。")
    }
  }

  const handleJsonFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      try {
        applyParsed(JSON.parse(text))
      } catch {
        setParsingError("解析失敗。請確認內容是有效的 JSON 陣列。")
      }
    }
    reader.readAsText(file)
  }

  const handleCsvFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()

    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      reader.onload = async (e) => {
        const buffer = e.target?.result as ArrayBuffer
        try {
          const groups = await parseXlsxToQuestionGroups(buffer)
          applyParsed(groups)
        } catch {
          setParsingError("讀取 Excel 檔案失敗，請確認格式正確。")
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      reader.onload = (e) => {
        const text = e.target?.result as string
        const groups = parseCsvToQuestionGroups(text)
        applyParsed(groups)
      }
      reader.readAsText(file)
    }
  }

  const handleReset = () => {
    setJsonText("")
    resetState()
  }

  const handleImport = async () => {
    if (!previewData) return
    if (visibility === "study_group" && !sharedStudyGroupId) {
      toast.error("請先選擇要分享的讀書房。")
      return
    }

    setIsImporting(true)
    try {
      const res = await importQuestionGroups(previewData, {
        visibility,
        shared_study_group_id: visibility === "study_group" ? sharedStudyGroupId : undefined,
      })
      setResult(res)
      if (res.success) {
        toast.success(res.message)
      } else {
        toast.error(res.message)
      }
    } catch {
      toast.error("匯入過程中發生伺服器錯誤。")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>題組表格 / JSON 匯入</CardTitle>
          <CardDescription>
            如果你要批次匯入題組，可以在這裡使用 JSON、CSV 或 Excel。JSON 建議優先走上方的統一匯入入口；這裡保留給題組批次整理使用。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Visibility selector */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>匯入方式</Label>
              <Select
                value={visibility}
                onValueChange={(v) => setVisibility((v as QuestionVisibility) ?? "private")}
              >
                <SelectTrigger>
                  <SelectValue>
                    {visibility === "study_group" ? "分享到讀書房" : "私人題庫（只有自己可練習）"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">私人題庫（只有自己可練習）</SelectItem>
                  <SelectItem value="study_group" disabled={!canShareToGroup}>
                    分享到讀書房
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>讀書房</Label>
              <Select
                value={sharedStudyGroupId}
                disabled={visibility !== "study_group" || !canShareToGroup}
                onValueChange={(v) => setSharedStudyGroupId(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder={canShareToGroup ? "選擇讀書房" : "目前尚未加入讀書房"}>
                    {(() => {
                      const g = studyGroups.find((g) => g.id === sharedStudyGroupId)
                      return g ? `${g.name} (${g.memberCount} 人)` : undefined
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {studyGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} ({g.memberCount} 人)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {visibility === "study_group" && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Users className="h-4 w-4" />
                {selectedGroup ? `將分享至「${selectedGroup.name}」` : "請先選擇讀書房"}
              </div>
              <p className="mt-1">同房成員都能練習這批題目，每個人的紀錄仍各自分開。</p>
            </div>
          )}

          {/* Input tabs */}
          <Tabs defaultValue="json" className="space-y-4">
            <TabsList>
              <TabsTrigger value="json">
                <ClipboardPaste className="mr-1.5 h-4 w-4" />
                JSON 格式
              </TabsTrigger>
              <TabsTrigger value="table">
                <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                表格上傳（CSV / Excel）
              </TabsTrigger>
            </TabsList>

            <TabsContent value="json" className="space-y-3">
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder={`[\n  {\n    "subject": "國文",\n    "topic": "閱讀測驗",\n    "group_title": "第一題組（選填）",\n    "group_context": "閱讀下文，回答問題...",\n    "questions": [\n      {\n        "question": "第一小題",\n        "options": ["選項A", "選項B", "選項C", "選項D"],\n        "answer": 0,\n        "explanation": "選填解析"\n      }\n    ]\n  }\n]`}
                className="min-h-[240px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                spellCheck={false}
              />
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">或上傳 .json 檔案：</p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleJsonFileUpload}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleReset}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  清空
                </Button>
                <Button type="button" onClick={handleJsonPreview}>
                  預覽並驗證
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="table" className="space-y-3">
              <div className="rounded-lg border border-dashed bg-muted/35 px-4 py-3 text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">表格欄位說明</p>
                <p>必填欄位：<code>subject</code>、<code>topic</code>、<code>group_context</code>、<code>question</code>、<code>answer</code></p>
                <p>選填欄位：<code>group_title</code>、<code>option_A</code>、<code>option_B</code>、<code>option_C</code>、<code>option_D</code>、<code>explanation</code></p>
                <p>相同 <code>subject + topic + group_context</code> 的列會被視為同一題組。</p>
                <p><code>answer</code> 接受 A/B/C/D 或 1/2/3/4；若無選項則視為填空題。</p>
              </div>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleCsvFileUpload}
                className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
              />
            </TabsContent>
          </Tabs>

          {parsingError && (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive whitespace-pre-wrap">
              <div className="mb-2 flex items-center gap-2 font-bold">
                <AlertCircle className="h-4 w-4" />
                驗證錯誤
              </div>
              {parsingError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {previewData && previewSummary && (
        <Card>
          <CardHeader>
            <CardTitle>預覽（{previewSummary.groupCount} 個題組，共 {previewSummary.totalQuestions} 題）</CardTitle>
            <CardDescription>確認內容後再匯入。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="text-sm text-muted-foreground">題組數量</div>
                <div className="mt-1 text-2xl font-semibold">{previewSummary.groupCount}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-sm text-muted-foreground">題目總數</div>
                <div className="mt-1 text-2xl font-semibold">{previewSummary.totalQuestions}</div>
              </div>
            </div>

            <div className="max-h-[420px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>科目</TableHead>
                    <TableHead>單元</TableHead>
                    <TableHead>標題</TableHead>
                    <TableHead>情境（前 30 字）</TableHead>
                    <TableHead>題數</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((group, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{group.subject}</TableCell>
                      <TableCell>{group.topic}</TableCell>
                      <TableCell>{group.group_title ?? "—"}</TableCell>
                      <TableCell
                        className="max-w-[200px] truncate"
                        title={group.group_context}
                      >
                        {group.group_context.slice(0, 30)}{group.group_context.length > 30 ? "…" : ""}
                      </TableCell>
                      <TableCell>{group.questions.length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting
                  ? "匯入中..."
                  : visibility === "study_group"
                    ? `確認匯入並分享 ${previewSummary.groupCount} 個題組`
                    : `確認匯入 ${previewSummary.groupCount} 個題組`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-green-600 mt-0.5" />
              <div>
                <h3 className="font-bold text-green-800 dark:text-green-400">{result.message}</h3>
                <ul className="mt-2 space-y-1 text-sm text-green-700 dark:text-green-500">
                  <li>✅ 成功匯入題組：{result.groupCount}</li>
                  <li>✅ 成功匯入題目：{result.questionCount}</li>
                  <li>⏩ 已跳過（重複題組）：{result.duplicateGroupCount}</li>
                  <li>❌ 錯誤：{result.errorCount}</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
