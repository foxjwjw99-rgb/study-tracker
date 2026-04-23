import { z } from "zod"

export const tableDataSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
}).optional()

export type TableData = NonNullable<z.infer<typeof tableDataSchema>>

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

// ─── Metadata helpers ────────────────────────────────────────────────────────

const difficultySchema = z.enum(["easy", "medium", "hard"]).optional()

const tagsSchema = z.array(z.string().trim().min(1)).optional()

const statusSchema = z.enum(["draft", "published", "deprecated"]).optional()

const sourceSchema = z.object({
  exam:   z.string().optional(),
  year:   z.number().int().optional(),
  number: z.number().int().optional(),
}).optional()

export const blankItemSchema = z.object({
  label:        z.string().optional(),
  answer:       requiredTrimmedString("空白答案不能為空"),
  alternatives: z.array(z.string()).optional().default([]),
})

export type BlankItem = z.infer<typeof blankItemSchema>

const blanksSchema = z.array(blankItemSchema).min(1).optional()

// ─── Shared field groups ─────────────────────────────────────────────────────

const baseItemFields = {
  external_id: optionalTrimmedString(),
  subject: requiredTrimmedString("科目名稱不能為空"),
  topic: requiredTrimmedString("單元名稱不能為空"),
  explanation: optionalTrimmedString(),
  image: optionalTrimmedString(),
  table: tableDataSchema,
  difficulty: difficultySchema,
  tags:       tagsSchema,
  status:     statusSchema,
}

const baseQuestionFields = {
  ...baseItemFields,
  question: requiredTrimmedString("題目內容不能為空"),
  source: sourceSchema,
  hint:   optionalTrimmedString(),
}

// ─── Top-level question schemas ───────────────────────────────────────────────

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

const fibQuestionSchema = z
  .object({
    ...baseQuestionFields,
    question_type: z.literal("fill_in_blank"),
    options: z.array(requiredTrimmedString("選項不能為空")).optional().default([]),
    answer:      normalizedAnswerSchema().optional().default(0),
    text_answer: optionalTrimmedString(),
    blanks:      blanksSchema,
  })
  .superRefine((data, ctx) => {
    const hasTextAnswer = Boolean(data.text_answer)
    const hasBlanks     = Array.isArray(data.blanks) && data.blanks.length > 0
    if (!hasTextAnswer && !hasBlanks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "填空題需要提供 text_answer 或 blanks[]",
        path: ["text_answer"],
      })
    }
  })

export const questionSchema = z.union([fibQuestionSchema, mcQuestionSchema])

// ─── Group child schemas ──────────────────────────────────────────────────────

const groupQuestionMcSchema = z
  .object({
    external_id:   optionalTrimmedString(),
    question:      requiredTrimmedString("題目內容不能為空"),
    question_type: z.literal("multiple_choice").optional(),
    options:       z.array(requiredTrimmedString("選項不能為空")).min(2, "至少需要 2 個選項"),
    answer:        normalizedAnswerSchema(),
    explanation:   optionalTrimmedString(),
    image:         optionalTrimmedString(),
    table:         tableDataSchema,
    difficulty:    difficultySchema,
    tags:          tagsSchema,
    hint:          optionalTrimmedString(),
  })
  .refine((data) => data.answer >= 0 && data.answer < data.options.length, {
    message: "答案索引必須落在 options 範圍內",
    path: ["answer"],
  })

const groupQuestionFibSchema = z
  .object({
    external_id:   optionalTrimmedString(),
    question:      requiredTrimmedString("題目內容不能為空"),
    question_type: z.literal("fill_in_blank"),
    options:       z.array(requiredTrimmedString("選項不能為空")).optional().default([]),
    answer:        normalizedAnswerSchema().optional().default(0),
    text_answer:   optionalTrimmedString(),
    blanks:        blanksSchema,
    explanation:   optionalTrimmedString(),
    image:         optionalTrimmedString(),
    table:         tableDataSchema,
    difficulty:    difficultySchema,
    tags:          tagsSchema,
    hint:          optionalTrimmedString(),
  })
  .superRefine((data, ctx) => {
    const hasTextAnswer = Boolean(data.text_answer)
    const hasBlanks     = Array.isArray(data.blanks) && data.blanks.length > 0
    if (!hasTextAnswer && !hasBlanks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "填空題需要提供 text_answer 或 blanks[]",
        path: ["text_answer"],
      })
    }
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
  external_id:   optionalTrimmedString(),
  subject:       requiredTrimmedString("科目名稱不能為空"),
  topic:         requiredTrimmedString("單元名稱不能為空"),
  group_title:   optionalTrimmedString(),
  group_context: requiredTrimmedString("題組情境段落不能為空"),
  table:         tableDataSchema,
  difficulty:    difficultySchema,
  tags:          tagsSchema,
  status:        statusSchema,
  questions:     z.array(groupQuestionSchema).min(1, "題組至少需要 1 個題目"),
}))

export const importQuestionsSchema = z.array(questionSchema)
export const importQuestionGroupsSchema = z.array(questionGroupSchema)

// ─── 數學題庫 JSON 規格書 v1.0 ───────────────────────────────────────────────

function optionalRichString() {
  return z.string().default("")
}

export const mathMcQuestionSchema = z.object({
  external_id: optionalTrimmedString(),
  subject: requiredTrimmedString("科目名稱不能為空"),
  topic: requiredTrimmedString("單元名稱不能為空"),
  group_id: optionalRichString(),
  group_title: optionalRichString(),
  group_text: optionalRichString(),
  group_latex: optionalRichString(),
  group_image_url: optionalRichString(),
  question_text: optionalRichString(),
  question_latex: optionalRichString(),
  question_image_url: optionalRichString(),
  option_1_text: optionalRichString(),
  option_1_latex: optionalRichString(),
  option_1_image_url: optionalRichString(),
  option_2_text: optionalRichString(),
  option_2_latex: optionalRichString(),
  option_2_image_url: optionalRichString(),
  option_3_text: optionalRichString(),
  option_3_latex: optionalRichString(),
  option_3_image_url: optionalRichString(),
  option_4_text: optionalRichString(),
  option_4_latex: optionalRichString(),
  option_4_image_url: optionalRichString(),
  answer: normalizedAnswerSchema(),
  explanation_text: optionalRichString(),
  explanation_latex: optionalRichString(),
  explanation_image_url: optionalRichString(),
}).refine(
  (d) => !!(d.question_text || d.question_latex || d.question_image_url),
  { message: "題目至少需要 question_text、question_latex、question_image_url 其中一個", path: ["question_text"] }
).refine(
  (d) => d.answer >= 0 && d.answer <= 3,
  { message: "answer 必須為 0~3（對應 option_1~option_4）", path: ["answer"] }
)

export const mathImportPayloadSchema = z.array(mathMcQuestionSchema)

export type MathMcQuestion = z.infer<typeof mathMcQuestionSchema>

/** 偵測是否為數學題庫 JSON 規格書 v1.0 格式 */
export function isMathSpecFormat(item: unknown): boolean {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false
  const keys = Object.keys(item as Record<string, unknown>)
  return keys.includes("question_text") || keys.includes("question_latex") || keys.includes("option_1_text")
}

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

// ─── blanks[] → text_answer derivation ──────────────────────────────────────

/** Convert structured blanks array to pipe-separated text_answer for backward compat.
 *  Single blank: "answer|alt1|alt2"
 *  Multi-blank:  "blank1_ans|blank2_ans" (first answer of each blank joined by |) */
export function blanksToDerivedTextAnswer(blanks: BlankItem[]): string {
  if (blanks.length === 1) {
    const b = blanks[0]!
    return [b.answer, ...(b.alternatives ?? [])].join("|")
  }
  return blanks.map((b) => b.answer).join("|")
}
