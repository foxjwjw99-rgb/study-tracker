"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

const AI_PROMPT = `請幫我依照以下 JSON 格式出題，直接輸出 JSON 陣列，不要加任何說明文字：

[
  {
    "subject": "科目名稱",
    "topic": "單元名稱",
    "question": "題目內容",
    "options": ["選項A", "選項B", "選項C", "選項D"],
    "answer": 0,
    "explanation": "解析（選填）"
  }
]

注意事項：
- subject 填你想出的科目（例如：數學、經濟學）
- topic 填單元名稱（例如：微分、需求供給）
- answer 是正確選項的索引，從 0 開始（0=A, 1=B, 2=C, 3=D）
- 請幫我出 10 道選擇題，涵蓋 [請填入科目] 的 [請填入單元] 主題`

export function CopyPromptButton() {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(AI_PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
      {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
      {copied ? "已複製！" : "複製 AI 生題 Prompt"}
    </Button>
  )
}
