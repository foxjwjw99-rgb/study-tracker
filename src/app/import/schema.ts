import { z } from "zod"

const commonFields = {
  external_id: z.string().optional(),
  subject: z.string().trim().min(1, "科目名稱不能為空"),
  topic: z.string().trim().min(1, "單元名稱不能為空"),
  question: z.string().trim().min(1, "題目內容不能為空"),
  explanation: z.string().trim().optional(),
  image: z.string().optional(),
}

const mcQuestionSchema = z.object({
  ...commonFields,
  question_type: z.literal("multiple_choice").optional(),
  options: z.array(z.string().trim().min(1, "選項不能為空")).min(2, "至少需要 2 個選項"),
  answer: z.number().int("答案索引必須是整數"),
}).refine((data) => data.answer >= 0 && data.answer < data.options.length, {
  message: "答案索引必須落在 options 範圍內",
  path: ["answer"],
})

const fibQuestionSchema = z.object({
  ...commonFields,
  question_type: z.literal("fill_in_blank"),
  text_answer: z.string().trim().min(1, "填空題答案不能為空"),
})

export const questionSchema = z.union([fibQuestionSchema, mcQuestionSchema])

export const importQuestionsSchema = z.array(questionSchema)

export type ImportedQuestion = z.infer<typeof questionSchema>
export type ImportedMCQuestion = z.infer<typeof mcQuestionSchema>
export type ImportedFIBQuestion = z.infer<typeof fibQuestionSchema>
