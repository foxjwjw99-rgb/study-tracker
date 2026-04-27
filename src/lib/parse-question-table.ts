import type { ImportedQuestionGroup } from "@/app/import/schema"

type TableRow = {
  subject: string
  topic: string
  group_title?: string
  group_context: string
  question: string
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
  answer: string
  explanation?: string
}

export const ANSWER_MAP: Record<string, number> = {
  a: 0, b: 1, c: 2, d: 3,
  "1": 0, "2": 1, "3": 2, "4": 3,
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "_")
}

function parseRows(rows: Record<string, string>[]): ImportedQuestionGroup[] {
  const groupMap = new Map<string, ImportedQuestionGroup>()

  for (const row of rows) {
    const subject = row["subject"]?.trim()
    const topic = row["topic"]?.trim()
    const groupContext = row["group_context"]?.trim()
    const question = row["question"]?.trim()
    const answerRaw = row["answer"]?.trim().toLowerCase()

    if (!subject || !topic || !groupContext || !question || !answerRaw) continue

    const groupKey = `${subject}||${topic}||${groupContext}`
    const optionA = row["option_a"]?.trim() ?? ""
    const optionB = row["option_b"]?.trim() ?? ""
    const optionC = row["option_c"]?.trim() ?? ""
    const optionD = row["option_d"]?.trim() ?? ""
    const options = [optionA, optionB, optionC, optionD].filter(Boolean)

    const explanation = row["explanation"]?.trim() || undefined
    const groupTitle = row["group_title"]?.trim() || undefined

    let parsedQuestion: ImportedQuestionGroup["questions"][number]

    if (options.length >= 2) {
      const answerIdx = ANSWER_MAP[answerRaw]
      if (answerIdx === undefined) continue
      parsedQuestion = {
        question,
        question_type: "multiple_choice" as const,
        options,
        answer: answerIdx,
        explanation,
      }
    } else {
      // fill_in_blank
      parsedQuestion = {
        question,
        question_type: "fill_in_blank" as const,
        text_answer: answerRaw,
        options: [],
        answer: 0,
        explanation,
      }
    }

    const existing = groupMap.get(groupKey)
    if (existing) {
      existing.questions.push(parsedQuestion)
    } else {
      groupMap.set(groupKey, {
        subject,
        topic,
        group_title: groupTitle,
        group_context: groupContext,
        questions: [parsedQuestion],
      })
    }
  }

  return Array.from(groupMap.values())
}

export function parseCsvToQuestionGroups(csvText: string): ImportedQuestionGroup[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(",").map(normalizeHeader)

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i])
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? ""
    }
    rows.push(row)
  }

  return parseRows(rows)
}

export async function parseXlsxToQuestionGroups(buffer: ArrayBuffer): Promise<ImportedQuestionGroup[]> {
  const XLSX = await import("xlsx")
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const sheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })

  const rows: Record<string, string>[] = rawRows.map((raw) => {
    const normalized: Record<string, string> = {}
    for (const [key, value] of Object.entries(raw)) {
      normalized[normalizeHeader(String(key))] = String(value ?? "")
    }
    return normalized
  })

  return parseRows(rows)
}

// Simple CSV line splitter that handles quoted fields
function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}
