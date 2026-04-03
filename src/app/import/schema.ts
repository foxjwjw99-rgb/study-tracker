import { z } from "zod"

function optionalTrimmedString(message?: string) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value
    const trimmed = value.trim()
    return trimmed === "" ? undefined : trimmed
  }, message ? z.string().trim().min(1, message).optional() : z.string().trim().optional())
}

function requiredTrimmedString(message: string) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value
    return value.trim()
  }, z.string().trim().min(1, message))
}

function normalizedAnswerSchema() {
  return z.preprocess((value) => {
    if (typeof value === "string") {
      const trimmed = value.trim()
      if (/^-?\d+$/.test(trimmed)) {
        return Number.parseInt(trimmed, 10)
      }
    }
    return value
  }, z.number().int("答案索引必須是整數"))
}

const baseItemFields = {
  external_id: optionalTrimmedString(),
  subject: requiredTrimmedString("科目名稱不能為空"),
  topic: requiredTrimmedString("單元名稱不能為空"),
  explanation: optionalTrimmedString(),
  image: optionalTrimmedString(),
}

const baseQuestionFields = {
  ...baseItemFields,
  question: requiredTrimmedString("題目內容不能為空"),
}

const mcQuestionSchema = z
  .object({
    ...baseQuestionFields,
    question_type: z.literal("multiple_choice").optional(),
    options: z.array(requiredTrimmedString("選項不能為空")).min(2, "至少需要 2 個選項"),
    answer: normalizedAnswerSchema(),
  })
  .refine((data) => data.answer >= 0 && data.answer < data.options.length, {
    message: "答案索引必須落在 options 範圍內",
    path: ["answer"],
  })

const fibQuestionSchema = z.object({
  ...baseQuestionFields,
  question_type: z.literal("fill_in_blank"),
  options: z.array(requiredTrimmedString("選項不能為空")).optional().default([]),
  answer: normalizedAnswerSchema().optional().default(0),
  text_answer: requiredTrimmedString("填空題答案不能為空"),
})

export const questionSchema = z.union([fibQuestionSchema, mcQuestionSchema])

const groupQuestionMcSchema = z
  .object({
    external_id: optionalTrimmedString(),
    question: requiredTrimmedString("題目內容不能為空"),
    question_type: z.literal("multiple_choice").optional(),
    options: z.array(requiredTrimmedString("選項不能為空")).min(2, "至少需要 2 個選項"),
    answer: normalizedAnswerSchema(),
    explanation: optionalTrimmedString(),
    image: optionalTrimmedString(),
  })
  .refine((data) => data.answer >= 0 && data.answer < data.options.length, {
    message: "答案索引必須落在 options 範圍內",
    path: ["answer"],
  })

const groupQuestionFibSchema = z.object({
  external_id: optionalTrimmedString(),
  question: requiredTrimmedString("題目內容不能為空"),
  question_type: z.literal("fill_in_blank"),
  options: z.array(requiredTrimmedString("選項不能為空")).optional().default([]),
  answer: normalizedAnswerSchema().optional().default(0),
  text_answer: requiredTrimmedString("填空題答案不能為空"),
  explanation: optionalTrimmedString(),
  image: optionalTrimmedString(),
})

const groupQuestionSchema = z.union([groupQuestionFibSchema, groupQuestionMcSchema])

export const questionGroupSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw
  const value = raw as Record<string, unknown>
  return {
    ...value,
    group_title: value.group_title ?? value.title,
    group_context: value.group_context ?? value.context,
  }
}, z.object({
  external_id: optionalTrimmedString(),
  subject: requiredTrimmedString("科目名稱不能為空"),
  topic: requiredTrimmedString("單元名稱不能為空"),
  group_title: optionalTrimmedString(),
  group_context: requiredTrimmedString("題組情境段落不能為空"),
  questions: z.array(groupQuestionSchema).min(1, "題組至少需要 1 個題目"),
}))

export const importQuestionsSchema = z.array(questionSchema)
export const importQuestionGroupsSchema = z.array(questionGroupSchema)

export const importItemSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw
  const value = raw as Record<string, unknown>
  if (Array.isArray(value.questions) || value.group_context !== undefined || value.context !== undefined) {
    return {
      ...value,
      group_title: value.group_title ?? value.title,
      group_context: value.group_context ?? value.context,
    }
  }
  return raw
}, z.union([questionGroupSchema, questionSchema]))

export const importPayloadSchema = z.array(importItemSchema)

export type ImportedQuestion = z.infer<typeof questionSchema>
export type ImportedMCQuestion = z.infer<typeof mcQuestionSchema>
export type ImportedFIBQuestion = z.infer<typeof fibQuestionSchema>
export type ImportedGroupQuestion = z.infer<typeof groupQuestionSchema>
export type ImportedQuestionGroup = z.infer<typeof questionGroupSchema>
export type ImportedQuestionImportItem = z.infer<typeof importItemSchema>
export type ImportedQuestionImportPayload = z.infer<typeof importPayloadSchema>

export function isImportedQuestionGroup(item: ImportedQuestionImportItem): item is ImportedQuestionGroup {
  return "questions" in item
}
