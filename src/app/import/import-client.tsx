"use client"

import Image from "next/image"
import { useRef, useMemo, useState, useEffect } from "react"
import { toast } from "sonner"
import {
  CheckCircle2,
  AlertCircle,
  Users,
  ClipboardPaste,
  FileJson,
  RefreshCcw,
  ImageIcon,
  Copy,
  ChevronDown,
  ChevronUp,
  Bot,
  Wrench,
  Search,
  XCircle,
} from "lucide-react"

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
import {
  type ImportedQuestionImportItem,
  type MathMcQuestion,
  isImportedQuestionGroup,
} from "./schema"
import {
  summarizeImportPreview,
  summarizeMathImportPreview,
  type ImportFailure,
} from "./parser"
import { preprocessImportFile, preprocessImportText } from "./preprocess"
import { importQuestions, type ImportResult } from "@/app/actions/import"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { QuestionVisibility, StudyGroupSummary } from "@/types"

const EXAMPLE_JSON = `[
  {
    "subject": "數學",
    "topic": "微積分",
    "question_type": "multiple_choice",
    "question": "求 $\\\\lim_{x \\\\to 0} \\\\dfrac{\\\\sin x}{x}$ 的值",
    "options": ["$0$", "$1$", "$\\\\infty$", "不存在"],
    "answer": 1,
    "explanation": "利用夾擠定理可得 $\\\\lim_{x \\\\to 0} \\\\dfrac{\\\\sin x}{x} = 1$",
    "difficulty": "easy",
    "tags": ["極限", "三角函數"],
    "hint": "考慮夾擠定理",
    "source": { "exam": "112四技二專統測", "year": 2023, "number": 3 },
    "status": "published",
    "external_id": "calc-limit-001"
  },
  {
    "subject": "數學",
    "topic": "積分",
    "question_type": "fill_in_blank",
    "question": "$$\\\\int_0^3 x^2\\\\,dx =$$ ___",
    "blanks": [
      { "label": "(1)", "answer": "9", "alternatives": ["9.0"] }
    ],
    "explanation": "$$\\\\int_0^3 x^2\\\\,dx = \\\\left[\\\\frac{x^3}{3}\\\\right]_0^3 = 9$$",
    "difficulty": "easy",
    "external_id": "calc-integral-001"
  },
  {
    "subject": "英文",
    "topic": "文法",
    "question": "The process is called ___.",
    "question_type": "fill_in_blank",
    "text_answer": "photosynthesis|光合作用",
    "explanation": "多個接受答案可用 | 分隔。"
  },
  {
    "subject": "國文",
    "topic": "閱讀測驗",
    "difficulty": "hard",
    "tags": ["閱讀理解"],
    "status": "published",
    "group_title": "閱讀題組 1",
    "group_context": "閱讀下文，回答第 1–2 題。",
    "external_id": "cn-group-001",
    "questions": [
      {
        "question": "下列敘述何者正確？",
        "options": ["A", "B", "C", "D"],
        "answer": 2
      },
      {
        "question": "本文主旨是 ___。",
        "question_type": "fill_in_blank",
        "blanks": [
          { "label": "(1)", "answer": "珍惜時間", "alternatives": ["把握當下"] }
        ]
      }
    ]
  }
]`

const MATH_EXAMPLE_JSON = `[
  {
    "external_id": "calc_001",
    "subject": "數學",
    "topic": "微分",
    "group_id": "",
    "group_title": "",
    "group_text": "",
    "group_latex": "",
    "group_image_url": "",
    "question_text": "求下列函數的導數：",
    "question_latex": "f(x)=x^3+2x^2-5x+1",
    "question_image_url": "",
    "option_1_text": "", "option_1_latex": "3x^2+4x-5", "option_1_image_url": "",
    "option_2_text": "", "option_2_latex": "x^2+2x-5", "option_2_image_url": "",
    "option_3_text": "", "option_3_latex": "3x^2+2x-5", "option_3_image_url": "",
    "option_4_text": "", "option_4_latex": "3x+4x-5", "option_4_image_url": "",
    "answer": 0,
    "explanation_text": "使用冪次法則。",
    "explanation_latex": "f'(x)=3x^2+4x-5",
    "explanation_image_url": ""
  }
]`

const MATH_AI_PROMPT = `請將以下題目轉換成 JSON 陣列格式。

規則：
1. 一般文字放在 *_text
2. 數學公式放在 *_latex（必須使用標準 LaTeX 語法）
3. 圖片放在 *_image_url（僅 URL）
4. 沒有內容請填空字串 ""
5. 所有欄位必須完整，不可省略
6. answer 為正確選項索引（從 0 開始）
7. 輸出純 JSON 陣列，不要額外說明文字
8. 題組題：同一題組的所有題目填入相同的 group_id（自訂字串）

以下是要轉換的題目：
（在此貼上你的題目）`

const DEFAULT_RENDER_LIMIT = 200

type ImportClientProps = {
  studyGroups: StudyGroupSummary[]
}

type PreviewState =
  | { kind: "empty" }
  | { kind: "mixed"; items: ImportedQuestionImportItem[] }
  | { kind: "math"; items: MathMcQuestion[] }

function buildFailureKey(f: ImportFailure) {
  return `${f.index}:${f.childIndex ?? "-"}:${f.reason}`
}

function rowFailureKey(index: number, childIndex?: number) {
  return `${index}:${childIndex ?? "-"}`
}

function previewText(value: string | undefined, max = 60): string {
  if (!value) return ""
  const trimmed = value.trim()
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`
}

export function ImportClient({ studyGroups }: ImportClientProps) {
  const [inputText, setInputText] = useState("")
  const [preview, setPreview] = useState<PreviewState>({ kind: "empty" })
  const [parseFailures, setParseFailures] = useState<ImportFailure[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [visibility, setVisibility] = useState<QuestionVisibility>("private")
  const [sharedStudyGroupId, setSharedStudyGroupId] = useState<string>(studyGroups[0]?.id ?? "")
  const [showTools, setShowTools] = useState(false)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [showAll, setShowAll] = useState(false)

  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())

  const canShareToGroup = studyGroups.length > 0
  const selectedGroup = useMemo(
    () => studyGroups.find((group) => group.id === sharedStudyGroupId) ?? null,
    [sharedStudyGroupId, studyGroups]
  )

  const previewSummary = useMemo(() => {
    if (preview.kind === "math") return summarizeMathImportPreview(preview.items)
    if (preview.kind === "mixed") return summarizeImportPreview(preview.items)
    return null
  }, [preview])

  const activeFailures: ImportFailure[] = useMemo(() => {
    if (result?.failures?.length) return result.failures
    return parseFailures
  }, [result, parseFailures])

  const failureKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const f of activeFailures) keys.add(rowFailureKey(f.index, f.childIndex))
    for (const f of activeFailures) keys.add(rowFailureKey(f.index))
    return keys
  }, [activeFailures])

  const totalCount =
    preview.kind === "empty" ? 0 : preview.kind === "mixed" ? preview.items.length : preview.items.length

  const filteredMixed = useMemo(() => {
    if (preview.kind !== "mixed") return []
    const needle = filter.trim().toLowerCase()
    return preview.items
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => {
        if (!needle) return true
        const body = isImportedQuestionGroup(item)
          ? [item.subject, item.topic, item.group_title, item.group_context].filter(Boolean).join(" ")
          : [item.subject, item.topic, item.question].filter(Boolean).join(" ")
        return body.toLowerCase().includes(needle)
      })
  }, [preview, filter])

  const filteredMath = useMemo(() => {
    if (preview.kind !== "math") return []
    const needle = filter.trim().toLowerCase()
    return preview.items
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => {
        if (!needle) return true
        const body = [item.subject, item.topic, item.question_text, item.question_latex, item.external_id]
          .filter(Boolean)
          .join(" ")
        return body.toLowerCase().includes(needle)
      })
  }, [preview, filter])

  const renderLimit = showAll ? Number.MAX_SAFE_INTEGER : DEFAULT_RENDER_LIMIT

  const resetPreviewState = () => {
    setPreview({ kind: "empty" })
    setParseFailures([])
    setParseError(null)
    setResult(null)
    setFilter("")
    setShowAll(false)
    rowRefs.current.clear()
  }

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

  const applyPreview = (parsed: Awaited<ReturnType<typeof preprocessImportText>>, sourceText?: string) => {
    if ("error" in parsed) {
      setPreview({ kind: "empty" })
      setParseFailures([])
      setParseError(parsed.error)
      return
    }
    if (sourceText !== undefined) setInputText(sourceText)
    else if (parsed.rawText && !parsed.rawText.startsWith("[Excel:")) setInputText(parsed.rawText)

    if (parsed.isMathFormat) {
      setPreview({ kind: "math", items: parsed.data })
    } else {
      setPreview({ kind: "mixed", items: parsed.data })
    }
    setParseFailures([])
    setParseError(null)
    setResult(null)
  }

  const handlePreview = async () => {
    resetPreviewState()
    const parsed = await preprocessImportText(inputText)
    applyPreview(parsed, inputText)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    resetPreviewState()
    const parsed = await preprocessImportFile(file)
    applyPreview(parsed)
    // allow re-selecting the same file later
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleFillExample = () => {
    setInputText(EXAMPLE_JSON)
    resetPreviewState()
  }

  const handleFillMathExample = () => {
    setInputText(MATH_EXAMPLE_JSON)
    resetPreviewState()
  }

  const handleCopyAiPrompt = () => {
    navigator.clipboard.writeText(MATH_AI_PROMPT)
    toast.success("已複製 AI 提示詞！")
  }

  const handleReset = () => {
    setInputText("")
    resetPreviewState()
  }

  const handleImport = async () => {
    if (preview.kind === "empty") return
    if (visibility === "study_group" && !sharedStudyGroupId) {
      toast.error("請先選擇要分享的讀書房。")
      return
    }

    setIsImporting(true)
    try {
      const res = await importQuestions(preview.items, {
        visibility,
        shared_study_group_id: visibility === "study_group" ? sharedStudyGroupId : undefined,
      })
      setResult(res)
      if (res.success) {
        if (res.failures.length > 0) {
          toast.warning(`匯入完成，但有 ${res.failures.length} 筆失敗，請看問題清單。`)
        } else {
          toast.success(visibility === "study_group" ? "共享題庫匯入完成！" : "匯入完成！")
        }
      } else {
        toast.error(res.message)
      }
    } catch {
      toast.error("匯入過程中發生伺服器錯誤。")
    } finally {
      setIsImporting(false)
    }
  }

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    const previewUrl = URL.createObjectURL(file)
    setImagePreviewUrl(previewUrl)

    const reader = new FileReader()
    reader.onload = (e) => setImageBase64(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleCopyBase64 = () => {
    if (!imageBase64) return
    navigator.clipboard.writeText(imageBase64)
    toast.success("已複製到剪貼簿！")
  }

  const scrollToRow = (index: number, childIndex?: number) => {
    const key = rowFailureKey(index, childIndex)
    const row = rowRefs.current.get(key) ?? rowRefs.current.get(rowFailureKey(index))
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  const mixedRowsToRender = filteredMixed.slice(0, renderLimit)
  const mathRowsToRender = filteredMath.slice(0, renderLimit)
  const overflowCount =
    preview.kind === "mixed"
      ? filteredMixed.length - mixedRowsToRender.length
      : preview.kind === "math"
        ? filteredMath.length - mathRowsToRender.length
        : 0

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>貼上或上傳題目</CardTitle>
          <CardDescription>
            支援 JSON（單題、填空、題組、數學規格）、CSV（單題或題組）、Excel（題組）。上傳後系統會自動偵測格式，送出前先做驗證與預覽。
            題目文字支援 LaTeX 數學語法：行內公式用 <code className="rounded bg-muted px-1 text-xs">$...$</code>，區塊公式用 <code className="rounded bg-muted px-1 text-xs">$$...$$</code>。
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

            {visibility === "study_group" && (
              <div className="space-y-2">
                <Label>讀書房</Label>
                <Select
                  value={sharedStudyGroupId}
                  disabled={!canShareToGroup}
                  onValueChange={(value) => setSharedStudyGroupId(value ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={canShareToGroup ? "選擇讀書房" : "目前尚未加入讀書房"}>
                      {(() => {
                        const group = studyGroups.find((g) => g.id === sharedStudyGroupId)
                        return group ? `${group.name} (${group.memberCount} 人)` : undefined
                      })()}
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
              </div>
            )}
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ClipboardPaste className="h-4 w-4" />
                直接貼上 JSON
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={handleFillMathExample} className="text-xs h-7 px-2">
                  數學格式範例
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={handleFillExample} className="text-xs h-7 px-2">
                  填入範例
                </Button>
              </div>
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
              或上傳 JSON / CSV / Excel 檔案
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
            />
            <p className="text-xs text-muted-foreground">
              CSV 單題欄位：<code>subject,topic,question,option_a,option_b,option_c,option_d,answer,explanation</code>（answer 填 A/B/C/D）。題組 CSV / Excel 需含 <code>group_context</code> 欄位。
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleReset}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              清空
            </Button>
            <Button type="button" onClick={handlePreview} disabled={!inputText.trim()}>
              預覽並驗證
            </Button>
          </div>

          {parseError ? (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive whitespace-pre-wrap">
              <div className="mb-2 flex items-center gap-2 font-bold">
                <AlertCircle className="h-4 w-4" />
                驗證錯誤
              </div>
              {parseError}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="cursor-pointer select-none" onClick={() => setShowTools((v) => !v)}>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              輔助工具
            </span>
            {showTools ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
          <CardDescription>圖片轉 base64、AI 生成提示詞（數學格式）</CardDescription>
        </CardHeader>
        {showTools && (
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                圖片轉 base64 小工具
              </h4>
              <p className="text-sm text-muted-foreground">將圖片轉成 base64 字串，複製後貼入 JSON 的 &quot;image&quot; 欄位即可。</p>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
              />
              {imagePreviewUrl && (
                <div className="space-y-3">
                  <Image
                    src={imagePreviewUrl}
                    alt="預覽"
                    width={640}
                    height={320}
                    unoptimized
                    className="max-h-48 w-auto rounded-lg border object-contain"
                  />
                  {imageBase64 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">複製以下字串，貼入 JSON 的 <code className="rounded bg-muted px-1">&quot;image&quot;</code> 欄位：</p>
                        <Button type="button" variant="outline" size="sm" onClick={handleCopyBase64}>
                          <Copy className="mr-1 h-3 w-3" />
                          複製
                        </Button>
                      </div>
                      <textarea
                        readOnly
                        value={imageBase64}
                        className="min-h-[80px] w-full rounded-md border bg-muted/50 px-3 py-2 text-xs font-mono"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t" />

            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Bot className="h-4 w-4" />
                AI 生成提示詞（數學題庫格式）
              </h4>
              <p className="text-sm text-muted-foreground">複製以下 Prompt，貼給 AI 後附上原始題目，即可自動轉換為數學題庫 JSON 格式。</p>
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={handleCopyAiPrompt}>
                  <Copy className="mr-1 h-3 w-3" />
                  複製提示詞
                </Button>
              </div>
              <textarea
                readOnly
                value={MATH_AI_PROMPT}
                className="min-h-[200px] w-full rounded-md border bg-muted/50 px-3 py-2 text-xs font-mono"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {activeFailures.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <XCircle className="h-4 w-4" />
              問題清單（{activeFailures.length}）
            </CardTitle>
            <CardDescription>
              點選任何一列即可跳至預覽表對應項目。已經成功匯入的好題目不會出現在這裡。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border">
              {activeFailures.map((f) => (
                <li
                  key={buildFailureKey(f)}
                  role="button"
                  tabIndex={0}
                  onClick={() => scrollToRow(f.index, f.childIndex)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") scrollToRow(f.index, f.childIndex)
                  }}
                  className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-muted/60"
                >
                  <span className="mt-0.5 inline-flex h-5 min-w-[2rem] items-center justify-center rounded bg-destructive/15 px-1 text-xs font-mono text-destructive">
                    #{f.index + 1}
                    {f.childIndex !== undefined ? `.${f.childIndex + 1}` : ""}
                  </span>
                  <div className="flex-1">
                    <div className="text-muted-foreground">{f.label}</div>
                    <div className="text-destructive">{f.reason}</div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {preview.kind !== "empty" && previewSummary ? (
        <Card>
          <CardHeader>
            <CardTitle>
              預覽（{previewSummary.totalItems} 個項目）
              {preview.kind === "math" ? (
                <span className="ml-2 text-sm font-normal text-sky-600 dark:text-sky-400">數學題庫格式</span>
              ) : null}
            </CardTitle>
            <CardDescription>在匯入到資料庫之前，先確認單題 / 題組數量、疑似重複與內容。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-5">
              <div className="rounded-lg border p-3">
                <div className="text-sm text-muted-foreground">單題數</div>
                <div className="mt-1 text-2xl font-semibold">{previewSummary.singleQuestionCount}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-sm text-muted-foreground">題組數</div>
                <div className="mt-1 text-2xl font-semibold">{previewSummary.groupCount}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-sm text-muted-foreground">題組內總題數</div>
                <div className="mt-1 text-2xl font-semibold">{previewSummary.nestedGroupQuestionCount}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-sm text-muted-foreground">涉及科目</div>
                <div className="mt-1 text-2xl font-semibold">{previewSummary.subjectCount}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-sm text-muted-foreground">疑似重複</div>
                <div className="mt-1 text-2xl font-semibold">{previewSummary.duplicateSuspectCount}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="搜尋科目 / 單元 / 題幹..."
                  className="pl-9"
                />
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                顯示 {Math.min(renderLimit, preview.kind === "mixed" ? filteredMixed.length : filteredMath.length)} / 共 {totalCount} 筆
              </div>
            </div>

            <div className="max-h-[560px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {preview.kind === "math" ? (
                      <>
                        <TableHead className="w-[60px]">#</TableHead>
                        <TableHead>external_id</TableHead>
                        <TableHead>科目</TableHead>
                        <TableHead>單元</TableHead>
                        <TableHead>題目（文字）</TableHead>
                        <TableHead>公式</TableHead>
                        <TableHead>答案</TableHead>
                        <TableHead>題組</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="w-[60px]">#</TableHead>
                        <TableHead>類型</TableHead>
                        <TableHead>科目</TableHead>
                        <TableHead>單元</TableHead>
                        <TableHead>內容</TableHead>
                        <TableHead>題數 / 答案</TableHead>
                        <TableHead>表格</TableHead>
                        <TableHead>圖片</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.kind === "math"
                    ? mathRowsToRender.map(({ item, originalIndex }) => {
                        const key = rowFailureKey(originalIndex)
                        const hasFailure = failureKeys.has(key)
                        return (
                          <TableRow
                            key={`math-${originalIndex}`}
                            ref={(el) => {
                              if (el) rowRefs.current.set(key, el)
                              else rowRefs.current.delete(key)
                            }}
                            className={hasFailure ? "border-l-4 border-l-destructive bg-destructive/5" : undefined}
                          >
                            <TableCell className="font-mono text-xs text-muted-foreground">{originalIndex + 1}</TableCell>
                            <TableCell className="max-w-[100px] truncate text-muted-foreground">{item.external_id ?? "—"}</TableCell>
                            <TableCell>{item.subject}</TableCell>
                            <TableCell>{item.topic}</TableCell>
                            <TableCell className="max-w-[180px] truncate" title={item.question_text}>
                              {item.question_text || <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="max-w-[180px] truncate font-mono text-xs" title={item.question_latex}>
                              {item.question_latex || <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>{item.answer + 1}</TableCell>
                            <TableCell>{item.group_id || <span className="text-muted-foreground">—</span>}</TableCell>
                          </TableRow>
                        )
                      })
                    : mixedRowsToRender.map(({ item, originalIndex }) => {
                        const isGroup = isImportedQuestionGroup(item)
                        const key = rowFailureKey(originalIndex)
                        const hasFailure = failureKeys.has(key)
                        return (
                          <TableRow
                            key={`mixed-${originalIndex}`}
                            ref={(el) => {
                              if (el) rowRefs.current.set(key, el)
                              else rowRefs.current.delete(key)
                            }}
                            className={hasFailure ? "border-l-4 border-l-destructive bg-destructive/5" : undefined}
                          >
                            <TableCell className="font-mono text-xs text-muted-foreground">{originalIndex + 1}</TableCell>
                            <TableCell>{isGroup ? "題組" : item.question_type === "fill_in_blank" ? "填充" : "單題"}</TableCell>
                            <TableCell>{item.subject}</TableCell>
                            <TableCell>{item.topic}</TableCell>
                            <TableCell className="max-w-[240px] truncate" title={isGroup ? item.group_context : item.question}>
                              {isGroup ? previewText(item.group_title ?? item.group_context, 80) : previewText(item.question, 80)}
                            </TableCell>
                            <TableCell>
                              {isGroup
                                ? `${item.questions.length} 題`
                                : item.question_type === "fill_in_blank"
                                  ? (item.text_answer ?? (item.blanks?.length ? `[${item.blanks.length} 空格]` : "—"))
                                  : item.answer}
                            </TableCell>
                            <TableCell>
                              {item.table
                                ? `${item.table.headers.length} 欄 × ${item.table.rows.length} 列`
                                : isGroup && item.questions.some((q) => q.table)
                                  ? `子題有表格`
                                  : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              {!isGroup && item.image ? (
                                <Image
                                  src={item.image}
                                  alt="題目圖片"
                                  width={32}
                                  height={32}
                                  unoptimized
                                  className="h-8 w-8 rounded object-cover"
                                />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                  {overflowCount > 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        還有 {overflowCount} 筆未顯示。
                        <Button
                          variant="link"
                          size="sm"
                          className="ml-1 h-auto p-0"
                          onClick={() => setShowAll(true)}
                        >
                          展開全部
                        </Button>
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
                    ? `確認匯入並分享 ${previewSummary.totalItems} 個項目`
                    : `確認匯入 ${previewSummary.totalItems} 個項目`}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <Card
          className={
            result.failures.length > 0
              ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20"
              : "border-green-200 bg-green-50 dark:bg-green-950/20"
          }
        >
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              {result.failures.length > 0 ? (
                <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-green-600 mt-0.5" />
              )}
              <div>
                <h3
                  className={
                    result.failures.length > 0
                      ? "font-bold text-amber-800 dark:text-amber-400"
                      : "font-bold text-green-800 dark:text-green-400"
                  }
                >
                  {result.message}
                </h3>
                <ul
                  className={
                    result.failures.length > 0
                      ? "mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-500"
                      : "mt-2 space-y-1 text-sm text-green-700 dark:text-green-500"
                  }
                >
                  <li>✅ 成功匯入單題：{result.validCount}</li>
                  <li>✅ 成功匯入題組：{result.groupCount ?? 0}</li>
                  <li>✅ 題組內成功匯入題目：{result.groupQuestionCount ?? 0}</li>
                  <li>⏩ 已跳過（重複）：{result.duplicateCount}</li>
                  <li>⏩ 已跳過（重複題組）：{result.duplicateGroupCount ?? 0}</li>
                  <li>❌ 失敗：{result.failures.length}（詳情見上方問題清單）</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
