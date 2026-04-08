"use client"

import Image from "next/image"
import { useRef, useMemo, useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, AlertCircle, Users, ClipboardPaste, FileJson, RefreshCcw, ImageIcon, Copy, ChevronDown, ChevronUp, Bot } from "lucide-react"

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
import { type ImportedQuestionImportItem, type MathMcQuestion, isImportedQuestionGroup } from "./schema"
import { parseImportInput, summarizeImportPreview, summarizeMathImportPreview } from "./parser"
import { importQuestions, ImportResult } from "@/app/actions/import"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { QuestionVisibility, StudyGroupSummary } from "@/types"

const EXAMPLE_JSON = `[
  {
    "subject": "數學",
    "topic": "代數",
    "question": "2 + 2 等於多少？",
    "question_type": "multiple_choice",
    "options": ["3", "4", "5", "6"],
    "answer": 1,
    "explanation": "因為 2 加 2 等於 4。",
    "external_id": "math-basic-001"
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
        "text_answer": "珍惜時間|把握當下"
      }
    ]
  },
  {
    "subject": "經濟",
    "topic": "需求與供給",
    "group_context": "根據下表，回答第 1–2 題。",
    "table": {
      "headers": ["年份", "需求量", "供給量"],
      "rows": [
        ["2022", "500", "480"],
        ["2023", "520", "530"]
      ]
    },
    "questions": [
      {
        "question": "2023 年市場處於何種狀態？",
        "options": ["供過於求", "求過於供", "均衡", "無法判斷"],
        "answer": 0
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
    "option_1_text": "",
    "option_1_latex": "3x^2+4x-5",
    "option_1_image_url": "",
    "option_2_text": "",
    "option_2_latex": "x^2+2x-5",
    "option_2_image_url": "",
    "option_3_text": "",
    "option_3_latex": "3x^2+2x-5",
    "option_3_image_url": "",
    "option_4_text": "",
    "option_4_latex": "3x+4x-5",
    "option_4_image_url": "",
    "answer": 0,
    "explanation_text": "使用冪次法則。",
    "explanation_latex": "f'(x)=3x^2+4x-5",
    "explanation_image_url": ""
  },
  {
    "external_id": "calc_002",
    "subject": "數學",
    "topic": "極限",
    "group_id": "lim-group-01",
    "group_title": "極限計算題組",
    "group_text": "求下列各極限值：",
    "group_latex": "",
    "group_image_url": "",
    "question_text": "第 1 題",
    "question_latex": "\\lim_{x \\to 0} \\frac{\\sin x}{x}",
    "question_image_url": "",
    "option_1_text": "0",
    "option_1_latex": "",
    "option_1_image_url": "",
    "option_2_text": "1",
    "option_2_latex": "",
    "option_2_image_url": "",
    "option_3_text": "不存在",
    "option_3_latex": "",
    "option_3_image_url": "",
    "option_4_text": "無限大",
    "option_4_latex": "",
    "option_4_image_url": "",
    "answer": 1,
    "explanation_text": "此為重要基本極限。",
    "explanation_latex": "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1",
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
6. answer 為正確選項索引（從 0 開始，0=選項1、1=選項2、2=選項3、3=選項4）
7. 輸出純 JSON 陣列，不要額外說明文字
8. 題組題：同一題組的所有題目填入相同的 group_id（自訂字串）

格式如下：
[
  {
    "external_id": "唯一編號",
    "subject": "科目",
    "topic": "單元",
    "group_id": "",
    "group_title": "",
    "group_text": "",
    "group_latex": "",
    "group_image_url": "",
    "question_text": "",
    "question_latex": "",
    "question_image_url": "",
    "option_1_text": "", "option_1_latex": "", "option_1_image_url": "",
    "option_2_text": "", "option_2_latex": "", "option_2_image_url": "",
    "option_3_text": "", "option_3_latex": "", "option_3_image_url": "",
    "option_4_text": "", "option_4_latex": "", "option_4_image_url": "",
    "answer": 0,
    "explanation_text": "",
    "explanation_latex": "",
    "explanation_image_url": ""
  }
]

以下是要轉換的題目：
（在此貼上你的題目）`

type ImportClientProps = {
  studyGroups: StudyGroupSummary[]
}

type ParseSuccess = {
  data: ImportedQuestionImportItem[]
  rawText: string
  isMathFormat?: false
}

type ParseMathSuccess = {
  data: MathMcQuestion[]
  rawText: string
  isMathFormat: true
}

function parseCsvRow(row: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseCsvInput(rawText: string): ParseSuccess | { error: string } {
  const lines = rawText.trim().split(/\r?\n/)
  if (lines.length < 2) return { error: "CSV 至少需要標題行與一筆資料。" }

  const headers = parseCsvRow(lines[0]).map((h) => h.trim().toLowerCase())
  const required = ["subject", "topic", "question", "option_a", "option_b", "answer"]
  const missing = required.filter((h) => !headers.includes(h))
  if (missing.length > 0) return { error: `CSV 缺少必要欄位：${missing.join(", ")}` }

  const idx = (name: string) => headers.indexOf(name)

  const questions: ImportedQuestionImportItem[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = parseCsvRow(line)
    const get = (name: string) => (cols[idx(name)] ?? "").trim()

    const options: string[] = []
    const optA = get("option_a"); if (optA) options.push(optA)
    const optB = get("option_b"); if (optB) options.push(optB)
    const optC = get("option_c"); if (optC) options.push(optC)
    const optD = get("option_d"); if (optD) options.push(optD)

    const rawAnswer = get("answer").toUpperCase()
    let answerIdx: number
    if (rawAnswer === "A") answerIdx = 0
    else if (rawAnswer === "B") answerIdx = 1
    else if (rawAnswer === "C") answerIdx = 2
    else if (rawAnswer === "D") answerIdx = 3
    else {
      const n = parseInt(rawAnswer, 10)
      if (isNaN(n)) return { error: `第 ${i} 行的 answer 格式不正確（應為 A/B/C/D 或 0/1/2/3）。` }
      answerIdx = n
    }

    if (answerIdx >= options.length) {
      return { error: `第 ${i} 行的 answer 超出選項範圍。` }
    }

    questions.push({
      subject: get("subject"),
      topic: get("topic"),
      question: get("question"),
      question_type: "multiple_choice",
      options,
      answer: answerIdx,
      explanation: get("explanation") || undefined,
    })
  }

  if (questions.length === 0) return { error: "CSV 沒有有效的題目資料。" }
  return { data: questions, rawText }
}

function parseQuestionsInput(rawText: string): ParseSuccess | ParseMathSuccess | { error: string } {
  return parseImportInput(rawText)
}

export function ImportClient({ studyGroups }: ImportClientProps) {
  const [inputText, setInputText] = useState("")
  const [previewData, setPreviewData] = useState<ImportedQuestionImportItem[] | null>(null)
  const [mathPreviewData, setMathPreviewData] = useState<MathMcQuestion[] | null>(null)
  const [parsingError, setParsingError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [visibility, setVisibility] = useState<QuestionVisibility>("private")
  const [sharedStudyGroupId, setSharedStudyGroupId] = useState<string>(studyGroups[0]?.id ?? "")
  const [showImageTool, setShowImageTool] = useState(false)
  const [showAiPrompt, setShowAiPrompt] = useState(false)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const canShareToGroup = studyGroups.length > 0
  const selectedGroup = useMemo(
    () => studyGroups.find((group) => group.id === sharedStudyGroupId) ?? null,
    [sharedStudyGroupId, studyGroups]
  )

  const previewSummary = useMemo(() => {
    if (mathPreviewData) return summarizeMathImportPreview(mathPreviewData)
    if (!previewData) return null
    return summarizeImportPreview(previewData)
  }, [previewData, mathPreviewData])

  const resetPreviewState = () => {
    setParsingError(null)
    setPreviewData(null)
    setMathPreviewData(null)
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
    if (parsed.isMathFormat) {
      setMathPreviewData(parsed.data)
    } else {
      setPreviewData(parsed.data)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const isCsv = file.name.toLowerCase().endsWith(".csv")
    const reader = new FileReader()
    reader.onload = (loadEvent) => {
      const text = loadEvent.target?.result as string
      if (isCsv) {
        resetPreviewState()
        const parsed = parseCsvInput(text)
        if ("error" in parsed) {
          setParsingError(parsed.error)
        } else {
          setPreviewData(parsed.data)
        }
      } else {
        applyParsedInput(text)
      }
    }
    reader.readAsText(file)
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

  const handlePreview = () => {
    applyParsedInput(inputText)
  }

  const handleReset = () => {
    setInputText("")
    setPreviewData(null)
    setMathPreviewData(null)
    setParsingError(null)
    setResult(null)
  }

  const handleImport = async () => {
    const activeData = mathPreviewData ?? previewData
    if (!activeData) return
    if (visibility === "study_group" && !sharedStudyGroupId) {
      toast.error("請先選擇要分享的讀書房。")
      return
    }

    setIsImporting(true)
    try {
      const res = await importQuestions(activeData, {
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

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const previewUrl = URL.createObjectURL(file)
    setImagePreviewUrl(previewUrl)

    const reader = new FileReader()
    reader.onload = (e) => {
      setImageBase64(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleCopyBase64 = () => {
    if (!imageBase64) return
    navigator.clipboard.writeText(imageBase64)
    toast.success("已複製到剪貼簿！")
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>貼上或上傳題目 JSON</CardTitle>
          <CardDescription>
            單題、填充題、題組都可以放在同一個 JSON 陣列裡一起匯入。送出前會先做標準化、格式驗證與預覽。
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
              placeholder={`[\n  {\n    "subject": "數學",\n    "topic": "代數",\n    "question": "2 + 2 等於多少？",\n    "question_type": "multiple_choice",\n    "options": ["3", "4", "5", "6"],\n    "answer": 1\n  },\n  {\n    "subject": "國文",\n    "topic": "閱讀測驗",\n    "group_title": "第一題組",\n    "group_context": "閱讀下文，回答第 1–2 題...",\n    "questions": [\n      {\n        "question": "第一小題",\n        "options": ["A", "B", "C", "D"],\n        "answer": 0\n      }\n    ]\n  }\n]`}
              className="min-h-[220px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              spellCheck={false}
            />
          </div>

          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileJson className="h-4 w-4" />
              或上傳 JSON / CSV 檔案
            </div>
            <input
              type="file"
              accept=".json,.csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/20"
            />
            <p className="text-xs text-muted-foreground">
              CSV 目前仍以單題選擇題為主：<code>subject,topic,question,option_a,option_b,option_c,option_d,answer,explanation</code>，answer 填 A/B/C/D。
            </p>
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

      <Card>
        <CardHeader className="cursor-pointer select-none" onClick={() => setShowImageTool((v) => !v)}>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              圖片轉 base64 小工具
            </span>
            {showImageTool ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
          <CardDescription>將圖片轉成 base64 字串，複製後貼入 JSON 的 "image" 欄位即可。</CardDescription>
        </CardHeader>
        {showImageTool && (
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-dashed bg-muted/35 px-3 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">怎麼用這個工具</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>如果你的題目沒有圖片，這段可以直接跳過。</li>
                <li>如果題目有圖片，先在下面選一張圖片。</li>
                <li>系統會自動產生一段 base64 字串，按「複製」。</li>
                <li>把它貼進 JSON 裡的 <code>"image"</code> 欄位，例如：<code>"image": "data:image/png;base64,..."</code></li>
              </ol>
            </div>
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
                      <p className="text-sm text-muted-foreground">複製以下字串，貼入 JSON 的 <code className="rounded bg-muted px-1">"image"</code> 欄位：</p>
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
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="cursor-pointer select-none" onClick={() => setShowAiPrompt((v) => !v)}>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              AI 生成提示詞（數學題庫格式）
            </span>
            {showAiPrompt ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardTitle>
          <CardDescription>複製以下 Prompt，貼給 AI 後附上原始題目，即可自動轉換為數學題庫 JSON 格式。</CardDescription>
        </CardHeader>
        {showAiPrompt && (
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-dashed bg-muted/35 px-3 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">使用方式</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>按下「複製提示詞」。</li>
                <li>開啟你的 AI 工具（ChatGPT、Claude 等），貼上提示詞。</li>
                <li>在提示詞最後附上你想轉換的題目內容。</li>
                <li>AI 會回傳符合數學題庫格式的 JSON，複製後貼回左側匯入欄即可。</li>
              </ol>
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={handleCopyAiPrompt}>
                <Copy className="mr-1 h-3 w-3" />
                複製提示詞
              </Button>
            </div>
            <textarea
              readOnly
              value={MATH_AI_PROMPT}
              className="min-h-[260px] w-full rounded-md border bg-muted/50 px-3 py-2 text-xs font-mono"
            />
          </CardContent>
        )}
      </Card>

      {(previewData || mathPreviewData) && previewSummary ? (
        <Card>
          <CardHeader>
            <CardTitle>
              預覽 ({previewSummary.totalItems} 個項目)
              {mathPreviewData ? <span className="ml-2 text-sm font-normal text-sky-600 dark:text-sky-400">數學題庫格式</span> : null}
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

            <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              會優先用 external_id 判斷重複；沒有 external_id 時，才退回題目文字或題組情境做比對。
            </div>

            <div className="max-h-[420px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {mathPreviewData ? (
                      <>
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
                  {mathPreviewData ? mathPreviewData.slice(0, 10).map((item, idx) => (
                    <TableRow key={`math-${idx}`}>
                      <TableCell className="max-w-[100px] truncate text-muted-foreground">{item.external_id ?? "—"}</TableCell>
                      <TableCell>{item.subject}</TableCell>
                      <TableCell>{item.topic}</TableCell>
                      <TableCell className="max-w-[180px] truncate" title={item.question_text}>{item.question_text || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="max-w-[180px] truncate font-mono text-xs" title={item.question_latex}>{item.question_latex || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{item.answer + 1}</TableCell>
                      <TableCell>{item.group_id || <span className="text-muted-foreground">—</span>}</TableCell>
                    </TableRow>
                  )) : previewData ? previewData.slice(0, 10).map((item, idx) => {
                    const isGroup = isImportedQuestionGroup(item)
                    return (
                      <TableRow key={`${item.subject}-${idx}`}>
                        <TableCell>{isGroup ? "題組" : item.question_type === "fill_in_blank" ? "填充" : "單題"}</TableCell>
                        <TableCell>{item.subject}</TableCell>
                        <TableCell>{item.topic}</TableCell>
                        <TableCell className="max-w-[240px] truncate" title={isGroup ? item.group_context : item.question}>
                          {isGroup ? (item.group_title ?? item.group_context) : item.question}
                        </TableCell>
                        <TableCell>
                          {isGroup
                            ? `${item.questions.length} 題`
                            : item.question_type === "fill_in_blank"
                              ? item.text_answer
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
                  }) : null}
                  {(mathPreviewData ?? previewData ?? []).length > 10 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        ... 同時還有其他 {(mathPreviewData ?? previewData ?? []).length - 10} 個匯入項目
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
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-green-600 mt-0.5" />
              <div>
                <h3 className="font-bold text-green-800 dark:text-green-400">{result.message}</h3>
                <ul className="mt-2 space-y-1 text-sm text-green-700 dark:text-green-500">
                  <li>✅ 成功匯入單題：{result.validCount}</li>
                  <li>✅ 成功匯入題組：{result.groupCount ?? 0}</li>
                  <li>✅ 題組內成功匯入題目：{result.groupQuestionCount ?? 0}</li>
                  <li>⏩ 已跳過（重複）：{result.duplicateCount}</li>
                  <li>⏩ 已跳過（重複題組）：{result.duplicateGroupCount ?? 0}</li>
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
