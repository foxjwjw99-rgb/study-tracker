#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import process from "node:process"
import { PrismaClient } from "@prisma/client"

const TABLES = [
  {
    model: "User",
    delegate: "user",
    dateFields: ["exam_date", "created_at", "updated_at"],
    booleanFields: [],
  },
  {
    model: "Subject",
    delegate: "subject",
    dateFields: ["created_at", "updated_at"],
    booleanFields: [],
  },
  {
    model: "StudyGroup",
    delegate: "studyGroup",
    dateFields: ["created_at", "updated_at"],
    booleanFields: [],
  },
  {
    model: "StudyGroupMember",
    delegate: "studyGroupMember",
    dateFields: ["created_at", "updated_at"],
    booleanFields: [],
  },
  {
    model: "StudyLog",
    delegate: "studyLog",
    dateFields: ["study_date", "created_at", "updated_at"],
    booleanFields: ["planned_done"],
  },
  {
    model: "PracticeLog",
    delegate: "practiceLog",
    dateFields: ["practice_date", "created_at", "updated_at"],
    booleanFields: [],
  },
  {
    model: "WrongQuestion",
    delegate: "wrongQuestion",
    dateFields: ["first_wrong_date", "next_review_date", "created_at", "updated_at"],
    booleanFields: [],
  },
  {
    model: "VocabularyWord",
    delegate: "vocabularyWord",
    dateFields: ["last_reviewed_at", "next_review_date", "created_at", "updated_at"],
    booleanFields: [],
  },
  {
    model: "Question",
    delegate: "question",
    dateFields: ["created_at", "updated_at"],
    booleanFields: [],
  },
  {
    model: "ReviewTask",
    delegate: "reviewTask",
    dateFields: ["review_date", "created_at", "updated_at"],
    booleanFields: ["completed"],
  },
  {
    model: "VocabularyReviewLog",
    delegate: "vocabularyReviewLog",
    dateFields: ["created_at"],
    booleanFields: [],
  },
  {
    model: "RewardDraw",
    delegate: "rewardDraw",
    dateFields: ["redeemed_at", "created_at", "updated_at"],
    booleanFields: ["redeemed"],
  },
]

const HELP = `
SQLite → PostgreSQL data migration for study-tracker.

Usage:
  npm run db:migrate:data -- --dry-run
  npm run db:migrate:data
  SQLITE_PATH=prisma/dev.db DATABASE_URL='postgresql://...' npm run db:migrate:data
  SQLITE_PATH=prisma/dev.db DATABASE_URL='postgresql://...' npm run db:migrate:data -- --force-clear

Environment variables:
  DATABASE_URL         PostgreSQL target connection string
  SQLITE_PATH          Source SQLite file path (default: prisma/dev.db)
  SQLITE_DATABASE_URL  Alternative source definition, e.g. file:./dev.db
  MIGRATION_BATCH_SIZE Insert batch size (default: 200)
  MIGRATION_CLEAR_TARGET=1  Clear target tables before importing

Flags:
  --dry-run      Read the SQLite source and print row counts only
  --force-clear  Delete target rows before importing
  --help         Show this help
`

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  const content = fs.readFileSync(filePath, "utf8")
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue

    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue

    let value = rawValue.trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

function resolveSqlitePath(input) {
  const fallback = path.resolve(process.cwd(), "prisma/dev.db")
  if (!input) return fallback

  if (input.startsWith("file:")) {
    let raw = input.slice(5).split("?")[0]

    if (raw.startsWith("//")) {
      try {
        return new URL(input).pathname
      } catch {
        return fallback
      }
    }

    if (raw.startsWith("./")) {
      return path.resolve(process.cwd(), "prisma", raw.slice(2))
    }

    return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw)
  }

  return path.isAbsolute(input) ? input : path.resolve(process.cwd(), input)
}

function sqliteQuery(sqlitePath, sql) {
  const output = execFileSync("sqlite3", ["-json", sqlitePath, sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })

  const trimmed = output.trim()
  return trimmed ? JSON.parse(trimmed) : []
}

function normalizeDate(value) {
  if (value === null || value === undefined || value === "") return null

  if (typeof value === "number") {
    return new Date(value)
  }

  if (typeof value === "string") {
    if (/^\d+$/.test(value)) {
      return new Date(Number(value))
    }

    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return value
}

function normalizeBoolean(value) {
  if (value === null || value === undefined) return value
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1
  if (typeof value === "string") {
    if (value === "1" || value.toLowerCase() === "true") return true
    if (value === "0" || value.toLowerCase() === "false") return false
  }
  return Boolean(value)
}

function normalizeRow(row, config) {
  const next = { ...row }

  for (const field of config.dateFields) {
    if (field in next) {
      next[field] = normalizeDate(next[field])
    }
  }

  for (const field of config.booleanFields) {
    if (field in next) {
      next[field] = normalizeBoolean(next[field])
    }
  }

  return next
}

function chunk(items, size) {
  const result = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}

async function getTargetCounts(prisma) {
  const counts = {}
  for (const table of TABLES) {
    counts[table.model] = await prisma[table.delegate].count()
  }
  return counts
}

async function clearTarget(prisma) {
  for (const table of [...TABLES].reverse()) {
    const deleted = await prisma[table.delegate].deleteMany()
    console.log(`🧹 Cleared ${table.model}: ${deleted.count}`)
  }
}

async function insertTable(prisma, table, rows, batchSize) {
  if (rows.length === 0) {
    console.log(`⏭️  ${table.model}: 0 rows`)
    return
  }

  const chunks = chunk(rows, batchSize)
  for (const [index, group] of chunks.entries()) {
    await prisma[table.delegate].createMany({ data: group })
    console.log(`📦 ${table.model}: batch ${index + 1}/${chunks.length} (${group.length} rows)`)
  }
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env"))
  loadEnvFile(path.resolve(process.cwd(), ".env.local"))

  const args = new Set(process.argv.slice(2))
  if (args.has("--help") || args.has("-h")) {
    console.log(HELP.trim())
    return
  }

  const dryRun = args.has("--dry-run")
  const forceClear = args.has("--force-clear") || process.env.MIGRATION_CLEAR_TARGET === "1"
  const batchSize = Number(process.env.MIGRATION_BATCH_SIZE || 200)

  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error(`Invalid MIGRATION_BATCH_SIZE: ${process.env.MIGRATION_BATCH_SIZE}`)
  }

  const sqlitePath = resolveSqlitePath(process.env.SQLITE_PATH || process.env.SQLITE_DATABASE_URL)
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite source not found: ${sqlitePath}`)
  }

  console.log(`📚 Source SQLite: ${sqlitePath}`)

  const sourceData = new Map()
  let totalRows = 0
  for (const table of TABLES) {
    const rows = sqliteQuery(sqlitePath, `SELECT * FROM "${table.model}";`).map((row) => normalizeRow(row, table))
    sourceData.set(table.model, rows)
    totalRows += rows.length
    console.log(`- ${table.model}: ${rows.length}`)
  }

  console.log(`📊 Total source rows: ${totalRows}`)

  if (dryRun) {
    console.log("📝 Dry run only. No PostgreSQL changes were made.")
    return
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for PostgreSQL import")
  }

  const prisma = new PrismaClient()

  try {
    const targetCounts = await getTargetCounts(prisma)
    const targetTotal = Object.values(targetCounts).reduce((sum, count) => sum + count, 0)

    console.log(`🎯 Target PostgreSQL rows before import: ${targetTotal}`)

    if (targetTotal > 0 && !forceClear) {
      console.log("Existing target row counts:")
      for (const table of TABLES) {
        console.log(`- ${table.model}: ${targetCounts[table.model]}`)
      }
      throw new Error(
        "Target database is not empty. Re-run with --force-clear (or MIGRATION_CLEAR_TARGET=1) if you really want to replace it."
      )
    }

    if (targetTotal > 0 && forceClear) {
      await clearTarget(prisma)
    }

    for (const table of TABLES) {
      const rows = sourceData.get(table.model) || []
      await insertTable(prisma, table, rows, batchSize)
    }

    const finalCounts = await getTargetCounts(prisma)
    console.log("✅ Import finished. Final PostgreSQL row counts:")
    for (const table of TABLES) {
      console.log(`- ${table.model}: ${finalCounts[table.model]}`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error("❌ Migration failed")
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
