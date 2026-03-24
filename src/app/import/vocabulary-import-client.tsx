"use client"

import { useMemo, useState } from "react"
import { z } from "zod"
import { AlertCircle, CheckCircle2, ClipboardPaste, FileJson, RefreshCcw, Users } from "lucide-react"
import { toast } from "sonner"

import { importVocabularyWords } from "@/app/actions/vocabulary"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { vocabularyImportSchema, ImportedVocabularyWord } from "./vocabulary-schema"
import type { ImportResult } from "@/app/actions/import"
import type { QuestionVisibility, StudyGroupSummary } from "@/types"

function formatIssues(error: z.ZodError) {
  return error.issues
    .map((issue) => {
      if (typeof issue.path[0] === "number") {
        return `第 ${issue.path[0] + 1} 筆，${issue.path.slice(1).join(".") || "資料"}：${issue.message}`
      }
      return `${issue.path.join(".") || "資料"}：${issue.message}`
    })
    .join("\n")
}

function parseVocabularyInput(rawText: string) {
  const trimmed = rawText.trim()

  if (!trimmed) {
    return { error: "請先貼上 JSON，或選擇一個 .json 檔案。" } as const
  }

  try {
    const json = JSON.parse(trimmed)
    const parsed = vocabularyImportSchema.safeParse(json)

    if (!parsed.success) {
      return {
        error: `JSON 格式不符。\n${formatIssues(parsed.error)}`,
      } as const
    }

    return {
      data: parsed.data,
      rawText: trimmed,
    } as const
  } catch {
    return { error: "解析失敗。請確認內容是有效的 JSON 陣列。" } as const
  }
}

type VocabularyImportClientProps = {
  studyGroups: StudyGroupSummary[]
}

export function VocabularyImportClient({ studyGroups }: VocabularyImportClientProps) {
  const [inputText, setInputText] = useState("")
  const [previewData, setPreviewData] = useState<ImportedVocabularyWord[] | null>(null)
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

    const subjects = new Set(previewData.map((item) => item.subject.trim()))
    const seenKeys = new Set<string>()
    let duplicateCount = 0

    for (const item of previewData) {
      const key = `${item.subject.trim()}::${item.word.trim().toLowerCase()}`
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
    setPreviewData(null)
    setParsingError(null)
    setResult(null)
  }

  const applyParsedInput = (rawText: string) => {
    resetPreviewState()

    const parsed = parseVocabularyInput(rawText)
    if ("error" in parsed && parsed.error) {
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
      applyParsedInput((loadEvent.target?.result as string) || "")
    }
    reader.readAsText(file)
  }

  const handlePreview = () => {
    applyParsedInput(inputText)
  }

  const handleReset = () => {
    setInputText("")
    resetPreviewState()
  }

  const handleImport = async () => {
    if (!previewData) return
    if (visibility === "study_group" && !sharedStudyGroupId) {
      toast.error("請先選擇要分享的讀書房。")
      return
    }

    setIsImporting(true)
    try {
      const response = await importVocabularyWords(previewData, {
        visibility,
        shared_study_group_id: visibility === "study_group" ? sharedStudyGroupId : undefined,
      })
      setResult(response)
      if (response.success) {
        toast.success(visibility === "study_group" ? "英文單字已分享到讀書房！" : "英文單字匯入完成！")
      } else {
        toast.error(response.message)
      }
    } catch {
      toast.error("英文單字匯入失敗。")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>貼上或上傳英文單字 JSON</CardTitle>
          <CardDescription>可直接貼上 JSON 陣列，或上傳 .json 檔案；送出前會先做格式驗證與預覽。</CardDescription>
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
                    {visibility === "study_group" ? "分享到讀書房" : "私人單字庫（只有自己可背）"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">私人單字庫（只有自己可背）</SelectItem>
                  <SelectItem value="study_group" disabled={!canShareToGroup}>
                    分享到讀書房
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>讀書房</Label>
              {visibility === "study_group" ? (
                <Select
                  value={sharedStudyGroupId}
                  disabled={!canShareToGroup}
                  onValueChange={(value) => setSharedStudyGroupId(value ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {selectedGroup
                        ? `${selectedGroup.name} (${selectedGroup.memberCount} 人)`
                        : canShareToGroup
                          ? "選擇讀書房"
                          : "目前尚未加入讀書房"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {studyGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} ({group.memberCount} 人)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  目前為私人單字庫，不會分享到讀書房。
                </div>
              )}
            </div>
          </div>

          {visibility === "study_group" ? (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Users className="h-4 w-4" />
                {selectedGroup ? `將分享至「${selectedGroup.name}」` : "請先選擇讀書房"}
              </div>
              <p className="mt-1">這批單字會發給目前房內成員，但每個人的熟悉度、複習排程與 review 紀錄仍各自獨立。</p>
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
              placeholder={`[\n  {\n    "subject": "英文",\n    "word": "abandon",\n    "part_of_speech": "v.",\n    "meaning": "放棄；拋棄",\n    "example_sentence": "He decided to abandon the plan.",\n    "example_sentence_translation": "他決定放棄這個計畫。"\n  }\n]`}
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
            <div className="whitespace-pre-wrap rounded-md bg-destructive/10 p-4 text-sm text-destructive">
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
            <CardTitle>預覽 ({previewSummary.total} 個單字)</CardTitle>
            <CardDescription>確認內容後再匯入。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="text-sm text-muted-foreground">單字總數</div>
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
              同一份資料中若出現「相同科目 + 相同單字」，匯入時後面的重複單字會被跳過；資料庫裡已存在的重複單字也會自動略過。
            </div>

            <div className="max-h-[420px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>科目</TableHead>
                    <TableHead>英文</TableHead>
                    <TableHead>詞性</TableHead>
                    <TableHead>中文</TableHead>
                    <TableHead>例句</TableHead>
                    <TableHead>例句中譯</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.slice(0, 10).map((item, index) => (
                    <TableRow key={`${item.subject}-${item.word}-${index}`}>
                      <TableCell>{item.subject}</TableCell>
                      <TableCell>{item.word}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.part_of_speech ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate" title={item.meaning}>
                        {item.meaning}
                      </TableCell>
                      <TableCell className="max-w-[190px] truncate" title={item.example_sentence}>
                        {item.example_sentence}
                      </TableCell>
                      <TableCell className="max-w-[190px] truncate" title={item.example_sentence_translation ?? ""}>
                        {item.example_sentence_translation ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {previewData.length > 10 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        ... 還有其他 {previewData.length - 10} 個單字
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting
                  ? "匯入中..."
                  : visibility === "study_group"
                    ? `確認匯入並分享 ${previewData.length} 個單字`
                    : `確認匯入 ${previewData.length} 個單字`}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="mt-0.5 h-6 w-6 text-green-600" />
              <div>
                <h3 className="font-bold text-green-800 dark:text-green-400">{result.message}</h3>
                <ul className="mt-2 space-y-1 text-sm text-green-700 dark:text-green-500">
                  <li>✅ 成功匯入：{result.validCount}</li>
                  <li>⏩ 已跳過：{result.duplicateCount}</li>
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
