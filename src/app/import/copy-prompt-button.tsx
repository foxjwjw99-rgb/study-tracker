"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"

import { Button } from "@/components/ui/button"

const AI_PROMPT = `請幫我依照以下規格產出題目，並且只輸出原始 JSON 陣列：
- 不要加任何說明文字
- 不要加 markdown code fence
- answer 一律用 0-based index
- 可以混合單題、填充題、題組

單題格式：
{
  "subject": "科目名稱",
  "topic": "單元名稱",
  "question": "題目內容",
  "question_type": "multiple_choice" | "fill_in_blank",
  "options": ["選項A", "選項B", "選項C", "選項D"],
  "answer": 0,
  "text_answer": "填空題答案（可用 | 分隔多個接受答案）",
  "explanation": "解析（選填）",
  "external_id": "穩定唯一 ID（選填）"
}

題組格式：
{
  "subject": "科目名稱",
  "topic": "單元名稱",
  "group_title": "題組標題（選填）",
  "group_context": "共用題幹 / 閱讀段落",
  "table": {
    "headers": ["欄位1", "欄位2", "欄位3"],
    "rows": [["資料A1", "資料A2", "資料A3"], ["資料B1", "資料B2", "資料B3"]]
  },
  "external_id": "題組唯一 ID（選填）",
  "questions": [
    {
      "question": "子題內容",
      "question_type": "multiple_choice" | "fill_in_blank",
      "options": ["選項A", "選項B", "選項C", "選項D"],
      "answer": 0,
      "text_answer": "填空題答案",
      "explanation": "解析（選填）",
      "external_id": "子題唯一 ID（選填）",
      "table": { "headers": [...], "rows": [[...]] }
    }
  ]
}

- table 欄位選填，題組用 table 顯示共用資料表，單題或子題也可以各自加 table
- table 格式：headers 為欄位名稱陣列，rows 為每列資料的二維陣列（全部字串）

請幫我出一份可直接匯入 study-tracker 的 JSON 陣列，主題是：[請填入科目] 的 [請填入單元]。`

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
