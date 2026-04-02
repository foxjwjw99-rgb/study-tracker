"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { upsertExamUnits, type ExamUnitSubjectEntry } from "@/app/actions/subject"

const examScopeItemSchema = z.object({
  subject: z.string().trim().min(1, "科目名稱不能為空"),
  units: z.array(z.string().trim().min(1, "單元名稱不能為空")).min(1, "至少要有一個單元"),
})

const examScopeSchema = z.array(examScopeItemSchema).min(1)

type ParsedEntry = { subject: string; units: string[] }

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      if (typeof issue.path[0] === "number") {
        return `第 ${issue.path[0] + 1} 項，${issue.path.slice(1).join(".") || "資料"}：${issue.message}`
      }
      return `${issue.path.join(".") || "資料"}：${issue.message}`
    })
    .join("\n")
}

function parseInput(raw: string): ParsedEntry[] | { error: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { error: "請先貼上 JSON。" }
  try {
    const json = JSON.parse(trimmed)
    const result = examScopeSchema.safeParse(json)
    if (!result.success) return { error: `JSON 格式不符。\n${formatZodError(result.error)}` }
    return result.data
  } catch {
    return { error: "解析失敗，請確認內容是有效的 JSON 陣列。" }
  }
}

const EXAMPLE_JSON = `[
  { "subject": "數學", "units": ["第一章 函數", "第二章 極限", "第三章 微分"] },
  { "subject": "英文", "units": ["Grammar", "Reading Comprehension", "Vocabulary"] }
]`

type Props = {
  initialData: ExamUnitSubjectEntry[]
}

export function ExamScopeForm({ initialData }: Props) {
  const router = useRouter()
  const [text, setText] = useState("")
  const [preview, setPreview] = useState<ParsedEntry[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handlePreview = () => {
    setPreview(null)
    setParseError(null)
    const result = parseInput(text)
    if ("error" in result) {
      setParseError(result.error)
    } else {
      setPreview(result)
    }
  }

  const handleSave = async () => {
    if (!preview) return
    setIsSaving(true)
    try {
      const result = await upsertExamUnits(
        preview.map((e) => ({ subjectName: e.subject, units: e.units }))
      )
      if (result.success) {
        toast.success(result.message)
        setText("")
        setPreview(null)
        router.refresh()
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error("儲存失敗，請稍後再試。")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {initialData.some((s) => s.units.length > 0) && (
        <div className="space-y-3">
          <p className="text-sm font-medium">目前設定</p>
          <div className="rounded-md border divide-y">
            {initialData
              .filter((s) => s.units.length > 0)
              .map((s) => (
                <div key={s.subjectId} className="px-4 py-3">
                  <div className="font-medium text-sm">{s.subjectName}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.units.map((u) => (
                      <span
                        key={u.id}
                        className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {u.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="exam-scope-json">貼上 JSON</Label>
        <textarea
          id="exam-scope-json"
          placeholder={EXAMPLE_JSON}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm min-h-[160px] resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setPreview(null)
            setParseError(null)
          }}
        />
        <p className="text-xs text-muted-foreground">
          格式：<code className="text-xs">{`[{ "subject": "科目名稱", "units": ["單元一", "單元二"] }]`}</code>
          。貼上後會取代該科目原有的所有單元。
        </p>
      </div>

      {parseError && (
        <pre className="rounded-md bg-destructive/10 p-3 text-xs text-destructive whitespace-pre-wrap">
          {parseError}
        </pre>
      )}

      {preview && (
        <div className="space-y-2">
          <p className="text-sm font-medium">預覽（共 {preview.length} 個科目）</p>
          <div className="rounded-md border divide-y">
            {preview.map((entry) => (
              <div key={entry.subject} className="px-4 py-3">
                <div className="font-medium text-sm">{entry.subject}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {entry.units.map((u, i) => (
                    <span
                      key={i}
                      className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {u}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {!preview ? (
          <Button type="button" variant="outline" onClick={handlePreview} disabled={!text.trim()}>
            驗證與預覽
          </Button>
        ) : (
          <>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "儲存中..." : "確認儲存"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPreview(null)
                setParseError(null)
              }}
            >
              重新編輯
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
