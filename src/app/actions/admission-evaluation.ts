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
  AdmissionEvaluationV2Data,
  AdmissionLevel,
  ConfidenceLevel,
  SubjectEvaluationV2Item,
  TargetProgramItem,
} from "@/types"

// ─── math helpers ─────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function round1(v: number) {
  return Math.round(v * 10) / 10
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

// ─── Admission level from gap ─────────────────────────────────────────────────

function computeAdmissionLevel(gap: number): AdmissionLevel {
  if (gap >= 10) return "high_chance"
  if (gap >= 3) return "good_chance"
  if (gap >= -2) return "coin_flip"
  if (gap >= -9) return "risky"
  return "very_risky"
}

// ─── getAdmissionEvaluationV2 ─────────────────────────────────────────────────

export async function getAdmissionEvaluationV2(
  targetProgramId?: string,
): Promise<AdmissionEvaluationV2Data> {
  const user = await getCurrentUserOrThrow()

  // ── All target programs ──
  const targetProgramsRaw = await prisma.targetProgram.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: "asc" },
  })

  const allTargetPrograms: TargetProgramItem[] = targetProgramsRaw.map((p) => ({
    id: p.id,
    schoolName: p.school_name,
    departmentName: p.department_name,
    examYear: p.exam_year,
    lastYearLine: p.last_year_line,
    safeLine: p.safe_line,
    idealLine: p.ideal_line,
    notes: p.notes,
  }))

  // Resolve which target program to use
  let targetProgram: TargetProgramItem | null = null
  if (targetProgramId) {
    targetProgram = allTargetPrograms.find((p) => p.id === targetProgramId) ?? null
  }
  if (!targetProgram && allTargetPrograms.length > 0) {
    targetProgram = allTargetPrograms[0]
  }

  // ── Subjects with syllabus units ──
  const subjects = await prisma.subject.findMany({
    where: { user_id: user.id },
    select: {
      id: true,
      name: true,
      exam_weight: true,
      exam_syllabus_units: {
        select: { unit_name: true, weight: true, mastery_score: true },
        orderBy: { unit_name: "asc" },
      },
    },
  })

  const configuredSubjects = subjects.filter((s) => s.exam_syllabus_units.length > 0)

  if (configuredSubjects.length === 0) {
    return {
      isConfigured: false,
      subjects: [],
      totalScore: { conservative: 0, median: 0, optimistic: 0 },
      targetProgram,
      gaps: null,
      admissionLevel: null,
      confidenceLevel: "low",
      scoreGainMetric: null,
      allTargetPrograms,
    }
  }

  // ── Recent practice accuracy (last 30 days, by subject) ──
  const since30 = new Date()
  since30.setDate(since30.getDate() - 30)

  const recentPracticeLogs = await prisma.practiceLog.groupBy({
    by: ["subject_id"],
    where: {
      user_id: user.id,
      practice_date: { gte: since30 },
      total_questions: { gt: 0 },
    },
    _sum: { correct_questions: true, total_questions: true },
  })

  const recentPracticeMap = new Map<string, number>() // subject_id → 0–100
  for (const row of recentPracticeLogs) {
    const correct = row._sum.correct_questions ?? 0
    const total = row._sum.total_questions ?? 0
    if (total > 0) recentPracticeMap.set(row.subject_id, (correct / total) * 100)
  }

  // Practice accuracy per unit (last 90 days, for coverage detection)
  const since90 = new Date()
  since90.setDate(since90.getDate() - 90)

  const unitPracticeLogs = await prisma.practiceLog.groupBy({
    by: ["subject_id", "topic"],
    where: {
      user_id: user.id,
      practice_date: { gte: since90 },
      total_questions: { gt: 0 },
    },
    _sum: { correct_questions: true, total_questions: true },
  })

  const unitAccuracyMap = new Map<string, number>() // `subjectId:topic` → 0–1
  for (const row of unitPracticeLogs) {
    const correct = row._sum.correct_questions ?? 0
    const total = row._sum.total_questions ?? 0
    if (total > 0) {
      unitAccuracyMap.set(`${row.subject_id}:${row.topic}`, correct / total)
    }
  }

  // ── Mock exam records (last 6 per subject, chronological desc) ──
  const mockRecordsRaw = await prisma.mockExamRecord.findMany({
    where: { user_id: user.id },
    orderBy: { exam_date: "desc" },
    select: { subject_id: true, score: true, full_score: true },
  })

  const mockBySubject = new Map<string, number[]>()
  for (const r of mockRecordsRaw) {
    const pct = (r.score / r.full_score) * 100
    const arr = mockBySubject.get(r.subject_id) ?? []
    if (arr.length < 6) {
      mockBySubject.set(r.subject_id, [...arr, pct])
    }
  }

  // ── Overdue review tasks per subject ──
  const now = new Date()
  const overdueReviewCounts = await prisma.reviewTask.groupBy({
    by: ["subject_id"],
    where: {
      user_id: user.id,
      completed: false,
      review_date: { lt: now },
    },
    _count: { id: true },
  })
  const overdueMap = new Map<string, number>()
  for (const r of overdueReviewCounts) {
    overdueMap.set(r.subject_id, r._count.id)
  }

  // ── Unresolved wrong questions per subject ──
  const unresolvedWrong = await prisma.wrongQuestion.groupBy({
    by: ["subject_id"],
    where: { user_id: user.id, status: "未訂正" },
    _count: { id: true },
  })
  const wrongMap = new Map<string, number>()
  for (const r of unresolvedWrong) {
    wrongMap.set(r.subject_id, r._count.id)
  }

  // ── Last activity date per subject ──
  const lastStudyDates = await prisma.studyLog.groupBy({
    by: ["subject_id"],
    where: { user_id: user.id },
    _max: { study_date: true },
  })
  const lastPracticeDates = await prisma.practiceLog.groupBy({
    by: ["subject_id"],
    where: { user_id: user.id },
    _max: { practice_date: true },
  })

  const lastActivityMap = new Map<string, Date>()
  for (const r of lastStudyDates) {
    if (r._max.study_date) lastActivityMap.set(r.subject_id, r._max.study_date)
  }
  for (const r of lastPracticeDates) {
    const existing = lastActivityMap.get(r.subject_id)
    const practiceDate = r._max.practice_date
    if (practiceDate && (!existing || practiceDate > existing)) {
      lastActivityMap.set(r.subject_id, practiceDate)
    }
  }

  // ── Normalise exam weights across configured subjects ──
  const totalExamWeight = configuredSubjects.reduce((s, sub) => s + (sub.exam_weight ?? 0), 0)

  // ── Per-subject evaluation ──
  const evaluatedSubjects: SubjectEvaluationV2Item[] = []

  for (const subject of configuredSubjects) {
    const units = subject.exam_syllabus_units
    const rawWeightSum = units.reduce((s, u) => s + u.weight, 0)

    // --- coverage_score: % of units with any practice data (0–100) ---
    const coveredUnits = units.filter((u) => unitAccuracyMap.has(`${subject.id}:${u.unit_name}`))
    const coverageRate = rawWeightSum > 0 ? coveredUnits.length / units.length : 0
    const coverageScore = coverageRate * 100

    // --- unit_mastery_score: weighted avg of mastery scores (0–5 → 0–100) ---
    const unitsWithMastery = units.filter((u) => u.mastery_score != null)
    let unitMasteryScore = 0
    if (unitsWithMastery.length > 0 && rawWeightSum > 0) {
      const weightedSum = unitsWithMastery.reduce(
        (s, u) => s + (u.mastery_score! / 5) * 100 * (u.weight / rawWeightSum),
        0,
      )
      // For units without mastery, treat as 0 contribution
      const coveredWeight = unitsWithMastery.reduce((s, u) => s + u.weight, 0)
      unitMasteryScore = rawWeightSum > 0 ? (weightedSum * rawWeightSum) / rawWeightSum : weightedSum
      // Recompute as proper weighted avg including zeros for unmeasured units
      unitMasteryScore = units.reduce((s, u) => {
        const score = u.mastery_score != null ? (u.mastery_score / 5) * 100 : 0
        return s + score * (u.weight / rawWeightSum)
      }, 0)
      void coveredWeight // suppress unused warning
    }

    // --- recent_practice_score (0–100) ---
    const recentPracticeScore = recentPracticeMap.get(subject.id) ?? 0

    // --- mock exam score & stability ---
    const mockScores = mockBySubject.get(subject.id) ?? []
    const mockExamCount = mockScores.length
    const mockExamScore = mockExamCount > 0
      ? mockScores.reduce((s, v) => s + v, 0) / mockScores.length
      : null

    // stability: 100 - CV*100, neutral 50 if < 2 mock exams
    let stabilityScore: number
    const last4 = mockScores.slice(0, 4)
    if (last4.length < 2) {
      stabilityScore = 50
    } else {
      const mean = last4.reduce((s, v) => s + v, 0) / last4.length
      const cv = mean > 0 ? stdDev(last4) / mean : 0
      stabilityScore = clamp(100 * (1 - cv), 0, 100)
    }

    // --- Penalties ---
    const overdueCount = overdueMap.get(subject.id) ?? 0
    const wrongCount = wrongMap.get(subject.id) ?? 0

    const lastActivity = lastActivityMap.get(subject.id)
    const daysSinceActivity = lastActivity
      ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
      : 999

    const hasHighWeightWeakUnit = units.some(
      (u) =>
        u.weight / rawWeightSum >= 0.2 &&
        (u.mastery_score == null || (u.mastery_score / 5) * 100 < 50),
    )

    const overdueReviewPenalty = Math.min(10, overdueCount * 1.5)
    const wrongQuestionsPenalty = Math.min(10, wrongCount * 1.2)
    const inactivePenalty = daysSinceActivity > 14 ? 5 : 0
    const highWeightWeakUnitPenalty = hasHighWeightWeakUnit ? 5 : 0

    const totalPenalty = overdueReviewPenalty + wrongQuestionsPenalty + inactivePenalty + highWeightWeakUnitPenalty

    // --- Determine main penalty reason ---
    const penalties = [
      { label: "待複習過多", value: overdueReviewPenalty },
      { label: "錯題未清", value: wrongQuestionsPenalty },
      { label: "長時間沒碰", value: inactivePenalty },
      { label: "高權重單元太弱", value: highWeightWeakUnitPenalty },
    ]
    const mainPenalty = penalties.filter((p) => p.value > 0).sort((a, b) => b.value - a.value)[0]
    const mainPenaltyReason = mainPenalty?.label ?? null

    // --- Composite score (median) ---
    let medianRaw: number
    if (mockExamScore != null) {
      medianRaw =
        0.45 * mockExamScore +
        0.2 * recentPracticeScore +
        0.15 * unitMasteryScore +
        0.1 * coverageScore +
        0.1 * stabilityScore -
        totalPenalty
    } else {
      medianRaw =
        0.4 * recentPracticeScore +
        0.25 * unitMasteryScore +
        0.2 * coverageScore +
        0.15 * stabilityScore -
        totalPenalty
    }
    const estimatedScoreMedian = clamp(round1(medianRaw), 0, 100)

    // --- Volatility ---
    let volatility = 5 // normal base
    if (mockExamCount === 0) volatility += 3
    else if (mockExamCount === 1) volatility += 2
    else if (mockExamCount === 2) volatility += 1

    if (coverageRate < 0.6) volatility += 2
    if (last4.length >= 2) {
      const mean = last4.reduce((s, v) => s + v, 0) / last4.length
      const cv = mean > 0 ? stdDev(last4) / mean : 0
      if (cv > 0.15) volatility += 2
    }
    if (hasHighWeightWeakUnit) volatility += 2

    const estimatedScoreConservative = clamp(round1(estimatedScoreMedian - volatility), 0, 100)
    const estimatedScoreOptimistic = clamp(round1(estimatedScoreMedian + volatility), 0, 100)

    const normWeight =
      subject.exam_weight != null && totalExamWeight > 0
        ? subject.exam_weight / totalExamWeight
        : null

    evaluatedSubjects.push({
      subjectId: subject.id,
      subjectName: subject.name,
      examWeight: normWeight,
      mockExamScore: mockExamScore != null ? round1(mockExamScore) : null,
      recentPracticeScore: round1(recentPracticeScore),
      unitMasteryScore: round1(unitMasteryScore),
      coverageScore: round1(coverageScore),
      stabilityScore: round1(stabilityScore),
      totalPenalty: round1(totalPenalty),
      penaltyBreakdown: {
        overdueReview: round1(overdueReviewPenalty),
        wrongQuestions: round1(wrongQuestionsPenalty),
        inactive: inactivePenalty,
        highWeightWeakUnit: highWeightWeakUnitPenalty,
      },
      estimatedScoreMedian,
      estimatedScoreConservative,
      estimatedScoreOptimistic,
      volatility,
      mainPenaltyReason,
      mockExamCount,
      coverageRate,
    })
  }

  // ── Total score ──
  const withWeight = evaluatedSubjects.filter((s) => s.examWeight != null)
  const totalScore = withWeight.length > 0
    ? {
        conservative: round1(
          withWeight.reduce((s, sub) => s + (sub.examWeight ?? 0) * sub.estimatedScoreConservative, 0),
        ),
        median: round1(
          withWeight.reduce((s, sub) => s + (sub.examWeight ?? 0) * sub.estimatedScoreMedian, 0),
        ),
        optimistic: round1(
          withWeight.reduce((s, sub) => s + (sub.examWeight ?? 0) * sub.estimatedScoreOptimistic, 0),
        ),
      }
    : {
        conservative: round1(
          evaluatedSubjects.reduce((s, sub) => s + sub.estimatedScoreConservative, 0) /
            Math.max(evaluatedSubjects.length, 1),
        ),
        median: round1(
          evaluatedSubjects.reduce((s, sub) => s + sub.estimatedScoreMedian, 0) /
            Math.max(evaluatedSubjects.length, 1),
        ),
        optimistic: round1(
          evaluatedSubjects.reduce((s, sub) => s + sub.estimatedScoreOptimistic, 0) /
            Math.max(evaluatedSubjects.length, 1),
        ),
      }

  // ── Gaps ──
  const gaps = targetProgram
    ? {
        vsLastYearLine: round1(totalScore.median - targetProgram.lastYearLine),
        vsSafeLine: round1(totalScore.median - targetProgram.safeLine),
        vsIdealLine: round1(totalScore.median - targetProgram.idealLine),
      }
    : null

  // ── Admission level ──
  const admissionLevel = gaps ? computeAdmissionLevel(gaps.vsLastYearLine) : null

  // ── Confidence level ──
  const totalMockCount = evaluatedSubjects.reduce((s, sub) => s + sub.mockExamCount, 0)
  const avgCoverageRate =
    evaluatedSubjects.reduce((s, sub) => s + sub.coverageRate, 0) /
    Math.max(evaluatedSubjects.length, 1)

  let confidenceLevel: ConfidenceLevel
  if (totalMockCount >= 3 && avgCoverageRate >= 0.8) {
    confidenceLevel = "high"
  } else if (totalMockCount >= 1 && avgCoverageRate >= 0.5) {
    confidenceLevel = "medium"
  } else {
    confidenceLevel = "low"
  }

  // ── Score gain metric ──
  // Points per 5 hours: weaker subjects + higher weight → higher value
  // Heuristic: (room_to_grow) * exam_weight * 2 / max(1, median/20)
  const scoreGainCandidates = evaluatedSubjects
    .filter((s) => s.examWeight != null)
    .map((s) => {
      const roomToGrow = 100 - s.estimatedScoreMedian
      const weight = s.examWeight ?? 0
      // Weaker subject yields more points per hour of study
      const difficultyFactor = s.estimatedScoreMedian < 50 ? 1.5 : 1.0
      const estimatedPointsPer5Hours = round1(roomToGrow * weight * difficultyFactor * 0.1)
      return { subjectId: s.subjectId, subjectName: s.subjectName, estimatedPointsPer5Hours }
    })
    .sort((a, b) => b.estimatedPointsPer5Hours - a.estimatedPointsPer5Hours)

  const topGain = scoreGainCandidates[0]
  const scoreGainMetric = topGain
    ? { ...topGain, unitName: null }
    : null

  return {
    isConfigured: true,
    subjects: evaluatedSubjects,
    totalScore,
    targetProgram,
    gaps,
    admissionLevel,
    confidenceLevel,
    scoreGainMetric,
    allTargetPrograms,
  }
}

// ─── Target program CRUD ──────────────────────────────────────────────────────

export async function getTargetPrograms(): Promise<TargetProgramItem[]> {
  const user = await getCurrentUserOrThrow()

  const programs = await prisma.targetProgram.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: "asc" },
  })

  return programs.map((p) => ({
    id: p.id,
    schoolName: p.school_name,
    departmentName: p.department_name,
    examYear: p.exam_year,
    lastYearLine: p.last_year_line,
    safeLine: p.safe_line,
    idealLine: p.ideal_line,
    notes: p.notes,
  }))
}

export async function upsertTargetProgram(data: {
  id?: string
  schoolName: string
  departmentName: string
  examYear: number
  lastYearLine: number
  safeLine: number
  idealLine: number
  notes?: string
}): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()

  const schoolName = data.schoolName.trim()
  const departmentName = data.departmentName.trim()
  if (!schoolName) return { success: false, message: "請輸入學校名稱。" }
  if (!departmentName) return { success: false, message: "請輸入科系名稱。" }
  if (data.lastYearLine <= 0) return { success: false, message: "去年上榜線必須大於 0。" }
  if (data.safeLine <= 0) return { success: false, message: "安全線必須大於 0。" }
  if (data.idealLine <= 0) return { success: false, message: "理想線必須大於 0。" }

  if (data.id) {
    const existing = await prisma.targetProgram.findFirst({
      where: { id: data.id, user_id: user.id },
      select: { id: true },
    })
    assertOwnedRecord(existing, OWNERSHIP_ERROR_MESSAGE)

    await prisma.targetProgram.update({
      where: { id: data.id },
      data: {
        school_name: schoolName,
        department_name: departmentName,
        exam_year: data.examYear,
        last_year_line: data.lastYearLine,
        safe_line: data.safeLine,
        ideal_line: data.idealLine,
        notes: data.notes?.trim() || null,
      },
    })
  } else {
    await prisma.targetProgram.create({
      data: {
        user_id: user.id,
        school_name: schoolName,
        department_name: departmentName,
        exam_year: data.examYear,
        last_year_line: data.lastYearLine,
        safe_line: data.safeLine,
        ideal_line: data.idealLine,
        notes: data.notes?.trim() || null,
      },
    })
  }

  revalidatePath("/admission")
  return { success: true, message: `已儲存目標校系「${schoolName} ${departmentName}」。` }
}

export async function deleteTargetProgram(id: string): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()

  const program = await prisma.targetProgram.findFirst({
    where: { id, user_id: user.id },
    select: { id: true, school_name: true, department_name: true },
  })
  const owned = assertOwnedRecord(program, OWNERSHIP_ERROR_MESSAGE)

  await prisma.targetProgram.delete({ where: { id, user_id: user.id } })

  revalidatePath("/admission")
  return { success: true, message: `已刪除「${owned.school_name} ${owned.department_name}」。` }
}

// ─── Prediction snapshot ──────────────────────────────────────────────────────

export async function savePredictionSnapshot(targetProgramId: string): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()

  const program = await prisma.targetProgram.findFirst({
    where: { id: targetProgramId, user_id: user.id },
    select: { id: true },
  })
  assertOwnedRecord(program, OWNERSHIP_ERROR_MESSAGE)

  const evalData = await getAdmissionEvaluationV2(targetProgramId)

  if (!evalData.isConfigured || !evalData.gaps || !evalData.admissionLevel) {
    return { success: false, message: "尚未完成設定，無法儲存快照。" }
  }

  await prisma.predictionSnapshot.create({
    data: {
      user_id: user.id,
      target_program_id: targetProgramId,
      estimated_total_conservative: evalData.totalScore.conservative,
      estimated_total_median: evalData.totalScore.median,
      estimated_total_optimistic: evalData.totalScore.optimistic,
      gap_vs_last_year_line: evalData.gaps.vsLastYearLine,
      admission_level: evalData.admissionLevel,
      confidence_level: evalData.confidenceLevel,
    },
  })

  revalidatePath("/admission")
  return { success: true, message: "已儲存本次預測快照。" }
}

export async function getPredictionSnapshots(targetProgramId: string): Promise<
  Array<{
    id: string
    snapshotDate: Date
    estimatedTotalConservative: number
    estimatedTotalMedian: number
    estimatedTotalOptimistic: number
    gapVsLastYearLine: number
    admissionLevel: string
    confidenceLevel: string
  }>
> {
  const user = await getCurrentUserOrThrow()

  const snapshots = await prisma.predictionSnapshot.findMany({
    where: { user_id: user.id, target_program_id: targetProgramId },
    orderBy: { snapshot_date: "desc" },
    take: 10,
  })

  return snapshots.map((s) => ({
    id: s.id,
    snapshotDate: s.snapshot_date,
    estimatedTotalConservative: s.estimated_total_conservative,
    estimatedTotalMedian: s.estimated_total_median,
    estimatedTotalOptimistic: s.estimated_total_optimistic,
    gapVsLastYearLine: s.gap_vs_last_year_line,
    admissionLevel: s.admission_level,
    confidenceLevel: s.confidence_level,
  }))
}
