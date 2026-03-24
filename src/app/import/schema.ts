import { z } from "zod"

export const questionSchema = z.object({
  external_id: z.string().optional(),
  subject: z.string().trim().min(1, "科目名稱不能為空"),
  topic: z.string().trim().min(1, "單元名稱不能為空"),
  question: z.string().trim().min(1, "題目內容不能為空"),
  options: z.array(z.string().trim().min(1, "選項不能為空")).min(2, "至少需要 2 個選項"),
  answer: z.number().int("答案索引必須是整數"),
  explanation: z.string().trim().optional(),
  image: z.string().optional(),
}).refine((data) => data.answer >= 0 && data.answer < data.options.length, {
  message: "答案索引必須落在 options 範圍內",
  path: ["answer"]
})

export const importQuestionsSchema = z.array(questionSchema)

export type ImportedQuestion = z.infer<typeof questionSchema>
