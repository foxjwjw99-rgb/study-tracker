"use client"

import { useMemo, useState } from "react"
import { z } from "zod"
import { AlertCircle, CheckCircle2, ClipboardPaste, FileJson, RefreshCcw, Users } from "lucide-react"
import { toast } from "sonner"

import { importVocabularyWords } from "@/app/actions/vocabulary"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { vocabularyImportSchema, ImportedVocabularyWord, resolveListName } from "./vocabulary-schema"
import type { ImportResult } from "@/app/actions/import"
import type { QuestionVisibility, StudyGroupSummary, VocabularyListSummary } from "@/types"

const NEW_LIST_OPTION = "__new__"
const PER_ITEM_OPTION = "__per_item__"

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
  vocabularyLists: VocabularyListSummary[]
}

export function VocabularyImportClient({ studyGroups, vocabularyLists }: VocabularyImportClientProps) {
  const [inputText, setInputText] = useState("")
  const [previewData, setPreviewData] = useState<ImportedVocabularyWord[] | null>(null)
  const [parsingError, setParsingError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [visibility, setVisibility] = useState<QuestionVisibility>("private")
  const [sharedStudyGroupId, setSharedStudyGroupId] = useState<string>(studyGroups[0]?.id ?? "")
  const [targetListOption, setTargetListOption] = useState<string>(PER_ITEM_OPTION)
  const [newListName, setNewListName] = useState<string>("")

  const canShareToGroup = studyGroups.length > 0
  const selectedGroup = useMemo(
    () => studyGroups.find((group) => group.id === sharedStudyGroupId) ?? null,
    [sharedStudyGroupId, studyGroups]
  )

  const resolvedTargetListName = useMemo(() => {
    if (targetListOption === PER_ITEM_OPTION) return null
    if (targetListOption === NEW_LIST_OPTION) return newListName.trim() || null
    const selected = vocabularyLists.find((list) => list.id === targetListOption)
    return selected ? selected.name : null
  }, [targetListOption, newListName, vocabularyLists])

  const previewSummary = useMemo(() => {
    if (!previewData) return null

    const listNames = new Set<string>()
    const seenKeys = new Set<string>()
    let duplicateCount = 0

    for (const item of previewData) {
      const listName = (resolvedTargetListName ?? resolveListName(item)).trim()
      listNames.add(listName)
      const key = `${listName}::${item.word.trim().toLowerCase()}`
      if (seenKeys.has(key)) {
        duplicateCount += 1
      } else {
        seenKeys.add(key)
      }
    }

    return {
      total: previewData.length,
      listCount: listNames.size,
      duplicateCount,
    }
  }, [previewData, resolvedTargetListName])

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
    if (targetListOption === NEW_LIST_OPTION && !newListName.trim()) {
      toast.error("請輸入新清單名稱。")
      return
    }
    if (targetListOption === PER_ITEM_OPTION) {
      const missing = previewData.find((item) => !resolveListName(item))
      if (missing) {
        toast.error("JSON 中有單字未設定 list_name（或 subject），請先指定目標清單。")
        return
      }
    }

    setIsImporting(true)
    try {
      const response = await importVocabularyWords(previewData, {
        visibility,
        shared_study_group_id: visibility === "study_group" ? sharedStudyGroupId : undefined,
        list_name: resolvedTargetListName ?? undefined,
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
          <CardDescription>直接貼上原始 JSON 陣列，或上傳 .json 檔案即可；不需要轉成 base64。送出前會先做格式驗證與預覽。</CardDescription>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>目標清單</Label>
              <Select
                value={targetListOption}
                onValueChange={(value) => setTargetListOption(value ?? PER_ITEM_OPTION)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {targetListOption === PER_ITEM_OPTION
                      ? "依 JSON 每筆的 list_name 分配"
                      : targetListOption === NEW_LIST_OPTION
                        ? "新建清單…"
                        : vocabularyLists.find((list) => list.id === targetListOption)?.name ?? "選擇清單"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PER_ITEM_OPTION}>依 JSON 每筆的 list_name 分配</SelectItem>
                  {vocabularyLists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}（{list.word_count} 字）
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_LIST_OPTION}>＋ 新建清單…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {targetListOption === NEW_LIST_OPTION ? (
              <div className="space-y-2">
                <Label>新清單名稱</Label>
                <Input
                  value={newListName}
                  onChange={(event) => setNewListName(event.target.value)}
                  placeholder="例如：托福 3000"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>說明</Label>
                <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  {targetListOption === PER_ITEM_OPTION
                    ? "每筆單字依自己的 list_name（或舊欄位 subject）匯入到對應清單，清單不存在會自動建立。"
                    : "所有匯入的單字都會歸到這個清單，忽略 JSON 內的 list_name。"}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ClipboardPaste className="h-4 w-4" />
              直接貼上 JSON
            </div>
            <textarea
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              placeholder={`[\n  {\n    "list_name": "托福 3000",\n    "word": "abandon",\n    "part_of_speech": "v.",\n    "meaning": "放棄；拋棄",\n    "example_sentence": "He decided to abandon the plan.",\n    "example_sentence_translation": "他決定放棄這個計畫。"\n  }\n]`}
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
                <div className="text-sm text-muted-foreground">涉及清單</div>
                <div className="mt-1 text-2xl font-semibold">{previewSummary.listCount}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-sm text-muted-foreground">匯入包內重複</div>
                <div className="mt-1 text-2xl font-semibold">{previewSummary.duplicateCount}</div>
              </div>
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              同一份資料中若出現「相同清單 + 相同單字」，匯入時後面的重複單字會被跳過；清單裡已存在的重複單字也會自動略過。
            </div>

            <div className="max-h-[420px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>清單</TableHead>
                    <TableHead>英文</TableHead>
                    <TableHead>詞性</TableHead>
                    <TableHead>中文</TableHead>
                    <TableHead>例句</TableHead>
                    <TableHead>例句中譯</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.slice(0, 10).map((item, index) => (
                    <TableRow key={`${resolveListName(item)}-${item.word}-${index}`}>
                      <TableCell>{resolvedTargetListName ?? resolveListName(item) ?? "—"}</TableCell>
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
