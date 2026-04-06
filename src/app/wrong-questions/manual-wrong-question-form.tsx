"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"

import { createManualWrongQuestion } from "@/app/actions/wrong-questions"
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
import { cn } from "@/lib/utils"
import type { Subject } from "@/types"

const ERROR_REASON_OPTIONS = [
  { value: "不會", label: "不會" },
  { value: "粗心", label: "粗心" },
  { value: "計算錯", label: "計算錯" },
  { value: "觀念混淆", label: "觀念混淆" },
  { value: "題意看錯", label: "題意看錯" },
  { value: "猜對不熟", label: "猜對不熟" },
  { value: "其他", label: "其他" },
]

const TEXTAREA_CLASS = cn(
  "min-h-[80px] w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:opacity-50",
  "dark:bg-input/30"
)

export function ManualWrongQuestionForm({ subjects }: { subjects: Subject[] }) {
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()
  const [subjectId, setSubjectId] = useState<string>(subjects[0]?.id ?? "")
  const [errorReason, setErrorReason] = useState<string>("__none__")

  async function handleAction(formData: FormData) {
    const subject_id = formData.get("subject_id") as string
    const topic = (formData.get("topic") as string | null)?.trim() ?? ""
    const question_text = (formData.get("question_text") as string | null)?.trim() ?? ""
    const correct_answer_text = (formData.get("correct_answer_text") as string | null)?.trim() ?? ""
    const user_answer_text = (formData.get("user_answer_text") as string | null)?.trim() || undefined
    const notes = (formData.get("notes") as string | null)?.trim() || undefined
    const error_reason = errorReason === "__none__" ? undefined : errorReason

    if (!subject_id) { toast.error("請選擇科目。"); return }
    if (!topic) { toast.error("請填寫單元／主題。"); return }
    if (!question_text) { toast.error("請填寫題目內容。"); return }
    if (!correct_answer_text) { toast.error("請填寫正確答案。"); return }

    try {
      const result = await createManualWrongQuestion({
        subject_id,
        topic,
        question_text,
        correct_answer_text,
        user_answer_text,
        error_reason,
        notes,
      })

      if (!result.success) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      formRef.current?.reset()
      setSubjectId(subjects[0]?.id ?? "")
      setErrorReason("__none__")
      router.refresh()
    } catch {
      toast.error("加入失敗，請稍後再試。")
    }
  }

  return (
    <form ref={formRef} action={handleAction} className="space-y-4">
      {/* Row 1: 科目 + 錯誤原因 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>科目</Label>
          <Select
            name="subject_id"
            value={subjectId}
            onValueChange={(v) => setSubjectId(v ?? subjects[0]?.id ?? "")}
            required
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="選擇科目" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>錯誤原因</Label>
          <Select value={errorReason} onValueChange={(v) => setErrorReason(v ?? "__none__")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="選填" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">不填</SelectItem>
              {ERROR_REASON_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: 單元／主題 */}
      <div className="space-y-2">
        <Label htmlFor="topic">單元／主題 <span className="text-destructive">*</span></Label>
        <Input
          id="topic"
          name="topic"
          required
          placeholder="例如：三角函數、民法總則、熱力學第一定律"
        />
      </div>

      {/* Row 3: 題目內容 + 正確答案 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="question_text">題目內容 <span className="text-destructive">*</span></Label>
          <textarea
            id="question_text"
            name="question_text"
            required
            placeholder="貼上或輸入題目原文"
            className={TEXTAREA_CLASS}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="correct_answer_text">正確答案 <span className="text-destructive">*</span></Label>
          <textarea
            id="correct_answer_text"
            name="correct_answer_text"
            required
            placeholder="正確答案或解法"
            className={TEXTAREA_CLASS}
          />
        </div>
      </div>

      {/* Row 4: 我的答案 + 備註 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="user_answer_text">我的答案</Label>
          <Input
            id="user_answer_text"
            name="user_answer_text"
            placeholder="當時寫了什麼（選填）"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">備註</Label>
          <textarea
            id="notes"
            name="notes"
            placeholder="其他補充說明（選填）"
            className={cn(TEXTAREA_CLASS, "min-h-[36px]")}
          />
        </div>
      </div>

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "加入中..." : "加入錯題本"}
    </Button>
  )
}
