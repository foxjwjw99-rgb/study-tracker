"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useFormStatus } from "react-dom"
import { CalendarIcon } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { updateExamDate } from "@/app/actions/subject"

const twDateFormatter = new Intl.DateTimeFormat("zh-TW-u-ca-gregory", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "long",
  day: "numeric",
})

export function ExamDateForm({ initialDate }: { initialDate: Date | null }) {
  const [date, setDate] = useState<Date | undefined>(initialDate || undefined)
  const router = useRouter()

  async function handleAction(formData: FormData) {
    if (!date) return
    try {
      await updateExamDate(date)
      toast.success("考試日期更新成功！")
      router.refresh()
    } catch (e) {
      toast.error("更新考試日期失敗。")
    }
  }

  return (
    <form action={handleAction} className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
      <Popover>
        <PopoverTrigger
          className={cn(
            "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2",
            "w-[240px] justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? twDateFormatter.format(date) : <span>選擇日期</span>}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "儲存中..." : "儲存"}
    </Button>
  )
}
