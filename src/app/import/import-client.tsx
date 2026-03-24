"use client"

import { useMemo, useState } from "react"
import { z } from "zod"
import { toast } from "sonner"
import { CheckCircle2, AlertCircle, Users, ClipboardPaste, FileJson, RefreshCcw } from "lucide-react"

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
import { importQuestionsSchema, ImportedQuestion } from "./schema"
import { importQuestions, ImportResult } from "@/app/actions/import"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { QuestionVisibility, StudyGroupSummary } from "@/types"

type ImportClientProps = {
  studyGroups: StudyGroupSummary[]
}

type ParseSuccess = {
  data: ImportedQuestion[]
  rawText: string
}

function formatIssues(error: z.ZodError) {
  return error.issues
    .map((issue) => {
      if (typeof issue.path[0] === "number") {
        return `第 ${issue.path[0] + 1} 題，${issue.path.slice(1).join(".") || "資料"}：${issue.message}`
      }
      return `${issue.path.join(".") || "資料"}：${issue.message}`
    })
    .join("\n")
}

function parseQuestionsInput(rawText: string): ParseSuccess | { error: string } {
  const trimmed = rawText.trim()

  if (!trimmed) {
    return { error: "請先貼上 JSON，或選擇一個 .json 檔案。" }
  }

  try {
    const json = JSON.parse(trimmed)
    const parsed = importQuestionsSchema.safeParse(json)

    if (!parsed.success) {
      return {
        error: `JSON 格式不符。\n${formatIssues(parsed.error)}`,
      }
    }

    return {
      data: parsed.data,
      rawText: trimmed,
    }
  } catch {
    return { error: "解析失敗。請確認內容是有效的 JSON 陣列。" }
  }
}

export function ImportClient({ studyGroups }: ImportClientProps) {
  const [inputText, setInputText] = useState("")
  const [previewData, setPreviewData] = useState<ImportedQuestion[] | null>(null)
  const [parsingError, setParsingError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [visibility, setVisibility] = useState<QuestionVisibility>("private")
  const [sharedStudyGroupId, setSharedStudyGroupId] = useState<string>(studyGroups[0]?.id ?? "")

  const canShareToGroup = studyGroups.length > 0
  const selectedGroup = useMemo(
    () => studyGroups.find((group) => group.id === sharedStudyGroupId) ?? null,
    [sharedStudyGroupId, studyGroups]
  )

  const previewSummary = useMemo(() => {
    if (!previewData) return null

    const subjects = new Set(previewData.map((item) => item.subject))
    const seenKeys = new Set<string>()
    let duplicateCount = 0

    for (const item of previewData) {
      const key = `${item.subject}::${item.question}`
      if (seenKeys.has(key)) {
        duplicateCount += 1
      } else {
        seenKeys.add(key)
      }
    }

    return {
      total: previewData.length,
      subjectCount: subjects.size,
      duplicateCount,
    }
  }, [previewData])

  const resetPreviewState = () => {
    setParsingError(null)
    setPreviewData(null)
    setResult(null)
  }

  const applyParsedInput = (rawText: string) => {
    resetPreviewState()

    const parsed = parseQuestionsInput(rawText)
    if ("error" in parsed) {
      setParsingError(parsed.error)
      return
    }

    setInputText(parsed.rawText)
    setPreviewData(parsed.data)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (loadEvent) => {
      applyParsedInput(loadEvent.target?.result as string)
    }
    reader.readAsText(file)
  }

  const handlePreview = () => {
    applyParsedInput(inputText)
  }

  const handleReset = () => {
    setInputText("")
    setPreviewData(null)
    setParsingError(null)
    setResult(null)
  }

  const handleImport = async () => {
    if (!previewData) return
    if (visibility === "study_group" && !sharedStudyGroupId) {
      toast.error("請先選擇要分享的讀書房。")
      return
    }

    setIsImporting(true)
    try {
      const res = await importQuestions(previewData, {
        visibility,
        shared_study_group_id: visibility === "study_group" ? sharedStudyGroupId : undefined,
      })
      setResult(res)
      if (res.success) {
        toast.success(visibility === "study_group" ? "共享題庫匯入完成！" : "匯入完成！")
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
          <CardTitle>貼上或上傳題目 JSON</CardTitle>
          <CardDescription>
            可直接貼上 JSON 陣列，或上傳 .json 檔案；送出前會先做格式驗證與預覽。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>匯入方式</Label>
              <Select
                value={visibility}
                onValueChange={(value) => setVisibility((value as QuestionVisibility) ?? "private")}
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
                onValueChange={(value) => setSharedStudyGroupId(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder={canShareToGroup ? "選擇讀書房" : "目前尚未加入讀書房"} />
                </SelectTrigger>
                <SelectContent>
                  {studyGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.memberCount} 人)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {visibility === "study_group" ? (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Users className="h-4 w-4" />
                {selectedGroup ? `將分享至「${selectedGroup.name}」` : "請先選擇讀書房"}
              </div>
              <p className="mt-1">同房成員都能拿這批題目來練習，但每個人的練習紀錄、錯題與結果仍各自分開。</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ClipboardPaste className="h-4 w-4" />
              直接貼上 JSON
            </div>
            <textarea
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              placeholder={`[\n  {\n    "subject": "數學",\n    "topic": "代數",\n    "question": "2 + 2 等於多少？",\n    "options": ["3", "4", "5", "6"],\n    "answer": 1\n  }\n]`}
              className="min-h-[220px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              spellCheck={false}
            />
          </div>

          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileJson className="h-4 w-4" />
              或上傳 JSON 檔案
            </div>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleReset}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              清空
            </Button>
            <Button type="button" onClick={handlePreview}>
              預覽並驗證
            </Button>
          </div>

          {parsingError ? (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive whitespace-pre-wrap">
              <div className="mb-2 flex items-center gap-2 font-bold">
                <AlertCircle className="h-4 w-4" />
                驗證錯誤
              </div>
              {parsingError}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {previewData && previewSummary ? (
        <Card>
          <CardHeader>
            <CardTitle>預覽 ({previewSummary.total} 個項目)</CardTitle>
            <CardDescription>在匯入到資料庫之前請先確認題目內容。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="text-sm text-muted-foreground">題目總數</div>
                <div className="mt-1 text-2xl font-semibold">{previewSummary.total}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-sm text-muted-foreground">涉及科目</div>
                <div className="mt-1 text-2xl font-semibold">{previewSummary.subjectCount}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-sm text-muted-foreground">匯入包內重複</div>
                <div className="mt-1 text-2xl font-semibold">{previewSummary.duplicateCount}</div>
              </div>
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              同一份資料中若出現「相同科目 + 相同題目內容」，匯入時後面的重複題目會被跳過；資料庫裡已存在的重複題目也會自動略過。
            </div>

            <div className="max-h-[400px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>科目</TableHead>
                    <TableHead>單元</TableHead>
                    <TableHead>題目</TableHead>
                    <TableHead>選項</TableHead>
                    <TableHead>答案</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.slice(0, 10).map((q, idx) => (
                    <TableRow key={`${q.subject}-${q.question}-${idx}`}>
                      <TableCell>{q.subject}</TableCell>
                      <TableCell>{q.topic}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={q.question}>{q.question}</TableCell>
                      <TableCell>{q.options.length}</TableCell>
                      <TableCell>{q.answer}</TableCell>
                    </TableRow>
                  ))}
                  {previewData.length > 10 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        ... 同時還有其他 {previewData.length - 10} 個題目
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting
                  ? "匯入中..."
                  : visibility === "study_group"
                    ? `確認匯入並分享 ${previewData.length} 個題目`
                    : `確認匯入 ${previewData.length} 個題目`}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-green-600 mt-0.5" />
              <div>
                <h3 className="font-bold text-green-800 dark:text-green-400">{result.message}</h3>
                <ul className="mt-2 space-y-1 text-sm text-green-700 dark:text-green-500">
                  <li>✅ 成功匯入：{result.validCount}</li>
                  <li>⏩ 已跳過 (重複)：{result.duplicateCount}</li>
                  <li>❌ 錯誤：{result.errorCount}</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
