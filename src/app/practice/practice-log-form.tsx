"use client"

import { useRef, useState } from "react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { createPracticeLog } from "@/app/actions/practice-log"
import type { Subject } from "@/types"

export function PracticeLogForm({ subjects }: { subjects: Subject[] }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [date, setDate] = useState<Date>(new Date())

  async function handleAction(formData: FormData) {
    const subject_id = formData.get("subject_id") as string
    const topic = formData.get("topic") as string
    const source = formData.get("source") as string
    const total_questions = parseInt(formData.get("total_questions") as string, 10)
    const correct_questions = parseInt(formData.get("correct_questions") as string, 10)
    const duration_minutes = parseInt(formData.get("duration_minutes") as string, 10)
    const error_type = formData.get("error_type") as string
    const notes = formData.get("notes") as string

    if (!subject_id || !topic || isNaN(total_questions) || isNaN(correct_questions) || isNaN(duration_minutes)) {
      toast.error("請填寫所有必填欄位。")
      return
    }

    if (correct_questions > total_questions) {
      toast.error("正確題數不能超過總題數。")
      return
    }

    try {
      await createPracticeLog({
        subject_id,
        topic,
        source: source || undefined,
        practice_date: date,
        total_questions,
        correct_questions,
        duration_minutes,
        error_type: error_type || undefined,
        notes: notes || undefined,
      })
      toast.success("練習紀錄已儲存！")
      formRef.current?.reset()
    } catch (e) {
      toast.error("儲存練習紀錄失敗。")
    }
  }

  return (
    <form ref={formRef} action={handleAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date">日期</Label>
          <Popover>
            <PopoverTrigger
              className={cn(
                "inline-flex items-center justify-start rounded-md text-sm font-normal transition-colors border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 w-full",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(date, "PPP")}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject_id">科目</Label>
          <Select name="subject_id" required>
            <SelectTrigger>
              <SelectValue placeholder="選擇科目">
                {(value: string | null) =>
                  value ? (subjects.find((s) => s.id === value)?.name ?? null) : null
                }
              </SelectValue>
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
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="topic">單元 / 主題</Label>
          <Input id="topic" name="topic" required placeholder="例如：第三章 幾何圖形" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="source">來源 (選填)</Label>
          <Input id="source" name="source" placeholder="例如：課本第 45 頁" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="total_questions">總題數</Label>
          <Input id="total_questions" name="total_questions" type="number" required min="1" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="correct_questions">正確題數</Label>
          <Input id="correct_questions" name="correct_questions" type="number" required min="0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="duration_minutes">時長 (分鐘)</Label>
          <Input id="duration_minutes" name="duration_minutes" type="number" required min="1" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="error_type">主要錯誤類型</Label>
          <Select name="error_type">
            <SelectTrigger>
              <SelectValue placeholder="選填" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="不會">不會</SelectItem>
              <SelectItem value="粗心">粗心</SelectItem>
              <SelectItem value="計算錯">計算錯</SelectItem>
              <SelectItem value="觀念混淆">觀念混淆</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">備註</Label>
          <Input id="notes" name="notes" placeholder="有什麼心得嗎？" />
        </div>
      </div>

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "儲存中..." : "儲存練習紀錄"}
    </Button>
  )
}
