"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useFormStatus } from "react-dom"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

import { createManualReviewTask } from "@/app/actions/review"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Subject } from "@/types"

const REVIEW_STAGE_OPTIONS = [1, 3, 7, 14] as const

export function ManualReviewTaskForm({ subjects }: { subjects: Subject[] }) {
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()
  const [date, setDate] = useState<Date>(new Date())
  const [subjectId, setSubjectId] = useState<string>(subjects[0]?.id ?? "")
  const [reviewStage, setReviewStage] = useState<string>("1")
  const selectedSubject = subjects.find((subject) => subject.id === subjectId) ?? null

  async function handleAction(formData: FormData) {
    const subjectId = formData.get("subject_id") as string
    const topic = formData.get("topic") as string
    const parsedStage = Number.parseInt(reviewStage, 10)

    if (!subjectId || !topic.trim() || Number.isNaN(parsedStage)) {
      toast.error("請填寫所有必填欄位。")
      return
    }

    try {
      const result = await createManualReviewTask({
        subject_id: subjectId,
        topic,
        review_date: date,
        review_stage: parsedStage,
      })

      if (!result.success) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      formRef.current?.reset()
      setDate(new Date())
      setSubjectId(subjects[0]?.id ?? "")
      setReviewStage("1")
      router.refresh()
    } catch {
      toast.error("新增複習任務失敗。")
    }
  }

  return (
    <form ref={formRef} action={handleAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="subject_id">科目</Label>
          <Select
            name="subject_id"
            value={subjectId}
            onValueChange={(value) => setSubjectId(value ?? "")}
            required
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {selectedSubject?.name ?? "選擇科目"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {subjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="review_stage">複習階段</Label>
          <Select value={reviewStage} onValueChange={(value) => setReviewStage(value ?? "1")}>
            <SelectTrigger className="w-full">
              <SelectValue>第 {reviewStage} 天</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {REVIEW_STAGE_OPTIONS.map((stage) => (
                <SelectItem key={stage} value={stage.toString()}>
                  第 {stage} 天
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-2">
          <Label htmlFor="topic">任務主題</Label>
          <Input
            id="topic"
            name="topic"
            required
            placeholder="例如：微積分極限定義、民法總則整理"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="review_date">預定日期</Label>
          <Popover>
            <PopoverTrigger
              className={cn(
                "inline-flex h-9 w-full items-center justify-start rounded-md border border-input bg-transparent px-4 py-2 text-left text-sm font-normal shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(date, "yyyy年M月d日")}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={(nextDate) => nextDate && setDate(nextDate)} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
      {pending ? "新增中..." : "新增複習任務"}
    </Button>
  )
}
