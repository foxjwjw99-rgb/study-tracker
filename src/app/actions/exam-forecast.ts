"use server"

import { revalidatePath } from "next/cache"

import prisma from "@/lib/prisma"
import {
  assertOwnedRecord,
  getCurrentUserOrThrow,
  OWNERSHIP_ERROR_MESSAGE,
} from "@/lib/current-user"
import type {
  ActionResult,
  ExamForecastData,
  MockExamRecordItem,
  SubjectFactorScores,
  SubjectForecastItem,
  UnitDangerLevel,
  UnitForecastItem,
} from "@/types"

// ─── math helpers ─────────────────────────────────────────────────────────────

function logisticProbability(estimatedScore: number, targetScore: number): number {
  const k = 1 / 8
  const p = 1 / (1 + Math.exp(-k * (estimatedScore - targetScore)))
  return Math.round(p * 100)
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/** Simple least-squares slope (x = index, y = values). */
function linearSlope(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  const xMean = (n - 1) / 2
  const yMean = values.reduce((s, v) => s + v, 0) / n
  const num = values.reduce((s, v, i) => s + (i - xMean) * (v - yMean), 0)
  const den = values.reduce((s, _, i) => s + (i - xMean) ** 2, 0)
  return den === 0 ? 0 : num / den
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function dangerLevel(masteryScore: number | null): UnitDangerLevel {
  if (masteryScore == null || masteryScore === 0) return "D"
  if (masteryScore <= 2) return "C"
  if (masteryScore === 3) return "B"
  return "A"
}

// ─── getExamForecastData ──────────────────────────────────────────────────────

export async function getExamForecastData(): Promise<ExamForecastData> {
  const user = await getCurrentUserOrThrow()

  const subjects = await prisma.subject.findMany({
    where: { user_id: user.id },
    select: {
      id: true,
      name: true,
      target_score: true,
      exam_weight: true,
      exam_syllabus_units: {
        select: { id: true, unit_name: true, weight: true, mastery_score: true },
        orderBy: { unit_name: "asc" },
      },
    },
  })

  const allUnits = subjects.flatMap((s) => s.exam_syllabus_units)
  if (allUnits.length === 0) {
    return {
      isConfigured: false,
      estimatedTotalScore: 0,
      targetTotalScore: 0,
      probability: 0,
      subjectBreakdown: [],
      highRiskUnits: [],
    }
  }

  // ── Practice accuracy (last 90 days, grouped by subject+topic) ──
  const since90 = new Date()
  since90.setDate(since90.getDate() - 90)

  const practiceLogs = await prisma.practiceLog.groupBy({
    by: ["subject_id", "topic"],
    where: { user_id: user.id, practice_date: { gte: since90 }, total_questions: { gt: 0 } },
    _sum: { correct_questions: true, total_questions: true },
  })

  const accuracyMap = new Map<string, number>()
  const subjectTotalCorrect = new Map<string, number>()
  const subjectTotalQs = new Map<string, number>()

  for (const row of practiceLogs) {
    const correct = row._sum.correct_questions ?? 0
    const total = row._sum.total_questions ?? 0
    if (total > 0) {
      accuracyMap.set(`${row.subject_id}:${row.topic}`, correct / total)
      subjectTotalCorrect.set(
        row.subject_id,
        (subjectTotalCorrect.get(row.subject_id) ?? 0) + correct,
      )
      subjectTotalQs.set(
        row.subject_id,
        (subjectTotalQs.get(row.subject_id) ?? 0) + total,
      )
    }
  }

  // ── Mock exam records (last 6 per subject) ──
  const mockRecords = await prisma.mockExamRecord.findMany({
    where: { user_id: user.id },
    orderBy: { exam_date: "desc" },
    select: { subject_id: true, score: true, full_score: true, exam_date: true },
  })

  // group by subject, keep last 6
  const mockBySubject = new Map<string, number[]>()
  for (const r of mockRecords) {
    const pct = (r.score / r.full_score) * 100
    const arr = mockBySubject.get(r.subject_id) ?? []
    if (arr.length < 6) {
      mockBySubject.set(r.subject_id, [...arr, pct])
    }
  }

  // ── Wrong question correction rates ──
  const wrongQuestions = await prisma.wrongQuestion.groupBy({
    by: ["subject_id", "status"],
    where: { user_id: user.id },
    _count: { id: true },
  })

  const wrongBySubject = new Map<string, { total: number; resolved: number }>()
  for (const row of wrongQuestions) {
    const entry = wrongBySubject.get(row.subject_id) ?? { total: 0, resolved: 0 }
    entry.total += row._count.id
    if (row.status === "已訂正" || row.status === "已掌握") {
      entry.resolved += row._count.id
    }
    wrongBySubject.set(row.subject_id, entry)
  }

  // ── Normalise exam_weights ──
  const subjectsWithWeight = subjects.filter(
    (s) => s.exam_weight != null && s.exam_syllabus_units.length > 0,
  )
  const totalExamWeight = subjectsWithWeight.reduce((s, sub) => s + (sub.exam_weight ?? 0), 0)

  const subjectBreakdown: SubjectForecastItem[] = []
  const allHighRisk: (UnitForecastItem & { subjectName: string })[] = []

  for (const subject of subjects) {
    if (subject.exam_syllabus_units.length === 0) continue

    const rawUnitWeightSum = subject.exam_syllabus_units.reduce((s, u) => s + u.weight, 0)

    // ── Build unit items ──
    const units: UnitForecastItem[] = subject.exam_syllabus_units.map((unit) => {
      const normW = rawUnitWeightSum > 0 ? unit.weight / rawUnitWeightSum : 0
      const accuracy = accuracyMap.get(`${subject.id}:${unit.unit_name}`) ?? null
      const dl = dangerLevel(unit.mastery_score)
      // contribution uses both if available
      const manualNorm = unit.mastery_score != null ? unit.mastery_score / 5 : null
      const effectivePct =
        manualNorm != null && accuracy != null
          ? ((manualNorm + accuracy) / 2) * 100
          : manualNorm != null
            ? manualNorm * 100
            : accuracy != null
              ? accuracy * 100
              : 0
      return {
        unitName: unit.unit_name,
        weight: normW,
        masteryScore: unit.mastery_score,
        accuracy,
        isCovered: accuracy !== null,
        dangerLevel: dl,
        contribution: normW * effectivePct,
      }
    })

    // ── Factor 1: Mastery (30%) ──
    const hasManual = units.some((u) => u.masteryScore != null)
    const hasAccuracy = units.some((u) => u.accuracy != null)
    const manualSub = hasManual
      ? units.reduce(
          (s, u) => s + u.weight * ((u.masteryScore ?? 0) / 5) * 100,
          0,
        )
      : null
    const accuracySub = hasAccuracy
      ? units.reduce((s, u) => s + u.weight * ((u.accuracy ?? 0) * 100), 0)
      : null
    const mastery =
      manualSub != null && accuracySub != null
        ? (manualSub + accuracySub) / 2
        : manualSub ?? accuracySub ?? 0

    // ── Factor 2: Mock score (35%) ──
    const mockScores = mockBySubject.get(subject.id) ?? []
    let mockScore: number
    let mockScoreIsEstimated: boolean
    if (mockScores.length > 0) {
      mockScore = mockScores.reduce((s, v) => s + v, 0) / mockScores.length
      mockScoreIsEstimated = false
    } else {
      // fallback: subject-level practice accuracy
      const tc = subjectTotalCorrect.get(subject.id) ?? 0
      const tq = subjectTotalQs.get(subject.id) ?? 0
      mockScore = tq > 0 ? (tc / tq) * 100 : 0
      mockScoreIsEstimated = true
    }

    // ── Factor 3: Wrong question correction rate (15%) ──
    const wrongData = wrongBySubject.get(subject.id)
    const correctionRate =
      wrongData && wrongData.total > 0
        ? (wrongData.resolved / wrongData.total) * 100
        : 100

    // ── Factor 4: Stability (10%) ──
    const last4 = mockScores.slice(0, 4)
    let stability: number
    if (last4.length < 2) {
      stability = 50
    } else {
      const mean = last4.reduce((s, v) => s + v, 0) / last4.length
      const cv = mean > 0 ? stdDev(last4) / mean : 0
      stability = clamp(100 * (1 - cv), 0, 100)
    }

    // ── Factor 5: Slope (10%) ──
    const last6 = mockScores.slice(0, 6).reverse() // chronological order
    let slope: number
    if (last6.length < 2) {
      slope = 50
    } else {
      const s = linearSlope(last6) // points per mock session
      slope = clamp(50 + s * 5, 0, 100)
    }

    // ── Composite ──
    const composite = clamp(
      mastery * 0.3 + mockScore * 0.35 + correctionRate * 0.15 + stability * 0.1 + slope * 0.1,
      0,
      100,
    )

    const factors: SubjectFactorScores = {
      mastery: Math.round(mastery * 10) / 10,
      masteryManual: manualSub != null ? Math.round(manualSub * 10) / 10 : null,
      masteryAccuracy: accuracySub != null ? Math.round(accuracySub * 10) / 10 : null,
      mockScore: Math.round(mockScore * 10) / 10,
      mockScoreIsEstimated,
      correctionRate: Math.round(correctionRate * 10) / 10,
      stability: Math.round(stability * 10) / 10,
      slope: Math.round(slope * 10) / 10,
      composite: Math.round(composite * 10) / 10,
    }

    const targetScore = subject.target_score ?? 60
    const normExamWeight =
      subject.exam_weight != null && totalExamWeight > 0
        ? subject.exam_weight / totalExamWeight
        : null

    subjectBreakdown.push({
      subjectId: subject.id,
      subjectName: subject.name,
      examWeight: normExamWeight,
      targetScore,
      estimatedScore: factors.composite,
      factors,
      units,
    })

    // Collect high-risk: weight ≥ 20% AND danger C or D
    for (const unit of units) {
      if (unit.weight >= 0.2 && (unit.dangerLevel === "C" || unit.dangerLevel === "D")) {
        allHighRisk.push({ ...unit, subjectName: subject.name })
      }
    }
  }

  // ── Total score ──
  const configured = subjectBreakdown.filter((s) => s.examWeight != null)
  const estimatedTotalScore =
    configured.length > 0
      ? configured.reduce((s, sub) => s + (sub.examWeight ?? 0) * sub.estimatedScore, 0)
      : subjectBreakdown.reduce((s, sub) => s + sub.estimatedScore, 0) /
        Math.max(subjectBreakdown.length, 1)

  const targetTotalScore =
    configured.length > 0
      ? configured.reduce((s, sub) => s + (sub.examWeight ?? 0) * sub.targetScore, 0)
      : 60

  allHighRisk.sort((a, b) => b.weight - a.weight)

  return {
    isConfigured: true,
    estimatedTotalScore: Math.round(estimatedTotalScore * 10) / 10,
    targetTotalScore: Math.round(targetTotalScore * 10) / 10,
    probability: logisticProbability(estimatedTotalScore, targetTotalScore),
    subjectBreakdown,
    highRiskUnits: allHighRisk.slice(0, 5),
  }
}

// ─── Syllabus unit actions ────────────────────────────────────────────────────

export async function upsertExamSyllabusUnit(data: {
  subjectId: string
  unitName: string
  weight: number
  masteryScore?: number | null
}): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()

  const unitName = data.unitName.trim()
  if (!unitName) return { success: false, message: "請輸入單元名稱。" }
  if (data.weight <= 0 || data.weight > 100) {
    return { success: false, message: "比重必須介於 1–100 之間。" }
  }

  const subject = await prisma.subject.findFirst({
    where: { id: data.subjectId, user_id: user.id },
    select: { id: true },
  })
  assertOwnedRecord(subject, OWNERSHIP_ERROR_MESSAGE)

  await prisma.examSyllabusUnit.upsert({
    where: { subject_id_unit_name: { subject_id: data.subjectId, unit_name: unitName } },
    create: {
      user_id: user.id,
      subject_id: data.subjectId,
      unit_name: unitName,
      weight: data.weight / 100,
      mastery_score: data.masteryScore ?? null,
    },
    update: {
      weight: data.weight / 100,
      ...(data.masteryScore !== undefined && { mastery_score: data.masteryScore }),
    },
  })

  revalidatePath("/settings")
  revalidatePath("/dashboard")
  return { success: true, message: `已儲存單元「${unitName}」。` }
}

export async function updateUnitMastery(id: string, masteryScore: number | null): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()

  const unit = await prisma.examSyllabusUnit.findFirst({
    where: { id, user_id: user.id },
    select: { id: true },
  })
  assertOwnedRecord(unit, OWNERSHIP_ERROR_MESSAGE)

  if (masteryScore !== null && (masteryScore < 0 || masteryScore > 5)) {
    return { success: false, message: "掌握度必須介於 0–5 之間。" }
  }

  await prisma.examSyllabusUnit.update({
    where: { id },
    data: { mastery_score: masteryScore },
  })

  revalidatePath("/settings")
  revalidatePath("/dashboard")
  return { success: true, message: "已更新掌握度。" }
}

export async function deleteExamSyllabusUnit(id: string): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()

  const unit = await prisma.examSyllabusUnit.findFirst({
    where: { id, user_id: user.id },
    select: { id: true, unit_name: true },
  })
  const ownedUnit = assertOwnedRecord(unit, OWNERSHIP_ERROR_MESSAGE)

  await prisma.examSyllabusUnit.delete({ where: { id, user_id: user.id } })

  revalidatePath("/settings")
  revalidatePath("/dashboard")
  return { success: true, message: `已刪除單元「${ownedUnit.unit_name}」。` }
}

// ─── Mock exam record actions ─────────────────────────────────────────────────

export async function getMockExamRecords(subjectId?: string): Promise<MockExamRecordItem[]> {
  const user = await getCurrentUserOrThrow()

  const records = await prisma.mockExamRecord.findMany({
    where: {
      user_id: user.id,
      ...(subjectId ? { subject_id: subjectId } : {}),
    },
    orderBy: { exam_date: "desc" },
    select: {
      id: true,
      subject_id: true,
      subject: { select: { name: true } },
      exam_date: true,
      score: true,
      full_score: true,
      is_timed: true,
      notes: true,
    },
  })

  return records.map((r) => ({
    id: r.id,
    subjectId: r.subject_id,
    subjectName: r.subject.name,
    examDate: r.exam_date,
    score: r.score,
    fullScore: r.full_score,
    isTimed: r.is_timed,
    notes: r.notes,
  }))
}

export async function createMockExamRecord(data: {
  subjectId: string
  examDate: string // ISO date string
  score: number
  fullScore: number
  isTimed: boolean
  notes?: string
}): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()

  if (data.score < 0 || data.score > data.fullScore) {
    return { success: false, message: "分數必須介於 0 到滿分之間。" }
  }
  if (data.fullScore <= 0) {
    return { success: false, message: "滿分必須大於 0。" }
  }

  const subject = await prisma.subject.findFirst({
    where: { id: data.subjectId, user_id: user.id },
    select: { id: true },
  })
  assertOwnedRecord(subject, OWNERSHIP_ERROR_MESSAGE)

  await prisma.mockExamRecord.create({
    data: {
      user_id: user.id,
      subject_id: data.subjectId,
      exam_date: new Date(data.examDate),
      score: data.score,
      full_score: data.fullScore,
      is_timed: data.isTimed,
      notes: data.notes?.trim() || null,
    },
  })

  revalidatePath("/settings")
  revalidatePath("/dashboard")
  return { success: true, message: "已新增模考紀錄。" }
}

export async function deleteMockExamRecord(id: string): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()

  const record = await prisma.mockExamRecord.findFirst({
    where: { id, user_id: user.id },
    select: { id: true },
  })
  assertOwnedRecord(record, OWNERSHIP_ERROR_MESSAGE)

  await prisma.mockExamRecord.delete({ where: { id, user_id: user.id } })

  revalidatePath("/settings")
  revalidatePath("/dashboard")
  return { success: true, message: "已刪除模考紀錄。" }
}

// ─── Bulk syllabus import ─────────────────────────────────────────────────────

export type SyllabusImportUnit = {
  unit_name: string
  weight: number        // 1–100 (percentage within the subject)
  mastery_score?: number | null // 0–5
}

export type SyllabusImportSubject = {
  subject: string       // must match existing subject name (case-insensitive)
  exam_weight?: number  // 1–100 (percentage of total exam)
  units: SyllabusImportUnit[]
}

/** Accepts either a single-subject object `{ units: [...] }` (writes to `subjectId`)
 *  or a multi-subject array `[{ subject, units }, ...]` (matches by name).
 *  Returns a summary of how many units were created/updated.
 */
export async function bulkUpsertSyllabusUnits(
  subjectId: string,
  raw: unknown,
): Promise<ActionResult & { created?: number; updated?: number }> {
  const user = await getCurrentUserOrThrow()

  // Verify ownership of the provided subjectId
  const ownedSubject = await prisma.subject.findFirst({
    where: { id: subjectId, user_id: user.id },
    select: { id: true, name: true },
  })
  assertOwnedRecord(ownedSubject, OWNERSHIP_ERROR_MESSAGE)

  // ── Parse & normalise input ──
  const entries: Array<{ subjectId: string; units: SyllabusImportUnit[]; examWeight?: number }> = []

  if (Array.isArray(raw)) {
    // Multi-subject format: [{ subject, exam_weight?, units }]
    const allSubjects = await prisma.subject.findMany({
      where: { user_id: user.id },
      select: { id: true, name: true },
    })
    const nameMap = new Map(allSubjects.map((s) => [s.name.toLowerCase(), s.id]))

    for (const item of raw) {
      if (typeof item !== "object" || item === null || !("subject" in item)) continue
      const parsed = item as SyllabusImportSubject
      const sid = nameMap.get(String(parsed.subject).toLowerCase())
      if (!sid) continue // skip unknown subjects
      if (!Array.isArray(parsed.units)) continue
      entries.push({ subjectId: sid, units: parsed.units, examWeight: parsed.exam_weight })
    }

    if (entries.length === 0) {
      return {
        success: false,
        message: "找不到符合的科目名稱，請確認科目名稱與系統中的科目一致。",
      }
    }
  } else if (typeof raw === "object" && raw !== null && "units" in raw) {
    // Single-subject format: { units, exam_weight? }
    const parsed = raw as { units: unknown; exam_weight?: number }
    if (!Array.isArray(parsed.units)) {
      return { success: false, message: "JSON 格式錯誤：units 欄位必須為陣列。" }
    }
    entries.push({
      subjectId,
      units: parsed.units as SyllabusImportUnit[],
      examWeight: parsed.exam_weight,
    })
  } else {
    return { success: false, message: "JSON 格式無法識別，請參考說明文件。" }
  }

  // ── Validate & upsert ──
  let created = 0
  let updated = 0

  for (const entry of entries) {
    if (entry.examWeight != null) {
      const w = Number(entry.examWeight)
      if (!isNaN(w) && w > 0 && w <= 100) {
        await prisma.subject.update({
          where: { id: entry.subjectId },
          data: { exam_weight: w / 100 },
        })
      }
    }

    for (const unit of entry.units) {
      const name = String(unit.unit_name ?? "").trim()
      if (!name) continue

      const weight = Number(unit.weight)
      if (isNaN(weight) || weight <= 0 || weight > 100) continue

      const masteryRaw = unit.mastery_score
      const mastery =
        masteryRaw == null
          ? undefined
          : Math.min(5, Math.max(0, Math.round(Number(masteryRaw))))

      const existing = await prisma.examSyllabusUnit.findUnique({
        where: { subject_id_unit_name: { subject_id: entry.subjectId, unit_name: name } },
        select: { id: true },
      })

      await prisma.examSyllabusUnit.upsert({
        where: { subject_id_unit_name: { subject_id: entry.subjectId, unit_name: name } },
        create: {
          user_id: user.id,
          subject_id: entry.subjectId,
          unit_name: name,
          weight: weight / 100,
          mastery_score: mastery ?? null,
        },
        update: {
          weight: weight / 100,
          ...(mastery !== undefined && { mastery_score: mastery }),
        },
      })

      if (existing) updated++
      else created++
    }
  }

  revalidatePath("/settings")
  revalidatePath("/dashboard")
  revalidatePath("/admission")

  const parts: string[] = []
  if (created > 0) parts.push(`新增 ${created} 個單元`)
  if (updated > 0) parts.push(`更新 ${updated} 個單元`)
  return {
    success: true,
    message: parts.length > 0 ? parts.join("、") + "。" : "沒有可匯入的單元。",
    created,
    updated,
  }
}
