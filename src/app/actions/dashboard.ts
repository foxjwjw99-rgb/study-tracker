"use server"

import prisma from "@/lib/prisma"
import { getCurrentUserOrThrow } from "@/lib/current-user"
import {
  differenceInCalendarDays,
  differenceInDays,
} from "date-fns"
import {
  formatShortDateInTaipei,
  getEndOfTodayUTC,
  getStartOfDayInTaipeiUTC,
  getStartOfDaysAgoUTC,
  getStartOfTodayUTC,
} from "@/lib/date-utils"

import { getAdmissionEvaluationV2 } from "@/app/actions/admission-evaluation"

import type {
  DashboardAdmissionSummary,
  DashboardData,
  DashboardOnboardingStep,
  DashboardPlanItem,
  DashboardReviewFocusItem,
  DashboardSubjectCoverageItem,
  DashboardSubjectMasteryItem,
  DashboardSubjectReadinessItem,
  DashboardSubjectTopicSectionItem,
  DashboardTopicDetailItem,
  DashboardTrendPoint,
  DashboardVocabularyListItem,
  DashboardVocabularyOverview,
  DashboardWeakAreaItem,
  ReadinessFactorBreakdown,
  SubjectHoursItem,
} from "@/types"

const SUBJECT_WEEKLY_TARGET_MINUTES = 240
const UNIT_WEEKLY_TARGET_MINUTES = 120
const DAILY_STUDY_GOAL_MINUTES = 240

type SubjectSummary = { id: string; name: string }
type AreaMetric = {
  key: string
  subjectId: string
  subjectName: string
  label: string
  unitId: string | null
  studyMinutes7d: number
  practiceCount14d: number
  practiceAccuracy14d: number | null
  dueReviews: number
  wrongCount: number
  hasActivity: boolean
  hasQuestionBank: boolean
  score: number
  note: string
  studyScore: number
  accuracyScore: number
  memoryScore: number
  coverageScore: number
  penaltyReason: string | null
}

type AreaSeed = {
  subject_id: string
  topic: string
  unit_id: string | null
  unit_name: string | null
}

export async function getDashboardData(): Promise<DashboardData> {
  const user = await getCurrentUserOrThrow()
  const startOfToday = getStartOfTodayUTC()
  const endOfToday = getEndOfTodayUTC()
  const startOf7DaysAgo = getStartOfDaysAgoUTC(6)
  const startOf14DaysAgo = getStartOfDaysAgoUTC(13)
  const daysUntilExam = user.exam_date ? differenceInDays(new Date(user.exam_date), startOfToday) : null

  const [
    subjects,
    todaysStudy,
    todaysPractice,
    pendingReviews,
    last7DaysStudy,
    studyLogs7dRaw,
    weakTopics,
    nextReviewFocusRaw,
    studyDates,
    vocabularyLists,
    vocabularyWords,
    vocabularyReviewedThisWeek,
    practiceLogExists,
    questionAreasRaw,
    studyAreaAllRaw,
    practiceAreaAllRaw,
    reviewAreaAllRaw,
    wrongAreaAllRaw,
    practice14dRaw,
    reviewDueRaw,
    wrongOpenRaw,
    studyAllRaw,
    practiceAllRaw,
    vocabularyReviewLastByListRaw,
  ] = await Promise.all([
    prisma.subject.findMany({ where: { user_id: user.id }, orderBy: { created_at: "asc" } }),
    prisma.studyLog.aggregate({
      where: { user_id: user.id, study_date: { gte: startOfToday, lte: endOfToday } },
      _sum: { duration_minutes: true },
    }),
    prisma.practiceLog.aggregate({
      where: { user_id: user.id, practice_date: { gte: startOfToday, lte: endOfToday } },
      _sum: { total_questions: true, correct_questions: true },
    }),
    prisma.reviewTask.count({ where: { user_id: user.id, review_date: { lte: endOfToday }, completed: false } }),
    prisma.studyLog.groupBy({
      by: ["study_date"],
      where: { user_id: user.id, study_date: { gte: startOf7DaysAgo, lte: endOfToday } },
      _sum: { duration_minutes: true },
    }),
    prisma.studyLog.findMany({
      where: { user_id: user.id, study_date: { gte: startOf7DaysAgo, lte: endOfToday } },
      select: {
        subject_id: true,
        topic: true,
        unit_id: true,
        unit: { select: { name: true } },
        duration_minutes: true,
        focus_score: true,
        study_type: true,
      },
    }),
    prisma.wrongQuestion.findMany({
      where: { user_id: user.id, status: { not: "MASTERED" } },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: { first_wrong_date: "desc" },
      take: 5,
    }),
    prisma.reviewTask.findMany({
      where: {
        user_id: user.id,
        completed: false,
        review_date: { lte: endOfToday },
        subject_id: { not: null },
      },
      include: { subject: { select: { id: true, name: true } }, unit: { select: { id: true, name: true } } },
      orderBy: [{ review_date: "asc" }, { review_stage: "asc" }],
      take: 3,
    }),
    prisma.studyLog.findMany({ where: { user_id: user.id }, select: { study_date: true }, orderBy: { study_date: "desc" }, take: 365 }),
    prisma.vocabularyList.findMany({
      where: { user_id: user.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.vocabularyWord.findMany({
      where: { user_id: user.id },
      select: { list_id: true, status: true, next_review_date: true, ease_factor: true, lapse_count: true },
    }),
    prisma.vocabularyReviewLog.count({ where: { user_id: user.id, created_at: { gte: startOf7DaysAgo, lte: endOfToday } } }),
    prisma.practiceLog.findFirst({ where: { user_id: user.id }, select: { id: true } }),
    prisma.question.findMany({ where: { user_id: user.id }, select: { subject_id: true, topic: true, unit_id: true, unit: { select: { name: true } } } }),
    prisma.studyLog.findMany({ where: { user_id: user.id }, select: { subject_id: true, topic: true, unit_id: true, unit: { select: { name: true } } } }),
    prisma.practiceLog.findMany({ where: { user_id: user.id }, select: { subject_id: true, topic: true, unit_id: true, unit: { select: { name: true } } } }),
    prisma.reviewTask.findMany({ where: { user_id: user.id, subject_id: { not: null } }, select: { subject_id: true, topic: true, unit_id: true, unit: { select: { name: true } } } }),
    prisma.wrongQuestion.findMany({ where: { user_id: user.id }, select: { subject_id: true, topic: true, unit_id: true, unit: { select: { name: true } } } }),
    prisma.practiceLog.findMany({
      where: { user_id: user.id, practice_date: { gte: startOf14DaysAgo, lte: endOfToday } },
      select: { subject_id: true, topic: true, unit_id: true, unit: { select: { name: true } }, total_questions: true, correct_questions: true },
    }),
    prisma.reviewTask.findMany({
      where: { user_id: user.id, completed: false, review_date: { lte: endOfToday }, subject_id: { not: null } },
      select: { subject_id: true, topic: true, unit_id: true, unit: { select: { name: true } } },
    }),
    prisma.wrongQuestion.findMany({
      where: { user_id: user.id, status: { not: "MASTERED" } },
      select: { subject_id: true, topic: true, unit_id: true, unit: { select: { name: true } } },
    }),
    prisma.studyLog.findMany({ where: { user_id: user.id }, select: { subject_id: true, study_date: true } }),
    prisma.practiceLog.findMany({ where: { user_id: user.id }, select: { subject_id: true, practice_date: true } }),
    prisma.vocabularyReviewLog.findMany({ where: { user_id: user.id }, select: { list_id: true, created_at: true } }),
  ])

  const [studyLogs14dBySubject, lastWeekAgg, admissionEvalSafe] = await Promise.all([
    prisma.studyLog.groupBy({
      by: ["subject_id"],
      where: { user_id: user.id, study_date: { gte: startOf14DaysAgo, lte: endOfToday } },
      _sum: { duration_minutes: true },
    }),
    prisma.studyLog.aggregate({
      where: { user_id: user.id, study_date: { gte: startOf14DaysAgo, lt: startOf7DaysAgo } },
      _sum: { duration_minutes: true },
    }),
    getAdmissionEvaluationV2().catch(() => null),
  ])

  const todaysStudyMinutes = todaysStudy._sum.duration_minutes || 0
  const todaysAccuracy = todaysPractice._sum.total_questions
    ? Math.round((todaysPractice._sum.correct_questions! / todaysPractice._sum.total_questions) * 100)
    : null
  const subjectNameMap = new Map(subjects.map((subject) => [subject.id, subject.name]))

  const rawMinutes7dBySubject = new Map<string, number>()
  const effectiveMinutes7dBySubject = new Map<string, number>()
  const recentStudyByArea = new Map<string, number>()
  for (const log of studyLogs7dRaw) {
    const raw = log.duration_minutes || 0
    rawMinutes7dBySubject.set(log.subject_id, (rawMinutes7dBySubject.get(log.subject_id) || 0) + raw)
    effectiveMinutes7dBySubject.set(
      log.subject_id,
      (effectiveMinutes7dBySubject.get(log.subject_id) || 0) + raw * focusMultiplier(log.focus_score) * studyTypeMultiplier(log.study_type)
    )
    const areaKey = makeAreaKey(log.subject_id, log.unit_id, log.unit?.name ?? null, log.topic)
    recentStudyByArea.set(areaKey, (recentStudyByArea.get(areaKey) || 0) + raw)
  }

  const subjectHours: SubjectHoursItem[] = Array.from(rawMinutes7dBySubject.entries()).map(([subjectId, minutes]) => ({
    subject: subjectNameMap.get(subjectId) || "未知科目",
    minutes,
  }))

  const nextReviewFocus: DashboardReviewFocusItem[] = nextReviewFocusRaw
    .filter((r): r is typeof r & { subject: { id: string; name: string } } => r.subject !== null)
    .map((r) => ({
      id: r.id,
      topic: resolveAreaLabel(r.unit_id, r.unit?.name ?? null, r.topic),
      unitId: r.unit_id,
      unitName: r.unit?.name ?? null,
      reviewDate: r.review_date,
      reviewStage: r.review_stage,
      subject: r.subject,
    }))

  const vocabularyStatsByList = new Map<string, { total: number; familiar: number; due: number }>()
  for (const word of vocabularyWords) {
    const current = vocabularyStatsByList.get(word.list_id) || { total: 0, familiar: 0, due: 0 }
    current.total += 1
    if (word.status === "FAMILIAR") current.familiar += 1
    if (word.next_review_date && word.next_review_date <= endOfToday) current.due += 1
    vocabularyStatsByList.set(word.list_id, current)
  }

  const vocabularyOverview: DashboardVocabularyOverview = {
    totalWords: vocabularyWords.length,
    dueWords: vocabularyWords.filter((word) => word.next_review_date && word.next_review_date <= endOfToday).length,
    familiarRate: vocabularyWords.length > 0 ? Math.round((vocabularyWords.filter((word) => word.status === "FAMILIAR").length / vocabularyWords.length) * 100) : null,
    reviewedThisWeek: vocabularyReviewedThisWeek,
    activeLists: Array.from(vocabularyStatsByList.values()).filter((item) => item.total > 0).length,
  }

  const lastActivityByList = new Map<string, Date>()
  mergeLastActivity(lastActivityByList, vocabularyReviewLastByListRaw, (item) => item.list_id ?? "", (item) => item.created_at)

  const vocabularyListStats: DashboardVocabularyListItem[] = vocabularyLists.map((list) => {
    const stats = vocabularyStatsByList.get(list.id) || { total: 0, familiar: 0, due: 0 }
    const lastActivity = lastActivityByList.get(list.id)
    const lastActivityDays = lastActivity ? differenceInCalendarDays(endOfToday, getStartOfDayInTaipeiUTC(lastActivity)) : null
    return {
      listId: list.id,
      listName: list.name,
      totalWords: stats.total,
      dueWords: stats.due,
      familiarWords: stats.familiar,
      familiarRate: stats.total > 0 ? Math.round((stats.familiar / stats.total) * 100) : null,
      lastActivityDays,
    }
  }).sort((a, b) => b.dueWords - a.dueWords || b.totalWords - a.totalWords || a.listName.localeCompare(b.listName, "zh-Hant"))

  const lastActivityBySubject = new Map<string, Date>()
  mergeLastActivity(lastActivityBySubject, studyAllRaw, (item) => item.subject_id, (item) => item.study_date)
  mergeLastActivity(lastActivityBySubject, practiceAllRaw, (item) => item.subject_id, (item) => item.practice_date)

  const areaAnalysis = buildAreaAnalysis({
    subjects,
    questionAreasRaw: mapAreaSeeds(questionAreasRaw),
    studyAreaAllRaw: mapAreaSeeds(studyAreaAllRaw),
    practiceAreaAllRaw: mapAreaSeeds(practiceAreaAllRaw),
    reviewAreaAllRaw: mapAreaSeeds(reviewAreaAllRaw),
    wrongAreaAllRaw: mapAreaSeeds(wrongAreaAllRaw),
    recentStudyByArea,
    practice14dRaw: practice14dRaw.map((item) => ({ ...item, unit_name: item.unit?.name ?? null })),
    reviewDueRaw: mapAreaSeeds(reviewDueRaw),
    wrongOpenRaw: mapAreaSeeds(wrongOpenRaw),
    daysUntilExam,
  })

  const subjectReadiness: DashboardSubjectReadinessItem[] = subjects.map((subject) => {
    const subjectAreas = areaAnalysis.subjectTopicSections.find((item) => item.subjectId === subject.id)?.topics ?? []
    const studyMinutes7d = rawMinutes7dBySubject.get(subject.id) || 0
    const dueReviews = subjectAreas.reduce((sum, area) => sum + area.dueReviews, 0)
    const unresolvedWrongCount = subjectAreas.reduce((sum, area) => sum + area.wrongCount, 0)
    const practiceQuestions14d = subjectAreas.reduce((sum, area) => sum + area.practiceCount14d, 0)
    const weightedCorrect = subjectAreas.reduce((sum, area) => {
      if (area.practiceAccuracy14d === null) return sum
      return sum + (area.practiceAccuracy14d / 100) * area.practiceCount14d
    }, 0)
    const practiceAccuracy14d = practiceQuestions14d > 0 ? Math.round((weightedCorrect / practiceQuestions14d) * 100) : null
    const coveredAreas = subjectAreas.filter((item) => item.hasActivity).length
    const totalAreas = subjectAreas.length
    const coverageScore = totalAreas > 0 ? Math.round((coveredAreas / totalAreas) * 100) : 0

    const lastActivity = lastActivityBySubject.get(subject.id)
    const lastActivityDays = lastActivity ? differenceInCalendarDays(endOfToday, getStartOfDayInTaipeiUTC(lastActivity)) : null
    const recencyScore = getRecencyScore(lastActivityDays)
    const memoryScore = clampScore(
      Math.round((subjectAreas.length > 0 ? average(subjectAreas.map((item) => item.memoryScore)) : recencyScore) * 0.8 + recencyScore * 0.2)
    )
    const studyScore = scaleToScore(effectiveMinutes7dBySubject.get(subject.id) || 0, SUBJECT_WEEKLY_TARGET_MINUTES)
    const accuracyScore = practiceAccuracy14d ?? (studyMinutes7d > 0 ? 45 : dueReviews > 0 || unresolvedWrongCount > 0 ? 35 : 20)
    const score = clampScore(Math.round(studyScore * 0.25 + accuracyScore * 0.35 + memoryScore * 0.25 + coverageScore * 0.15))
    const weakTopic = areaAnalysis.weakestAreas.find((item) => item.subjectId === subject.id)?.topic || null
    const factors: ReadinessFactorBreakdown = {
      studyScore,
      accuracyScore,
      memoryScore,
      coverageScore,
      penaltyReason: getPenaltyReason({ practiceAccuracy14d, dueReviews, wrongCount: unresolvedWrongCount, hasActivity: studyMinutes7d > 0 || practiceQuestions14d > 0, hasQuestionBank: totalAreas > 0 }),
    }

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      score,
      level: getReadinessLevel(score, daysUntilExam),
      momentum: getMomentum({ practiceAccuracy14d, dueReviews, unresolvedWrongCount, studyMinutes7d }),
      studyMinutes7d,
      practiceAccuracy14d,
      practiceCount14d: practiceQuestions14d,
      dueReviews,
      unresolvedWrongCount,
      lastActivityDays,
      weakTopic,
      suggestedAction: getSuggestedAction({ subjectName: subject.name, studyMinutes7d, practiceAccuracy14d, dueReviews, unresolvedWrongCount, weakTopic, hasPracticeData: practiceQuestions14d > 0 }),
      factors,
    }
  }).sort((a, b) => a.score - b.score || a.subjectName.localeCompare(b.subjectName, "zh-Hant"))

  const subjectOrder = new Map(subjectReadiness.map((item, index) => [item.subjectId, index]))
  const subjectCoverage = [...areaAnalysis.subjectCoverage].sort((a, b) => (subjectOrder.get(a.subjectId) ?? 999) - (subjectOrder.get(b.subjectId) ?? 999))
  const subjectTopicSections = [...areaAnalysis.subjectTopicSections].sort((a, b) => (subjectOrder.get(a.subjectId) ?? 999) - (subjectOrder.get(b.subjectId) ?? 999))

  const todayPlan = buildTodayPlan({ pendingReviews, todaysStudyMinutes, weakestAreas: areaAnalysis.weakestAreas, nextReviewFocus, subjectReadiness })

  const onboardingSteps: DashboardOnboardingStep[] = [
    { id: "subjects", title: "先建立科目", description: "先把主科建好，後面的統計才有依據。", href: "/settings", completed: subjects.length > 0 },
    { id: "exam-date", title: "設定考試日期", description: "讓首頁開始顯示倒數與衝刺節奏。", href: "/settings", completed: user.exam_date !== null },
    { id: "import-materials", title: "匯入題目或單字", description: "先把題庫或單字丟進來，系統才能判斷弱點。", href: "/import", completed: questionAreasRaw.length > 0 || vocabularyWords.length > 0 },
    { id: "start-first-session", title: "開始第一次練習 / 讀書 session", description: "有第一筆紀錄後，Dashboard 才會真的有用。", href: questionAreasRaw.length > 0 ? "/practice" : "/study-log", completed: studyDates.length > 0 || Boolean(practiceLogExists) },
  ]

  const studyDatesUnique = Array.from(new Set(studyDates.map((item) => getStartOfDayInTaipeiUTC(item.study_date).toISOString()))).map((iso) => new Date(iso))
  let streakDays = 0
  let previousDay: Date | null = null
  for (const day of studyDatesUnique) {
    if (previousDay === null) {
      if (differenceInCalendarDays(startOfToday, day) > 1) break
      streakDays = 1
      previousDay = day
      continue
    }
    if (differenceInCalendarDays(previousDay, day) === 1) {
      streakDays += 1
      previousDay = day
      continue
    }
    break
  }

  const completedToday = todaysStudyMinutes > 0 && pendingReviews === 0
  const lowestReadiness = subjectReadiness[0]
  const isExamPassed = daysUntilExam !== null && daysUntilExam < 0
  const isExamVeryClose = daysUntilExam !== null && daysUntilExam <= 14 && daysUntilExam >= 0
  const isExamSoon = daysUntilExam !== null && daysUntilExam <= 30 && daysUntilExam >= 0

  let recommendation = "先開始今天第一段學習，系統才有辦法幫你判斷準備狀態。"
  if (isExamPassed) recommendation = "考試日已過，記得更新新的目標日期。"
  else if (todayPlan[0]) recommendation = `${todayPlan[0].title}：${todayPlan[0].description}`
  else if (pendingReviews > 0 && isExamVeryClose) recommendation = `距離考試只剩 ${daysUntilExam} 天，先清掉 ${pendingReviews} 個到期複習。`
  else if (pendingReviews > 0) recommendation = `先處理 ${pendingReviews} 個到期複習，別讓記憶債繼續累積。`
  else if (lowestReadiness && isExamSoon) recommendation = `考前這段時間，優先拉回 ${lowestReadiness.subjectName} 的準備度。`
  else if (todaysAccuracy !== null && todaysAccuracy < 70) recommendation = "今天正確率偏低，先回頭整理錯題與觀念。"
  else if (todaysStudyMinutes === 0 && isExamVeryClose) recommendation = `距離考試只剩 ${daysUntilExam} 天，今天至少先完成一段專注讀書和一組題目。`
  else if (todaysStudyMinutes === 0 && isExamSoon) recommendation = "考前這段時間要維持手感，今天先開一段專注 session。"
  else if (todaysAccuracy === null) recommendation = "今天已有投入，接下來補一組題目，讓系統開始校準你的表現。"
  else recommendation = "今天節奏不錯，清完待辦後可以再做一組題目鞏固手感。"

  const studyByDateKey = new Map(last7DaysStudy.map((s) => [formatShortDateInTaipei(new Date(s.study_date)), s._sum.duration_minutes || 0]))
  const trendData: DashboardTrendPoint[] = Array.from({ length: 7 }, (_, i) => {
    const day = getStartOfDaysAgoUTC(6 - i)
    const dateKey = formatShortDateInTaipei(day)
    return { date: dateKey, minutes: studyByDateKey.get(dateKey) || 0 }
  })

  let hasData = subjects.length > 0 || todaysStudyMinutes > 0
  if (!hasData) {
    const [hasStudy, hasPractice, hasReview, hasQuestion] = await Promise.all([
      prisma.studyLog.findFirst({ where: { user_id: user.id }, select: { id: true } }),
      prisma.practiceLog.findFirst({ where: { user_id: user.id }, select: { id: true } }),
      prisma.reviewTask.findFirst({ where: { user_id: user.id }, select: { id: true } }),
      prisma.question.findFirst({ where: { user_id: user.id }, select: { id: true } }),
    ])
    hasData = !!(hasStudy || hasPractice || hasReview || hasQuestion)
  }

  const thisWeekMinutes = trendData.reduce((sum, point) => sum + point.minutes, 0)
  const lastWeekMinutes = lastWeekAgg._sum.duration_minutes || 0

  const readinessScoreBySubject = new Map(
    subjectReadiness.map((item) => [item.subjectId, item.score]),
  )
  const subjectMastery14d: DashboardSubjectMasteryItem[] = studyLogs14dBySubject
    .map((entry) => ({
      subjectId: entry.subject_id,
      subjectName: subjectNameMap.get(entry.subject_id) || "未知科目",
      minutes14d: entry._sum.duration_minutes || 0,
      masteryRate: readinessScoreBySubject.get(entry.subject_id) ?? 0,
    }))
    .sort((a, b) => b.minutes14d - a.minutes14d || a.subjectName.localeCompare(b.subjectName, "zh-Hant"))
  for (const subject of subjects) {
    if (!subjectMastery14d.some((item) => item.subjectId === subject.id)) {
      subjectMastery14d.push({
        subjectId: subject.id,
        subjectName: subject.name,
        minutes14d: 0,
        masteryRate: readinessScoreBySubject.get(subject.id) ?? 0,
      })
    }
  }

  let admissionSummary: DashboardAdmissionSummary | null = null
  if (
    admissionEvalSafe &&
    admissionEvalSafe.targetProgram &&
    admissionEvalSafe.admissionLevel &&
    admissionEvalSafe.gaps
  ) {
    admissionSummary = {
      schoolName: admissionEvalSafe.targetProgram.schoolName,
      departmentName: admissionEvalSafe.targetProgram.departmentName,
      admissionLevel: admissionEvalSafe.admissionLevel,
      confidenceLevel: admissionEvalSafe.confidenceLevel,
      gapVsLastYearLine: admissionEvalSafe.gaps.vsLastYearLine,
    }
  }

  return {
    daysUntilExam,
    todaysStudyMinutes,
    todaysAccuracy,
    pendingReviews,
    streakDays,
    completedToday,
    dailyStudyGoalMinutes: DAILY_STUDY_GOAL_MINUTES,
    thisWeekMinutes,
    lastWeekMinutes,
    trendData,
    subjectHours,
    weakTopics,
    nextReviewFocus,
    subjectReadiness,
    subjectMastery14d,
    vocabularyListStats,
    weakestAreas: areaAnalysis.weakestAreas,
    subjectCoverage,
    subjectTopicSections,
    todayPlan,
    onboardingSteps,
    vocabularyOverview,
    admissionSummary,
    recommendation,
    hasData,
  }
}

function buildAreaAnalysis({ subjects, questionAreasRaw, studyAreaAllRaw, practiceAreaAllRaw, reviewAreaAllRaw, wrongAreaAllRaw, recentStudyByArea, practice14dRaw, reviewDueRaw, wrongOpenRaw, daysUntilExam }: {
  subjects: SubjectSummary[]
  questionAreasRaw: AreaSeed[]
  studyAreaAllRaw: AreaSeed[]
  practiceAreaAllRaw: AreaSeed[]
  reviewAreaAllRaw: AreaSeed[]
  wrongAreaAllRaw: AreaSeed[]
  recentStudyByArea: Map<string, number>
  practice14dRaw: Array<AreaSeed & { total_questions: number; correct_questions: number }>
  reviewDueRaw: AreaSeed[]
  wrongOpenRaw: AreaSeed[]
  daysUntilExam: number | null
}): { weakestAreas: DashboardWeakAreaItem[]; subjectCoverage: DashboardSubjectCoverageItem[]; subjectTopicSections: DashboardSubjectTopicSectionItem[] } {
  const questionAreaSet = buildAreaKeySet(questionAreasRaw)
  const activityAreaSet = buildAreaKeySet([...studyAreaAllRaw, ...practiceAreaAllRaw, ...reviewAreaAllRaw, ...wrongAreaAllRaw])
  const totalAreaKeysBySubject = new Map<string, Map<string, { unitId: string | null; label: string }>>()
  addAreaKeysBySubject(totalAreaKeysBySubject, questionAreasRaw)
  addAreaKeysBySubject(totalAreaKeysBySubject, studyAreaAllRaw)
  addAreaKeysBySubject(totalAreaKeysBySubject, practiceAreaAllRaw)
  addAreaKeysBySubject(totalAreaKeysBySubject, reviewAreaAllRaw)
  addAreaKeysBySubject(totalAreaKeysBySubject, wrongAreaAllRaw)

  const recentPracticeByArea = new Map<string, { totalQuestions: number; correctQuestions: number }>()
  for (const item of practice14dRaw) {
    const key = makeAreaKey(item.subject_id, item.unit_id, item.unit_name, item.topic)
    const current = recentPracticeByArea.get(key) || { totalQuestions: 0, correctQuestions: 0 }
    current.totalQuestions += item.total_questions || 0
    current.correctQuestions += item.correct_questions || 0
    recentPracticeByArea.set(key, current)
  }
  const dueReviewsByArea = countByArea(reviewDueRaw)
  const wrongCountByArea = countByArea(wrongOpenRaw)

  const allAreaDetails: DashboardTopicDetailItem[] = []
  const subjectCoverage: DashboardSubjectCoverageItem[] = []
  const subjectTopicSections: DashboardSubjectTopicSectionItem[] = []

  for (const subject of subjects) {
    const areaEntries = Array.from(totalAreaKeysBySubject.get(subject.id)?.entries() || []).sort((a, b) => a[1].label.localeCompare(b[1].label, "zh-Hant"))
    const topicDetails = areaEntries.map(([key, meta]) => buildAreaDetail({ key, subjectId: subject.id, subjectName: subject.name, label: meta.label, questionAreaSet, activityAreaSet, recentStudyByArea, recentPracticeByArea, dueReviewsByArea, wrongCountByArea, daysUntilExam }))
      .sort((a, b) => a.score - b.score || b.dueReviews - a.dueReviews || b.wrongCount - a.wrongCount || a.topic.localeCompare(b.topic, "zh-Hant"))

    const coveredTopics = topicDetails.filter((item) => item.hasActivity).length
    const activeTopics = topicDetails.filter((item) => item.studyMinutes7d > 0 || item.practiceCount14d > 0 || item.dueReviews > 0 || item.wrongCount > 0).length
    const totalTopics = topicDetails.length
    const weakTopic = topicDetails[0]?.topic || null
    const coverage: DashboardSubjectCoverageItem = {
      subjectId: subject.id,
      subjectName: subject.name,
      totalTopics,
      coveredTopics,
      untouchedTopics: Math.max(0, totalTopics - coveredTopics),
      activeTopics,
      coverageRate: totalTopics > 0 ? Math.round((coveredTopics / totalTopics) * 100) : 0,
      weakTopic,
    }

    subjectCoverage.push(coverage)
    subjectTopicSections.push({ subjectId: subject.id, subjectName: subject.name, coverage, topics: topicDetails })
    allAreaDetails.push(...topicDetails)
  }

  const weakestAreas: DashboardWeakAreaItem[] = allAreaDetails.filter((item) => item.hasActivity || item.hasQuestionBank).map((item): DashboardWeakAreaItem => ({
    key: item.key,
    subjectId: item.subjectId,
    subjectName: item.subjectName,
    topic: item.topic,
    score: item.score,
    practiceAccuracy: item.practiceAccuracy14d,
    wrongCount: item.wrongCount,
    dueReviews: item.dueReviews,
    studyMinutes7d: item.studyMinutes7d,
    priority: item.score < 50 || item.dueReviews >= 2 || item.wrongCount >= 3 || !item.hasActivity ? "high" : item.score < 70 || item.dueReviews > 0 || item.wrongCount > 0 ? "medium" : "low",
    note: item.note,
    factors: { studyScore: item.studyScore, accuracyScore: item.accuracyScore, memoryScore: item.memoryScore, coverageScore: item.coverageScore, penaltyReason: item.penaltyReason },
  })).sort((a, b) => a.score - b.score || b.dueReviews - a.dueReviews || b.wrongCount - a.wrongCount || a.subjectName.localeCompare(b.subjectName, "zh-Hant")).slice(0, 6)

  return { weakestAreas, subjectCoverage, subjectTopicSections }
}

function buildAreaDetail({ key, subjectId, subjectName, label, questionAreaSet, activityAreaSet, recentStudyByArea, recentPracticeByArea, dueReviewsByArea, wrongCountByArea, daysUntilExam }: {
  key: string
  subjectId: string
  subjectName: string
  label: string
  questionAreaSet: Set<string>
  activityAreaSet: Set<string>
  recentStudyByArea: Map<string, number>
  recentPracticeByArea: Map<string, { totalQuestions: number; correctQuestions: number }>
  dueReviewsByArea: Map<string, number>
  wrongCountByArea: Map<string, number>
  daysUntilExam: number | null
}): DashboardTopicDetailItem {
  const studyMinutes7d = recentStudyByArea.get(key) || 0
  const practiceStats = recentPracticeByArea.get(key) || { totalQuestions: 0, correctQuestions: 0 }
  const practiceAccuracy14d = practiceStats.totalQuestions > 0 ? Math.round((practiceStats.correctQuestions / practiceStats.totalQuestions) * 100) : null
  const dueReviews = dueReviewsByArea.get(key) || 0
  const wrongCount = wrongCountByArea.get(key) || 0
  const hasActivity = activityAreaSet.has(key)
  const hasQuestionBank = questionAreaSet.has(key)
  const studyScore = scaleToScore(studyMinutes7d, UNIT_WEEKLY_TARGET_MINUTES)
  const accuracyScore = practiceAccuracy14d ?? (hasActivity ? (studyMinutes7d > 0 ? 58 : 48) : 30)
  const memoryScore = clampScore(100 - dueReviews * 25 - wrongCount * 18)
  const coverageScore = hasActivity ? 100 : hasQuestionBank ? 20 : 50
  const score = clampScore(Math.round(accuracyScore * 0.45 + studyScore * 0.2 + memoryScore * 0.25 + coverageScore * 0.1))
  const penaltyReason = getPenaltyReason({ practiceAccuracy14d, dueReviews, wrongCount, hasActivity, hasQuestionBank })
  let note = "最近有接觸，但還沒穩定。"
  if (!hasActivity && hasQuestionBank) note = `題庫裡有這個單元，但你還沒正式碰過。`
  else if (dueReviews > 0) note = `有 ${dueReviews} 個到期複習卡住。`
  else if (wrongCount > 0) note = `還有 ${wrongCount} 題未掌握錯題。`
  else if (practiceAccuracy14d !== null) note = `最近 14 天正確率 ${practiceAccuracy14d}%。`
  else if (studyMinutes7d > 0) note = `這週已投入 ${studyMinutes7d} 分鐘，接下來該補做題回饋。`
  else if (hasActivity) note = "以前碰過，但最近有點冷掉了。"

  return { key, subjectId, subjectName, topic: label, score, status: getReadinessLevel(score, daysUntilExam), studyMinutes7d, practiceAccuracy14d, practiceCount14d: practiceStats.totalQuestions, dueReviews, wrongCount, hasActivity, hasQuestionBank, note, studyScore, accuracyScore, memoryScore, coverageScore, penaltyReason }
}

function buildTodayPlan({ pendingReviews, todaysStudyMinutes, weakestAreas, nextReviewFocus, subjectReadiness }: { pendingReviews: number; todaysStudyMinutes: number; weakestAreas: DashboardWeakAreaItem[]; nextReviewFocus: DashboardReviewFocusItem[]; subjectReadiness: DashboardSubjectReadinessItem[] }): DashboardPlanItem[] {
  const candidates: DashboardPlanItem[] = []
  const firstDueReview = nextReviewFocus[0]
  if (firstDueReview) candidates.push({ id: `review-${firstDueReview.id}`, title: `先清 ${firstDueReview.subject.name} 的到期複習`, description: `${firstDueReview.topic} 已到複習日，先把最容易掉分的記憶債清掉。`, reason: pendingReviews > 1 ? `目前還有 ${pendingReviews} 個到期任務。` : "今天有到期複習任務。", href: "/review", tone: "danger" })
  const weakestArea = weakestAreas[0]
  if (weakestArea) candidates.push({ id: `weak-${weakestArea.key}`, title: `補強 ${weakestArea.subjectName}・${weakestArea.topic}`, description: weakestArea.practiceAccuracy !== null ? `${weakestArea.subjectName}・${weakestArea.topic} 最近正確率 ${weakestArea.practiceAccuracy}%，先補這塊最有感。` : `${weakestArea.subjectName}・${weakestArea.topic} 還沒真正覆蓋，先碰這塊避免考前留下空白。`, reason: weakestArea.note, href: "/practice", tone: weakestArea.priority === "high" ? "warning" : "focus" })
  const lowestReadiness = subjectReadiness[0]
  if (lowestReadiness) candidates.push({ id: `readiness-${lowestReadiness.subjectId}`, title: `拉回 ${lowestReadiness.subjectName} 的準備度`, description: lowestReadiness.suggestedAction, reason: `目前準備度 ${lowestReadiness.score} 分。`, href: lowestReadiness.dueReviews > 0 ? "/review" : "/practice", tone: lowestReadiness.score < 50 ? "danger" : "focus" })
  if (todaysStudyMinutes === 0) candidates.push({ id: "start-study-session", title: "先開今天第一段專注讀書", description: "先把 30–60 分鐘讀書打開，後面的做題和複習才會跟上。", reason: "今天還沒有學習紀錄。", href: "/study-log", tone: "focus" })
  if (candidates.length === 0) candidates.push({ id: "keep-momentum", title: "維持今天的手感", description: "複習已經不擠了，接下來做一組題目確認自己的穩定度。", reason: "今天節奏算健康。", href: "/practice", tone: "success" })
  return dedupePlanItems(candidates).slice(0, 3)
}

function mergeLastActivity<T>(map: Map<string, Date>, items: T[], getKey: (item: T) => string, getDate: (item: T) => Date | null) {
  for (const item of items) {
    const key = getKey(item)
    const value = getDate(item)
    if (!value) continue
    const previous = map.get(key)
    if (!previous || previous < value) map.set(key, value)
  }
}

function dedupePlanItems(items: DashboardPlanItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.title}::${item.href}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getSuggestedAction({ subjectName, studyMinutes7d, practiceAccuracy14d, dueReviews, unresolvedWrongCount, weakTopic, hasPracticeData }: { subjectName: string; studyMinutes7d: number; practiceAccuracy14d: number | null; dueReviews: number; unresolvedWrongCount: number; weakTopic: string | null; hasPracticeData: boolean }) {
  if (dueReviews > 0) return `先清掉 ${dueReviews} 個到期複習，別讓 ${subjectName} 的記憶債繼續堆。`
  if (practiceAccuracy14d !== null && practiceAccuracy14d < 60) return weakTopic ? `先回頭補 ${weakTopic}，做少量題目確認觀念，不要直接硬刷。` : "先整理錯題與觀念，再做一組小測。"
  if (unresolvedWrongCount >= 4 && weakTopic) return `錯題壓力偏高，先處理 ${weakTopic} 的未掌握題目。`
  if (!hasPracticeData) return `先做一組 ${subjectName} 題目，讓系統開始判斷你的表現。`
  if (studyMinutes7d < 120) return "這週投入偏少，先補一段 45–60 分鐘專注讀書。"
  return weakTopic ? `維持節奏，接著補一組 ${weakTopic} 題目確認手感。` : "維持節奏，做一組題目確認這科的穩定度。"
}

function getMomentum({ practiceAccuracy14d, dueReviews, unresolvedWrongCount, studyMinutes7d }: { practiceAccuracy14d: number | null; dueReviews: number; unresolvedWrongCount: number; studyMinutes7d: number }): DashboardSubjectReadinessItem["momentum"] {
  if ((practiceAccuracy14d !== null && practiceAccuracy14d >= 75 && dueReviews <= 2 && unresolvedWrongCount <= 3) || (practiceAccuracy14d === null && studyMinutes7d >= 180 && dueReviews === 0)) return "up"
  if ((practiceAccuracy14d !== null && practiceAccuracy14d < 60) || dueReviews >= 4 || unresolvedWrongCount >= 6) return "down"
  return "steady"
}

function getReadinessLevel(score: number, daysUntilExam?: number | null): DashboardSubjectReadinessItem["level"] {
  let strongThreshold = 80, steadyThreshold = 65, warningThreshold = 50
  if (daysUntilExam !== null && daysUntilExam !== undefined && daysUntilExam >= 0) {
    if (daysUntilExam <= 7) { strongThreshold = 90; steadyThreshold = 78; warningThreshold = 65 }
    else if (daysUntilExam <= 14) { strongThreshold = 87; steadyThreshold = 74; warningThreshold = 60 }
    else if (daysUntilExam <= 30) { strongThreshold = 83; steadyThreshold = 70; warningThreshold = 55 }
  }
  if (score >= strongThreshold) return "strong"
  if (score >= steadyThreshold) return "steady"
  if (score >= warningThreshold) return "warning"
  return "danger"
}

function getRecencyScore(lastActivityDays: number | null) {
  if (lastActivityDays === null) return 20
  return Math.max(20, Math.round(100 * Math.exp(-0.069 * lastActivityDays)))
}

function focusMultiplier(focusScore: number) { return ({ 1: 0.6, 2: 0.75, 3: 0.9, 4: 1.0, 5: 1.15 } as Record<number, number>)[focusScore] ?? 1.0 }
function studyTypeMultiplier(studyType: string) { return ({ "做題": 1.2, "複習": 1.1, "上課": 1.0, "看書": 0.85 } as Record<string, number>)[studyType] ?? 1.0 }
function scaleToScore(value: number, target: number) { return target <= 0 ? 0 : clampScore(Math.round((value / target) * 100)) }
function clampScore(value: number) { return Math.max(0, Math.min(100, value)) }
function normalizeTopic(topic: string) { const normalized = topic.trim().replace(/\s+/g, " "); return normalized.length > 0 ? normalized : "未分類" }
function normalizeAreaLabel(label: string) { return normalizeTopic(label).replace(/^題庫練習（\d+ 個單元）$/, "未分類") }
function resolveAreaLabel(unitId: string | null, unitName: string | null, topic: string) { return unitId ? normalizeTopic(unitName || topic) : normalizeAreaLabel(topic) }
function makeAreaKey(subjectId: string, unitId: string | null, unitName: string | null, topic: string) { const label = resolveAreaLabel(unitId, unitName, topic); return unitId ? `${subjectId}::unit:${unitId}` : `${subjectId}::topic:${label}` }
function buildAreaKeySet(items: AreaSeed[]) { return new Set(items.map((item) => makeAreaKey(item.subject_id, item.unit_id, item.unit_name, item.topic))) }
function addAreaKeysBySubject(map: Map<string, Map<string, { unitId: string | null; label: string }>>, items: AreaSeed[]) { for (const item of items) { const key = makeAreaKey(item.subject_id, item.unit_id, item.unit_name, item.topic); const current = map.get(item.subject_id) || new Map<string, { unitId: string | null; label: string }>(); current.set(key, { unitId: item.unit_id, label: resolveAreaLabel(item.unit_id, item.unit_name, item.topic) }); map.set(item.subject_id, current) } }
function countByArea(items: AreaSeed[]) { const map = new Map<string, number>(); for (const item of items) { const key = makeAreaKey(item.subject_id, item.unit_id, item.unit_name, item.topic); map.set(key, (map.get(key) || 0) + 1) } return map }
function getPenaltyReason({ practiceAccuracy14d, dueReviews, wrongCount, hasActivity, hasQuestionBank }: { practiceAccuracy14d: number | null; dueReviews: number; wrongCount: number; hasActivity: boolean; hasQuestionBank: boolean }) {
  if (!hasActivity && hasQuestionBank) return "這個單元還沒正式覆蓋"
  if (dueReviews > 0) return `有 ${dueReviews} 個到期複習未清`
  if (wrongCount > 0) return `還有 ${wrongCount} 題未掌握錯題`
  if (practiceAccuracy14d !== null && practiceAccuracy14d < 60) return `近 14 天正確率只有 ${practiceAccuracy14d}%`
  return null
}
function average(values: number[]) { return values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0 }
function mapAreaSeeds(items: Array<{ subject_id: string | null; topic: string; unit_id: string | null; unit?: { name: string } | null }>): AreaSeed[] {
  return items
    .filter((item): item is typeof item & { subject_id: string } => item.subject_id !== null)
    .map((item) => ({ subject_id: item.subject_id, topic: item.topic, unit_id: item.unit_id ?? null, unit_name: item.unit?.name ?? null }))
}