import { z } from "zod"

import {
  importPayloadSchema,
  mathImportPayloadSchema,
  isMathSpecFormat,
  isImportedQuestionGroup,
  type ImportedQuestion,
  type ImportedQuestionImportItem,
  type MathMcQuestion,
} from "./schema"

export type ParseImportSuccess = {
  data: ImportedQuestionImportItem[]
  rawText: string
  isMathFormat?: false
}

export type ParseMathImportSuccess = {
  data: MathMcQuestion[]
  rawText: string
  isMathFormat: true
}

export type ParseImportFailure = {
  error: string
}

export type ImportPreviewSummary = {
  totalItems: number
  singleQuestionCount: number
  groupCount: number
  nestedGroupQuestionCount: number
  subjectCount: number
  duplicateSuspectCount: number
}

function stripMarkdownCodeFence(raw: string) {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1].trim() : trimmed
}

function normalizeImportPayload(value: unknown): unknown {
  if (!Array.isArray(value)) return value

  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item

    const normalized = { ...(item as Record<string, unknown>) }

    if (normalized.group_title === undefined && normalized.title !== undefined) {
      normalized.group_title = normalized.title
    }

    if (normalized.group_context === undefined && normalized.context !== undefined) {
      normalized.group_context = normalized.context
    }

    if (Array.isArray(normalized.questions)) {
      normalized.questions = normalized.questions.map((question) => normalizeQuestionLike(question))
    }

    return normalizeQuestionLike(normalized)
  })
}

function normalizeQuestionLike(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value

  const normalized = { ...(value as Record<string, unknown>) }

  for (const key of [
    "external_id",
    "subject",
    "topic",
    "question",
    "text_answer",
    "explanation",
    "image",
    "group_title",
    "group_context",
    "title",
    "context",
  ]) {
    const current = normalized[key]
    if (typeof current === "string") {
      const trimmed = current.trim()
      normalized[key] = trimmed === "" ? undefined : trimmed
    }
  }

  if (typeof normalized.answer === "string") {
    const trimmed = normalized.answer.trim()
    if (/^-?\d+$/.test(trimmed)) {
      normalized.answer = Number.parseInt(trimmed, 10)
    }
  }

  // Normalize short_answer → fill_in_blank (both use text_answer field)
  if (normalized.question_type === "short_answer") {
    normalized.question_type = "fill_in_blank"
  }

  return normalized
}

export function formatImportIssues(error: z.ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path
      if (typeof path[0] === "number") {
        const itemIndex = path[0] + 1
        if (path[1] === "questions" && typeof path[2] === "number") {
          return `第 ${itemIndex} 個項目的第 ${path[2] + 1} 題：${issue.message}`
        }
        return `第 ${itemIndex} 個項目，${path.slice(1).join(".") || "資料"}：${issue.message}`
      }
      return `${path.join(".") || "資料"}：${issue.message}`
    })
    .join("\n")
}

export function parseImportInput(rawText: string): ParseImportSuccess | ParseMathImportSuccess | ParseImportFailure {
  const stripped = stripMarkdownCodeFence(rawText)

  if (!stripped) {
    return { error: "請先貼上 JSON，或選擇一個 .json 檔案。" }
  }

  try {
    const json = JSON.parse(stripped)
    if (!Array.isArray(json)) {
      return { error: "匯入內容最外層必須是 JSON 陣列。" }
    }

    // Detect math spec v1.0 format
    if (json.length > 0 && isMathSpecFormat(json[0])) {
      const parsed = mathImportPayloadSchema.safeParse(json)
      if (!parsed.success) {
        return {
          error: `數學題庫格式不符。\n${formatImportIssues(parsed.error)}`,
        }
      }
      return { data: parsed.data, rawText: stripped, isMathFormat: true }
    }

    const normalized = normalizeImportPayload(json)
    const parsed = importPayloadSchema.safeParse(normalized)

    if (!parsed.success) {
      return {
        error: `JSON 格式不符。\n${formatImportIssues(parsed.error)}`,
      }
    }

    return {
      data: parsed.data,
      rawText: stripped,
    }
  } catch {
    return { error: "解析失敗。請確認內容是有效的 JSON 陣列。" }
  }
}

export function summarizeMathImportPreview(items: MathMcQuestion[]): ImportPreviewSummary {
  const subjects = new Set(items.map((q) => q.subject))
  const groupIds = new Set(items.filter((q) => q.group_id).map((q) => q.group_id))
  const standaloneCount = items.filter((q) => !q.group_id).length
  const seenExternalIds = new Set<string>()
  let duplicateSuspectCount = 0

  for (const q of items) {
    if (q.external_id) {
      const key = `${q.subject}::${q.external_id}`
      if (seenExternalIds.has(key)) duplicateSuspectCount += 1
      else seenExternalIds.add(key)
    }
  }

  return {
    totalItems: items.length,
    singleQuestionCount: standaloneCount,
    groupCount: groupIds.size,
    nestedGroupQuestionCount: items.length - standaloneCount,
    subjectCount: subjects.size,
    duplicateSuspectCount,
  }
}

export function summarizeImportPreview(items: ImportedQuestionImportItem[]): ImportPreviewSummary {
  const subjects = new Set(items.map((item) => item.subject))
  const seenKeys = new Set<string>()
  let duplicateSuspectCount = 0
  let singleQuestionCount = 0
  let groupCount = 0
  let nestedGroupQuestionCount = 0

  for (const item of items) {
    if (isImportedQuestionGroup(item)) {
      groupCount += 1
      nestedGroupQuestionCount += item.questions.length

      const key = item.external_id
        ? `group:external:${item.subject}::${item.external_id}`
        : `group:text:${item.subject}::${item.group_context}`

      if (seenKeys.has(key)) duplicateSuspectCount += 1
      else seenKeys.add(key)

      for (const child of item.questions) {
        const childKey = child.external_id && item.external_id
          ? `group-question:external:${item.subject}::${item.external_id}::${child.external_id}`
          : `group-question:text:${item.subject}::${item.group_context}::${child.question}`
        if (seenKeys.has(childKey)) duplicateSuspectCount += 1
        else seenKeys.add(childKey)
      }
    } else {
      // Zod v4 preprocess+union inference narrows else branch to never; cast explicitly
      const q = item as ImportedQuestion
      singleQuestionCount += 1
      const key = q.external_id
        ? `single:external:${q.subject}::${q.external_id}`
        : `single:text:${q.subject}::${q.question}`
      if (seenKeys.has(key)) duplicateSuspectCount += 1
      else seenKeys.add(key)
    }
  }

  return {
    totalItems: items.length,
    singleQuestionCount,
    groupCount,
    nestedGroupQuestionCount,
    subjectCount: subjects.size,
    duplicateSuspectCount,
  }
}
