"use client"

import { useRef } from "react"
import { useRouter } from "next/navigation"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createSubject } from "@/app/actions/subject"

export function SubjectForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  async function handleAction(formData: FormData) {
    const name = formData.get("name") as string
    const scoreRaw = formData.get("target_score") as string
    const target_score = scoreRaw ? parseInt(scoreRaw, 10) : null

    if (!name.trim()) {
      toast.error("科目名稱是必填的。")
      return
    }

    try {
      await createSubject({ name, target_score })
      toast.success("科目已新增！")
      formRef.current?.reset()
      router.refresh()
    } catch (e) {
      toast.error("新增科目失敗。")
    }
  }

  return (
    <form ref={formRef} action={handleAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">科目名稱</Label>
          <Input id="name" name="name" placeholder="例如：數學、歷史" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="target_score">目標分數 (選填)</Label>
          <Input id="target_score" name="target_score" type="number" placeholder="例如：100" />
        </div>
      </div>
      <div>
        <SubmitButton />
      </div>
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "新增中..." : "新增科目"}
    </Button>
  )
}
