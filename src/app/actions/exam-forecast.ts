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
  SubjectForecastItem,
  UnitForecastItem,
} from "@/types"

// ─── logistic helper ─────────────────────────────────────────────────────────

/** Maps a score delta to 0–100 probability using a logistic curve (k=1/8). */
function logisticProbability(estimatedScore: number, targetScore: number): number {
  const k = 1 / 8
  const p = 1 / (1 + Math.exp(-k * (estimatedScore - targetScore)))
  return Math.round(p * 100)
}

// ─── read action ─────────────────────────────────────────────────────────────

export async function getExamForecastData(): Promise<ExamForecastData> {
  const user = await getCurrentUserOrThrow()

  // Fetch subjects with exam config
  const subjects = await prisma.subject.findMany({
    where: { user_id: user.id },
    select: {
      id: true,
      name: true,
      target_score: true,
      exam_weight: true,
      exam_syllabus_units: {
        select: { id: true, unit_name: true, weight: true },
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

  // Fetch practice accuracy for last 90 days grouped by (subject_id, topic)
  const since = new Date()
  since.setDate(since.getDate() - 90)

  const practiceLogs = await prisma.practiceLog.groupBy({
    by: ["subject_id", "topic"],
    where: {
      user_id: user.id,
      practice_date: { gte: since },
      total_questions: { gt: 0 },
    },
    _sum: { correct_questions: true, total_questions: true },
  })

  // Build lookup: subjectId:topic → accuracy
  const accuracyMap = new Map<string, number>()
  for (const row of practiceLogs) {
    const correct = row._sum.correct_questions ?? 0
    const total = row._sum.total_questions ?? 0
    if (total > 0) {
      accuracyMap.set(`${row.subject_id}:${row.topic}`, correct / total)
    }
  }

  // Per-subject average accuracy (fallback for uncovered units)
  const subjectAvgAccuracy = new Map<string, number>()
  for (const subject of subjects) {
    const rows = practiceLogs.filter((r) => r.subject_id === subject.id)
    const totalCorrect = rows.reduce((s, r) => s + (r._sum.correct_questions ?? 0), 0)
    const totalQs = rows.reduce((s, r) => s + (r._sum.total_questions ?? 0), 0)
    subjectAvgAccuracy.set(subject.id, totalQs > 0 ? totalCorrect / totalQs : 0)
  }

  // Compute per-subject and per-unit estimates
  const subjectsWithWeight = subjects.filter(
    (s) => s.exam_weight != null && s.exam_syllabus_units.length > 0,
  )

  // Normalise exam_weights to sum=1
  const totalExamWeight = subjectsWithWeight.reduce((s, sub) => s + (sub.exam_weight ?? 0), 0)

  const subjectBreakdown: SubjectForecastItem[] = []
  const allHighRisk: (UnitForecastItem & { subjectName: string })[] = []

  for (const subject of subjects) {
    if (subject.exam_syllabus_units.length === 0) continue

    const rawWeight = subject.exam_weight ?? null
    const normExamWeight =
      rawWeight != null && totalExamWeight > 0 ? rawWeight / totalExamWeight : null

    // Normalise unit weights within this subject
    const rawUnitWeightSum = subject.exam_syllabus_units.reduce((s, u) => s + u.weight, 0)
    const subjectFallback = subjectAvgAccuracy.get(subject.id) ?? 0

    const units: UnitForecastItem[] = subject.exam_syllabus_units.map((unit) => {
      const normUnitWeight = rawUnitWeightSum > 0 ? unit.weight / rawUnitWeightSum : 0
      const accuracy = accuracyMap.get(`${subject.id}:${unit.unit_name}`) ?? null
      const effectiveAccuracy = accuracy ?? subjectFallback
      return {
        unitName: unit.unit_name,
        weight: normUnitWeight,
        accuracy,
        isCovered: accuracy !== null,
        contribution: normUnitWeight * effectiveAccuracy * 100,
      }
    })

    const estimatedScore = units.reduce((s, u) => s + u.contribution, 0)
    const targetScore = subject.target_score ?? 60

    subjectBreakdown.push({
      subjectId: subject.id,
      subjectName: subject.name,
      examWeight: normExamWeight,
      targetScore,
      estimatedScore,
      units,
    })

    // Collect high-risk units: weight ≥ 20% of subject AND accuracy < 60%
    for (const unit of units) {
      if (unit.weight >= 0.2 && (unit.accuracy == null || unit.accuracy < 0.6)) {
        allHighRisk.push({ ...unit, subjectName: subject.name })
      }
    }
  }

  // Compute total estimated and target scores (only subjects with exam_weight)
  const configuredSubjects = subjectBreakdown.filter((s) => s.examWeight != null)
  const estimatedTotalScore =
    configuredSubjects.length > 0
      ? configuredSubjects.reduce(
          (s, sub) => s + (sub.examWeight ?? 0) * sub.estimatedScore,
          0,
        )
      : subjectBreakdown.reduce((s, sub) => s + sub.estimatedScore, 0) /
        Math.max(subjectBreakdown.length, 1)

  const targetTotalScore =
    configuredSubjects.length > 0
      ? configuredSubjects.reduce(
          (s, sub) => s + (sub.examWeight ?? 0) * sub.targetScore,
          0,
        )
      : 60

  const probability = logisticProbability(estimatedTotalScore, targetTotalScore)

  // Sort high-risk by weight desc
  allHighRisk.sort((a, b) => b.weight - a.weight)

  return {
    isConfigured: true,
    estimatedTotalScore: Math.round(estimatedTotalScore * 10) / 10,
    targetTotalScore: Math.round(targetTotalScore * 10) / 10,
    probability,
    subjectBreakdown,
    highRiskUnits: allHighRisk.slice(0, 5),
  }
}

// ─── write actions ────────────────────────────────────────────────────────────

export async function upsertExamSyllabusUnit(data: {
  subjectId: string
  unitName: string
  weight: number
}): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()

  const unitName = data.unitName.trim()
  if (!unitName) return { success: false, message: "請輸入單元名稱。" }
  if (data.weight <= 0 || data.weight > 100) {
    return { success: false, message: "比重必須介於 1–100 之間。" }
  }

  // Verify subject ownership
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
      weight: data.weight / 100, // store as 0.0–1.0
    },
    update: {
      weight: data.weight / 100,
    },
  })

  revalidatePath("/settings")
  revalidatePath("/dashboard")
  return { success: true, message: `已儲存單元「${unitName}」。` }
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
