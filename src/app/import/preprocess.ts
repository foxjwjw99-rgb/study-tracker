import {
  parseImportInput,
  type ParseImportSuccess,
  type ParseImportFailure,
  type ParseMathImportSuccess,
} from "./parser"
import type { ImportedQuestionImportItem } from "./schema"
import { parseCsvToQuestionGroups, parseXlsxToQuestionGroups } from "@/lib/parse-question-table"

export type PreprocessResult = ParseImportSuccess | ParseMathImportSuccess | ParseImportFailure

// ─── CSV single-question path (migrated from import-client.tsx) ───────────────

function parseCsvRow(row: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseSingleQuestionCsv(rawText: string): ParseImportSuccess | ParseImportFailure {
  const lines = rawText.trim().split(/\r?\n/)
  if (lines.length < 2) return { error: "CSV 至少需要標題行與一筆資料。" }

  const headers = parseCsvRow(lines[0]).map((h) => h.trim().toLowerCase())
  const required = ["subject", "topic", "question", "option_a", "option_b", "answer"]
  const missing = required.filter((h) => !headers.includes(h))
  if (missing.length > 0) return { error: `CSV 缺少必要欄位：${missing.join(", ")}` }

  const idx = (name: string) => headers.indexOf(name)
  const questions: ImportedQuestionImportItem[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = parseCsvRow(line)
    const get = (name: string) => (cols[idx(name)] ?? "").trim()

    const options: string[] = []
    const optA = get("option_a"); if (optA) options.push(optA)
    const optB = get("option_b"); if (optB) options.push(optB)
    const optC = get("option_c"); if (optC) options.push(optC)
    const optD = get("option_d"); if (optD) options.push(optD)

    const rawAnswer = get("answer").toUpperCase()
    let answerIdx: number
    if (rawAnswer === "A") answerIdx = 0
    else if (rawAnswer === "B") answerIdx = 1
    else if (rawAnswer === "C") answerIdx = 2
    else if (rawAnswer === "D") answerIdx = 3
    else {
      const n = parseInt(rawAnswer, 10)
      if (isNaN(n)) return { error: `第 ${i} 行的 answer 格式不正確（應為 A/B/C/D 或 0/1/2/3）。` }
      answerIdx = n
    }

    if (answerIdx >= options.length) {
      return { error: `第 ${i} 行的 answer 超出選項範圍。` }
    }

    questions.push({
      subject: get("subject"),
      topic: get("topic"),
      question: get("question"),
      question_type: "multiple_choice",
      options,
      answer: answerIdx,
      explanation: get("explanation") || undefined,
    })
  }

  if (questions.length === 0) return { error: "CSV 沒有有效的題目資料。" }
  return { data: questions, rawText }
}

// ─── Unified entry point ──────────────────────────────────────────────────────

function hasGroupHeader(csvText: string): boolean {
  const firstLine = csvText.split(/\r?\n/, 1)[0] ?? ""
  const headers = firstLine.split(",").map((h) => h.trim().toLowerCase())
  return headers.includes("group_context")
}

async function readFileAsText(file: File): Promise<string> {
  return await file.text()
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer()
}

export async function preprocessImportText(text: string): Promise<PreprocessResult> {
  return parseImportInput(text)
}

export async function preprocessImportFile(file: File): Promise<PreprocessResult> {
  const name = file.name.toLowerCase()

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    try {
      const buffer = await readFileAsArrayBuffer(file)
      const groups = await parseXlsxToQuestionGroups(buffer)
      if (groups.length === 0) {
        return { error: "Excel 檔案中沒有讀到有效的題組資料。" }
      }
      return {
        data: groups as ImportedQuestionImportItem[],
        rawText: `[Excel: ${file.name}]`,
      }
    } catch {
      return { error: "讀取 Excel 檔案失敗，請確認格式正確。" }
    }
  }

  if (name.endsWith(".csv")) {
    const text = await readFileAsText(file)
    if (hasGroupHeader(text)) {
      const groups = parseCsvToQuestionGroups(text)
      if (groups.length === 0) {
        return { error: "CSV 題組檔案中沒有讀到有效資料，請確認每列都有 group_context、question、answer。" }
      }
      return {
        data: groups as ImportedQuestionImportItem[],
        rawText: text,
      }
    }
    return parseSingleQuestionCsv(text)
  }

  // Default: treat as JSON text
  const text = await readFileAsText(file)
  return parseImportInput(text)
}
