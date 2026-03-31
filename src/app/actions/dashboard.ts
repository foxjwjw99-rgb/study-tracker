"use server"

import prisma from "@/lib/prisma"
import { getCurrentUserOrThrow } from "@/lib/current-user"
import {
  differenceInCalendarDays,
  differenceInDays,
  endOfDay,
  startOfDay,
  subDays,
} from "date-fns"

import type {
  DashboardData,
  DashboardOnboardingStep,
  DashboardPlanItem,
  DashboardReviewFocusItem,
  DashboardSubjectCoverageItem,
  DashboardSubjectReadinessItem,
  DashboardSubjectTopicSectionItem,
  DashboardTopicDetailItem,
  DashboardTrendPoint,
  DashboardVocabularyOverview,
  DashboardWeakAreaItem,
  SubjectHoursItem,
} from "@/types"

const SUBJECT_WEEKLY_TARGET_MINUTES = 240
const TOPIC_WEEKLY_TARGET_MINUTES = 120

const STUDY_TYPE_MULTIPLIER: Record<string, number> = {
  "做題": 1.4,
  "複習": 1.2,
  "看書": 1.0,
  "上課": 1.0,
}

type StudyLogRawItem = {
  subject_id: string
  topic: string
  duration_minutes: number
  focus_score: number
  study_type: string
}

function getEffectiveMinutes(item: StudyLogRawItem): number {
  const typeMultiplier = STUDY_TYPE_MULTIPLIER[item.study_type] ?? 1.0
  const focusMultiplier = item.focus_score / 5
  return item.duration_minutes * typeMultiplier * focusMultiplier
}

type SubjectSummary = {
  id: string
  name: string
}

type TopicAccumulator = {
  key: string
  subjectId: string
  subjectName: string
  topic: string
  studyMinutes7d: number
  totalQuestions: number
  correctQuestions: number
  wrongCount: number
  dueReviews: number
}

type TopicGroupRow = {
  subject_id: string
  topic: string
}

type TopicPracticeRow = {
  subject_id: string
  topic: string
  _sum: {
    total_questions: number | null
    correct_questions: number | null
  }
}

type TopicCountRow = {
  subject_id: string
  topic: string
  _count: {
    _all: number
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  const user = await getCurrentUserOrThrow()
  const today = new Date()
  const startOfToday = startOfDay(today)
  const endOfToday = endOfDay(today)
  const startOf7DaysAgo = startOfDay(subDays(today, 6))
  const startOf14DaysAgo = startOfDay(subDays(today, 13))

  const daysUntilExam = user.exam_date ? differenceInDays(new Date(user.exam_date), today) : null

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
    subjectPractice14dRaw,
    subjectReviewDueRaw,
    subjectWrongOpenRaw,
    practiceTopic14dRaw,
    reviewTopicDueRaw,
    wrongTopicOpenRaw,
    vocabularyWords,
    vocabularyReviewedThisWeek,
    subjectStudyLastRaw,
    subjectPracticeLastRaw,
    vocabularyReviewLastRaw,
    practiceLogExists,
    questionTopicsRaw,
    studyTopicAllRaw,
    practiceTopicAllRaw,
    reviewTopicAllRaw,
    wrongTopicAllRaw,
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
    prisma.reviewTask.count({
      where: { user_id: user.id, review_date: { lte: endOfToday }, completed: false },
    }),
    prisma.studyLog.groupBy({
      by: ["study_date"],
      where: { user_id: user.id, study_date: { gte: startOf7DaysAgo, lte: endOfToday } },
      _sum: { duration_minutes: true },
    }),
    prisma.studyLog.findMany({
      where: { user_id: user.id, study_date: { gte: startOf7DaysAgo, lte: endOfToday } },
      select: { subject_id: true, topic: true, duration_minutes: true, focus_score: true, study_type: true },
    }),
    prisma.wrongQuestion.findMany({
      where: { user_id: user.id, status: { not: "已掌握" } },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { first_wrong_date: "desc" },
      take: 5,
    }),
    prisma.reviewTask.findMany({
      where: {
        user_id: user.id,
        completed: false,
        review_date: { lte: endOfToday },
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ review_date: "asc" }, { review_stage: "asc" }],
      take: 3,
    }),
    prisma.studyLog.findMany({
      where: { user_id: user.id },
      select: { study_date: true },
      orderBy: { study_date: "desc" },
      take: 365,
    }),
    prisma.practiceLog.groupBy({
      by: ["subject_id"],
      where: { user_id: user.id, practice_date: { gte: startOf14DaysAgo, lte: endOfToday } },
      _sum: { total_questions: true, correct_questions: true },
    }),
    prisma.reviewTask.groupBy({
      by: ["subject_id"],
      where: {
        user_id: user.id,
        completed: false,
        review_date: { lte: endOfToday },
      },
      _count: { _all: true },
    }),
    prisma.wrongQuestion.groupBy({
      by: ["subject_id"],
      where: {
        user_id: user.id,
        status: { not: "已掌握" },
      },
      _count: { _all: true },
    }),
    prisma.practiceLog.groupBy({
      by: ["subject_id", "topic"],
      where: { user_id: user.id, practice_date: { gte: startOf14DaysAgo, lte: endOfToday } },
      _sum: { total_questions: true, correct_questions: true },
    }),
    prisma.reviewTask.groupBy({
      by: ["subject_id", "topic"],
      where: {
        user_id: user.id,
        completed: false,
        review_date: { lte: endOfToday },
      },
      _count: { _all: true },
    }),
    prisma.wrongQuestion.groupBy({
      by: ["subject_id", "topic"],
      where: {
        user_id: user.id,
        status: { not: "已掌握" },
      },
      _count: { _all: true },
    }),
    prisma.vocabularyWord.findMany({
      where: { user_id: user.id },
      select: {
        subject_id: true,
        status: true,
        next_review_date: true,
        ease_factor: true,
        lapse_count: true,
      },
    }),
    prisma.vocabularyReviewLog.count({
      where: {
        user_id: user.id,
        created_at: { gte: startOf7DaysAgo, lte: endOfToday },
      },
    }),
    prisma.studyLog.groupBy({
      by: ["subject_id"],
      where: { user_id: user.id },
      _max: { study_date: true },
    }),
    prisma.practiceLog.groupBy({
      by: ["subject_id"],
      where: { user_id: user.id },
      _max: { practice_date: true },
    }),
    prisma.vocabularyReviewLog.groupBy({
      by: ["subject_id"],
      where: { user_id: user.id },
      _max: { created_at: true },
    }),
    prisma.practiceLog.findFirst({
      where: { user_id: user.id },
      select: { id: true },
    }),
    prisma.question.groupBy({
      by: ["subject_id", "topic"],
      where: { user_id: user.id },
    }),
    prisma.studyLog.groupBy({
      by: ["subject_id", "topic"],
      where: { user_id: user.id },
      _count: { _all: true },
    }),
    prisma.practiceLog.groupBy({
      by: ["subject_id", "topic"],
      where: { user_id: user.id },
      _count: { _all: true },
    }),
    prisma.reviewTask.groupBy({
      by: ["subject_id", "topic"],
      where: { user_id: user.id },
      _count: { _all: true },
    }),
    prisma.wrongQuestion.groupBy({
      by: ["subject_id", "topic"],
      where: { user_id: user.id },
      _count: { _all: true },
    }),
  ])

  const todaysStudyMinutes = todaysStudy._sum.duration_minutes || 0
  const todaysAccuracy = todaysPractice._sum.total_questions
    ? Math.round((todaysPractice._sum.correct_questions! / todaysPractice._sum.total_questions) * 100)
    : null

  const subjectNameMap = new Map(subjects.map((subject) => [subject.id, subject.name]))

  // 原始分鐘（顯示用）
  const rawMinutes7dBySubject = new Map<string, number>()
  const recentStudyByTopic = new Map<string, number>()
  for (const log of studyLogs7dRaw) {
    const mins = log.duration_minutes || 0
    rawMinutes7dBySubject.set(log.subject_id, (rawMinutes7dBySubject.get(log.subject_id) || 0) + mins)
    const topicKey = makeTopicKey(log.subject_id, log.topic)
    recentStudyByTopic.set(topicKey, (recentStudyByTopic.get(topicKey) || 0) + mins)
  }

  const subjectHours: SubjectHoursItem[] = Array.from(rawMinutes7dBySubject.entries()).map(
    ([subjectId, minutes]) => ({
      subject: (subjectNameMap.get(subjectId) || "未知科目") as string,
      minutes,
    })
  )

  const nextReviewFocus: DashboardReviewFocusItem[] = nextReviewFocusRaw.map((r) => ({
    id: r.id,
    topic: r.topic,
    reviewDate: r.review_date,
    reviewStage: r.review_stage,
    subject: r.subject,
  }))

  // 有效分鐘（評分用）：加入專注度與學習類型加權
  const study7dBySubject = new Map<string, number>()
  for (const log of studyLogs7dRaw) {
    const eff = (log.duration_minutes || 0) * focusMultiplier(log.focus_score) * studyTypeMultiplier(log.study_type)
    study7dBySubject.set(log.subject_id, (study7dBySubject.get(log.subject_id) || 0) + eff)
  }
  const practice14dBySubject = new Map(
    subjectPractice14dRaw.map((item) => [
      item.subject_id,
      {
        totalQuestions: item._sum.total_questions || 0,
        correctQuestions: item._sum.correct_questions || 0,
      },
    ])
  )
  const dueReviewsBySubject = new Map(
    subjectReviewDueRaw.map((item) => [item.subject_id, item._count._all])
  )
  const wrongOpenBySubject = new Map(
    subjectWrongOpenRaw.map((item) => [item.subject_id, item._count._all])
  )

  const vocabularyStatsBySubject = new Map<
    string,
    { total: number; familiar: number; due: number; sumEaseFactor: number; sumLapseCount: number }
  >()

  for (const word of vocabularyWords) {
    const current = vocabularyStatsBySubject.get(word.subject_id) || {
      total: 0,
      familiar: 0,
      due: 0,
      sumEaseFactor: 0,
      sumLapseCount: 0,
    }

    current.total += 1
    if (word.status === "FAMILIAR") current.familiar += 1
    if (word.next_review_date && word.next_review_date <= endOfToday) current.due += 1
    current.sumEaseFactor += word.ease_factor ?? 2.5
    current.sumLapseCount += word.lapse_count ?? 0

    vocabularyStatsBySubject.set(word.subject_id, current)
  }

  const vocabularyOverview: DashboardVocabularyOverview = {
    totalWords: vocabularyWords.length,
    dueWords: vocabularyWords.filter((word) => word.next_review_date && word.next_review_date <= endOfToday).length,
    familiarRate:
      vocabularyWords.length > 0
        ? Math.round((vocabularyWords.filter((word) => word.status === "FAMILIAR").length / vocabularyWords.length) * 100)
        : null,
    reviewedThisWeek: vocabularyReviewedThisWeek,
    activeSubjects: Array.from(vocabularyStatsBySubject.values()).filter((item) => item.total > 0).length,
  }

  const lastActivityBySubject = new Map<string, Date>()
  mergeLastActivity(lastActivityBySubject, subjectStudyLastRaw, (item) => item.subject_id, (item) => item._max.study_date)
  mergeLastActivity(lastActivityBySubject, subjectPracticeLastRaw, (item) => item.subject_id, (item) => item._max.practice_date)
  mergeLastActivity(lastActivityBySubject, vocabularyReviewLastRaw, (item) => item.subject_id, (item) => item._max.created_at)

  const topicAnalysis = buildTopicAnalysis({
    subjects,
    questionTopicsRaw,
    studyTopicAllRaw,
    practiceTopicAllRaw,
    reviewTopicAllRaw,
    wrongTopicAllRaw,
    recentStudyByTopic,
    practiceTopic14dRaw,
    reviewTopicDueRaw,
    wrongTopicOpenRaw,
    daysUntilExam,
  })

  const subjectReadiness: DashboardSubjectReadinessItem[] = subjects
    .map((subject) => {
      const studyMinutes7d = rawMinutes7dBySubject.get(subject.id) || 0
      const effectiveStudyMinutes7d = study7dBySubject.get(subject.id) || 0
      const practiceStats = practice14dBySubject.get(subject.id) || {
        totalQuestions: 0,
        correctQuestions: 0,
      }
      const practiceAccuracy14d =
        practiceStats.totalQuestions > 0
          ? Math.round((practiceStats.correctQuestions / practiceStats.totalQuestions) * 100)
          : null
      const dueReviews = dueReviewsBySubject.get(subject.id) || 0
      const unresolvedWrongCount = wrongOpenBySubject.get(subject.id) || 0
      const vocabularyStats = vocabularyStatsBySubject.get(subject.id) || {
        total: 0,
        familiar: 0,
        due: 0,
        sumEaseFactor: 0,
        sumLapseCount: 0,
      }
      const vocabularyFamiliarRate =
        vocabularyStats.total > 0
          ? Math.round((vocabularyStats.familiar / vocabularyStats.total) * 100)
          : null

      const lastActivity = lastActivityBySubject.get(subject.id)
      const lastActivityDays = lastActivity
        ? differenceInCalendarDays(endOfToday, startOfDay(lastActivity))
        : null

      const studyScore = scaleToScore(effectiveStudyMinutes7d, SUBJECT_WEEKLY_TARGET_MINUTES)
      const practiceScore =
        practiceAccuracy14d ?? (studyMinutes7d > 0 ? 45 : dueReviews > 0 || unresolvedWrongCount > 0 ? 35 : 20)
      const reviewScore = clampScore(100 - dueReviews * 14 - unresolvedWrongCount * 6)
      const recencyScore = getRecencyScore(lastActivityDays)
      const avgEaseFactor = vocabularyStats.total > 0
        ? vocabularyStats.sumEaseFactor / vocabularyStats.total
        : null
      const avgLapseCount = vocabularyStats.total > 0
        ? vocabularyStats.sumLapseCount / vocabularyStats.total
        : null
      // easeScore: ease_factor 1.3（難）~3.4（易）正規化至 0-100
      const easeScore = avgEaseFactor !== null
        ? clampScore(Math.round(((avgEaseFactor - 1.3) / 2.1) * 100))
        : 65
      // lapseScore: 平均遺忘次數每次扣 15 分
      const lapseScore = avgLapseCount !== null
        ? clampScore(100 - Math.round(avgLapseCount * 15))
        : 100
      const retentionScore = clampScore(
        vocabularyFamiliarRate !== null
          ? Math.round(
              recencyScore * 0.50 +
              vocabularyFamiliarRate * 0.35 +
              easeScore * 0.10 +
              lapseScore * 0.05 -
              vocabularyStats.due * 4
            )
          : recencyScore
      )

      const score = clampScore(
        Math.round(studyScore * 0.25 + practiceScore * 0.4 + reviewScore * 0.2 + retentionScore * 0.15)
      )

      const weakTopic = topicAnalysis.weakestAreas.find((item) => item.subjectId === subject.id)?.topic || null
      const level = getReadinessLevel(score, daysUntilExam)
      const momentum = getMomentum({
        practiceAccuracy14d,
        dueReviews,
        unresolvedWrongCount,
        studyMinutes7d,
      })

      return {
        subjectId: subject.id,
        subjectName: subject.name,
        score,
        level,
        momentum,
        studyMinutes7d,
        practiceAccuracy14d,
        practiceCount14d: practiceStats.totalQuestions,
        dueReviews,
        unresolvedWrongCount,
        lastActivityDays,
        weakTopic,
        suggestedAction: getSuggestedAction({
          subjectName: subject.name,
          studyMinutes7d,
          practiceAccuracy14d,
          dueReviews,
          unresolvedWrongCount,
          vocabularyDue: vocabularyStats.due,
          weakTopic,
          hasPracticeData: practiceStats.totalQuestions > 0,
        }),
        vocabularyDue: vocabularyStats.due,
        vocabularyFamiliarRate,
        vocabularyTotalWords: vocabularyStats.total,
      }
    })
    .sort((a, b) => a.score - b.score || a.subjectName.localeCompare(b.subjectName, "zh-Hant"))

  const subjectOrder = new Map(subjectReadiness.map((item, index) => [item.subjectId, index]))
  const subjectCoverage = [...topicAnalysis.subjectCoverage].sort(
    (a, b) => (subjectOrder.get(a.subjectId) ?? 999) - (subjectOrder.get(b.subjectId) ?? 999)
  )
  const subjectTopicSections = [...topicAnalysis.subjectTopicSections].sort(
    (a, b) => (subjectOrder.get(a.subjectId) ?? 999) - (subjectOrder.get(b.subjectId) ?? 999)
  )

  const todayPlan = buildTodayPlan({
    pendingReviews,
    todaysStudyMinutes,
    weakestAreas: topicAnalysis.weakestAreas,
    nextReviewFocus,
    subjectReadiness,
  })

  const onboardingSteps: DashboardOnboardingStep[] = [
    {
      id: "subjects",
      title: "先建立科目",
      description: "先把微積分、經濟、英文這些主科建好，後面的統計才有依據。",
      href: "/settings",
      completed: subjects.length > 0,
    },
    {
      id: "exam-date",
      title: "設定考試日期",
      description: "讓首頁開始顯示倒數與衝刺節奏，不然很難判斷現在該快還是該穩。",
      href: "/settings",
      completed: user.exam_date !== null,
    },
    {
      id: "import-materials",
      title: "匯入題目或單字",
      description: "先把題庫或單字丟進來，系統才能真的開始判斷你的弱點。",
      href: "/import",
      completed: questionTopicsRaw.length > 0 || vocabularyWords.length > 0,
    },
    {
      id: "start-first-session",
      title: "開始第一次練習 / 讀書 session",
      description: "有了第一筆練習或學習紀錄後，Dashboard 才會從漂亮空殼變成真的有用。",
      href: questionTopicsRaw.length > 0 ? "/practice" : "/study-log",
      completed: studyDates.length > 0 || Boolean(practiceLogExists),
    },
  ]

  const studyDatesUnique = Array.from(
    new Set(studyDates.map((item) => startOfDay(item.study_date).toISOString()))
  ).map((iso) => new Date(iso))

  let streakDays = 0
  let previousDay: Date | null = null
  for (const day of studyDatesUnique) {
    if (previousDay === null) {
      if (differenceInCalendarDays(startOfToday, day) > 1) {
        break
      }
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

  const isExamPassed = daysUntilExam !== null && daysUntilExam < 0
  const isExamVeryClose = daysUntilExam !== null && daysUntilExam <= 14 && daysUntilExam >= 0
  const isExamSoon = daysUntilExam !== null && daysUntilExam <= 30 && daysUntilExam >= 0
  const lowestReadiness = subjectReadiness[0]

  let recommendation = "先開始今天第一段學習，系統才有辦法幫你判斷準備狀態。"
  if (isExamPassed) {
    recommendation = "考試日已過，記得更新新的目標日期，首頁提醒才會重新準確。"
  } else if (todayPlan[0]) {
    recommendation = `${todayPlan[0].title}：${todayPlan[0].description}`
  } else if (pendingReviews > 0 && isExamVeryClose) {
    recommendation = `距離考試只剩 ${daysUntilExam} 天，先清掉 ${pendingReviews} 個到期複習，再做一回合考古題。`
  } else if (pendingReviews > 0) {
    recommendation = `先處理 ${pendingReviews} 個到期複習，別讓記憶債繼續累積。`
  } else if (lowestReadiness && isExamSoon) {
    recommendation = `考前這段時間，優先拉回 ${lowestReadiness.subjectName} 的準備度。`
  } else if (todaysAccuracy !== null && todaysAccuracy < 70) {
    recommendation = "今天正確率偏低，先回頭整理錯題與觀念，再開下一組題目。"
  } else if (todaysStudyMinutes === 0 && isExamVeryClose) {
    recommendation = `距離考試只剩 ${daysUntilExam} 天，今天至少先完成一段專注讀書和一組題目。`
  } else if (todaysStudyMinutes === 0 && isExamSoon) {
    recommendation = "考前這段時間要維持手感，今天先開一段專注 session。"
  } else if (todaysAccuracy === null) {
    recommendation = "今天已有投入，接下來補一組題目，讓系統開始校準你的表現。"
  } else {
    recommendation = "今天節奏不錯，清完待辦後可以再做一組題目鞏固手感。"
  }

  const studyByDateKey = new Map(
    last7DaysStudy.map((s) => [formatShortDate(new Date(s.study_date)), s._sum.duration_minutes || 0])
  )
  const trendData: DashboardTrendPoint[] = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(today, 6 - i)
    const dateKey = formatShortDate(day)
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

  return {
    daysUntilExam,
    todaysStudyMinutes,
    todaysAccuracy,
    pendingReviews,
    streakDays,
    completedToday,
    trendData,
    subjectHours,
    weakTopics,
    nextReviewFocus,
    subjectReadiness,
    weakestAreas: topicAnalysis.weakestAreas,
    subjectCoverage,
    subjectTopicSections,
    todayPlan,
    onboardingSteps,
    vocabularyOverview,
    recommendation,
    hasData,
  }
}

function buildTopicAnalysis({
  subjects,
  questionTopicsRaw,
  studyTopicAllRaw,
  practiceTopicAllRaw,
  reviewTopicAllRaw,
  wrongTopicAllRaw,
  recentStudyByTopic,
  practiceTopic14dRaw,
  reviewTopicDueRaw,
  wrongTopicOpenRaw,
  daysUntilExam,
}: {
  subjects: SubjectSummary[]
  questionTopicsRaw: TopicGroupRow[]
  studyTopicAllRaw: TopicCountRow[]
  practiceTopicAllRaw: TopicCountRow[]
  reviewTopicAllRaw: TopicCountRow[]
  wrongTopicAllRaw: TopicCountRow[]
  recentStudyByTopic: Map<string, number>
  practiceTopic14dRaw: TopicPracticeRow[]
  reviewTopicDueRaw: TopicCountRow[]
  wrongTopicOpenRaw: TopicCountRow[]
  daysUntilExam: number | null
}): {
  weakestAreas: DashboardWeakAreaItem[]
  subjectCoverage: DashboardSubjectCoverageItem[]
  subjectTopicSections: DashboardSubjectTopicSectionItem[]
} {
  const subjectNameMap = new Map(subjects.map((subject) => [subject.id, subject.name]))

  const questionTopicSet = buildTopicKeySet(questionTopicsRaw)
  const activityTopicSet = buildTopicKeySet([
    ...studyTopicAllRaw,
    ...practiceTopicAllRaw,
    ...reviewTopicAllRaw,
    ...wrongTopicAllRaw,
  ])

  const totalTopicKeysBySubject = new Map<string, Set<string>>()
  addTopicKeysBySubject(totalTopicKeysBySubject, questionTopicsRaw)
  addTopicKeysBySubject(totalTopicKeysBySubject, studyTopicAllRaw)
  addTopicKeysBySubject(totalTopicKeysBySubject, practiceTopicAllRaw)
  addTopicKeysBySubject(totalTopicKeysBySubject, reviewTopicAllRaw)
  addTopicKeysBySubject(totalTopicKeysBySubject, wrongTopicAllRaw)
  const recentPracticeByTopic = new Map(
    practiceTopic14dRaw.map((item) => [
      makeTopicKey(item.subject_id, item.topic),
      {
        totalQuestions: item._sum.total_questions || 0,
        correctQuestions: item._sum.correct_questions || 0,
      },
    ])
  )
  const dueReviewsByTopic = new Map(
    reviewTopicDueRaw.map((item) => [makeTopicKey(item.subject_id, item.topic), item._count._all])
  )
  const wrongCountByTopic = new Map(
    wrongTopicOpenRaw.map((item) => [makeTopicKey(item.subject_id, item.topic), item._count._all])
  )

  const allTopicDetails: DashboardTopicDetailItem[] = []
  const subjectCoverage: DashboardSubjectCoverageItem[] = []
  const subjectTopicSections: DashboardSubjectTopicSectionItem[] = []

  for (const subject of subjects) {
    const topicKeys = [...(totalTopicKeysBySubject.get(subject.id) || new Set<string>())].sort((a, b) => {
      const topicA = a.split("::")[1]
      const topicB = b.split("::")[1]
      return topicA.localeCompare(topicB, "zh-Hant")
    })

    const topicDetails = topicKeys
      .map((key) => buildTopicDetail({
        key,
        subjectId: subject.id,
        subjectName: subject.name,
        questionTopicSet,
        activityTopicSet,
        recentStudyByTopic,
        recentPracticeByTopic,
        dueReviewsByTopic,
        wrongCountByTopic,
        daysUntilExam,
      }))
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score
        if (a.dueReviews !== b.dueReviews) return b.dueReviews - a.dueReviews
        if (a.wrongCount !== b.wrongCount) return b.wrongCount - a.wrongCount
        return a.topic.localeCompare(b.topic, "zh-Hant")
      })

    const coveredTopics = topicDetails.filter((item) => item.hasActivity).length
    const activeTopics = topicDetails.filter(
      (item) => item.studyMinutes7d > 0 || item.practiceCount14d > 0 || item.dueReviews > 0 || item.wrongCount > 0
    ).length
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
    subjectTopicSections.push({
      subjectId: subject.id,
      subjectName: subject.name,
      coverage,
      topics: topicDetails,
    })
    allTopicDetails.push(...topicDetails)
  }

  const weakestAreas: DashboardWeakAreaItem[] = allTopicDetails
    .filter((item) => item.hasActivity || item.hasQuestionBank)
    .map((item) => {
      let priority: DashboardWeakAreaItem["priority"] = "low"
      if (item.score < 50 || item.dueReviews >= 2 || item.wrongCount >= 3 || !item.hasActivity) {
        priority = "high"
      } else if (item.score < 70 || item.dueReviews > 0 || item.wrongCount > 0) {
        priority = "medium"
      }

      return {
        key: item.key,
        subjectId: item.subjectId,
        subjectName: item.subjectName,
        topic: item.topic,
        score: item.score,
        practiceAccuracy: item.practiceAccuracy14d,
        wrongCount: item.wrongCount,
        dueReviews: item.dueReviews,
        studyMinutes7d: item.studyMinutes7d,
        priority,
        note: item.note,
      }
    })
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score
      if (a.dueReviews !== b.dueReviews) return b.dueReviews - a.dueReviews
      if (a.wrongCount !== b.wrongCount) return b.wrongCount - a.wrongCount
      return a.subjectName.localeCompare(b.subjectName, "zh-Hant")
    })
    .slice(0, 6)

  return {
    weakestAreas,
    subjectCoverage,
    subjectTopicSections,
  }
}

function buildTopicDetail({
  key,
  subjectId,
  subjectName,
  questionTopicSet,
  activityTopicSet,
  recentStudyByTopic,
  recentPracticeByTopic,
  dueReviewsByTopic,
  wrongCountByTopic,
  daysUntilExam,
}: {
  key: string
  subjectId: string
  subjectName: string
  questionTopicSet: Set<string>
  activityTopicSet: Set<string>
  recentStudyByTopic: Map<string, number>
  recentPracticeByTopic: Map<string, { totalQuestions: number; correctQuestions: number }>
  dueReviewsByTopic: Map<string, number>
  wrongCountByTopic: Map<string, number>
  daysUntilExam: number | null
}): DashboardTopicDetailItem {
  const topic = key.split("::")[1]
  const studyMinutes7d = recentStudyByTopic.get(key) || 0
  const practiceStats = recentPracticeByTopic.get(key) || {
    totalQuestions: 0,
    correctQuestions: 0,
  }
  const practiceAccuracy14d =
    practiceStats.totalQuestions > 0
      ? Math.round((practiceStats.correctQuestions / practiceStats.totalQuestions) * 100)
      : null
  const dueReviews = dueReviewsByTopic.get(key) || 0
  const wrongCount = wrongCountByTopic.get(key) || 0
  const hasActivity = activityTopicSet.has(key)
  const hasQuestionBank = questionTopicSet.has(key)

  const studyScore = scaleToScore(studyMinutes7d, TOPIC_WEEKLY_TARGET_MINUTES)
  const accuracyScore = practiceAccuracy14d ?? (hasActivity ? (studyMinutes7d > 0 ? 58 : 48) : 30)
  const memoryScore = clampScore(100 - dueReviews * 25 - wrongCount * 18)
  const coverageScore = hasActivity ? 100 : hasQuestionBank ? 20 : 50
  const score = clampScore(
    Math.round(accuracyScore * 0.45 + studyScore * 0.2 + memoryScore * 0.25 + coverageScore * 0.1)
  )

  let note = "最近有接觸，但還沒穩定。"
  if (!hasActivity && hasQuestionBank) {
    note = "題庫裡有這個 topic，但你還沒正式碰過。"
  } else if (dueReviews > 0) {
    note = `有 ${dueReviews} 個到期複習卡住。`
  } else if (wrongCount > 0) {
    note = `還有 ${wrongCount} 題未掌握錯題。`
  } else if (practiceAccuracy14d !== null) {
    note = `最近 14 天正確率 ${practiceAccuracy14d}%。`
  } else if (studyMinutes7d > 0) {
    note = `這週已投入 ${studyMinutes7d} 分鐘，接下來該補做題回饋。`
  } else if (hasActivity) {
    note = "以前碰過，但最近有點冷掉了。"
  }

  return {
    key,
    subjectId,
    subjectName,
    topic,
    score,
    status: getReadinessLevel(score, daysUntilExam),
    studyMinutes7d,
    practiceAccuracy14d,
    practiceCount14d: practiceStats.totalQuestions,
    dueReviews,
    wrongCount,
    hasActivity,
    hasQuestionBank,
    note,
  }
}

function buildTopicKeySet(items: TopicGroupRow[]) {
  const set = new Set<string>()
  for (const item of items) {
    set.add(makeTopicKey(item.subject_id, item.topic))
  }
  return set
}

function addTopicKeysBySubject(map: Map<string, Set<string>>, items: TopicGroupRow[]) {
  for (const item of items) {
    const subjectId = item.subject_id
    const current = map.get(subjectId) || new Set<string>()
    current.add(makeTopicKey(subjectId, item.topic))
    map.set(subjectId, current)
  }
}

function buildTodayPlan({
  pendingReviews,
  todaysStudyMinutes,
  weakestAreas,
  nextReviewFocus,
  subjectReadiness,
}: {
  pendingReviews: number
  todaysStudyMinutes: number
  weakestAreas: DashboardWeakAreaItem[]
  nextReviewFocus: DashboardReviewFocusItem[]
  subjectReadiness: DashboardSubjectReadinessItem[]
}): DashboardPlanItem[] {
  const candidates: DashboardPlanItem[] = []

  const firstDueReview = nextReviewFocus[0]
  if (firstDueReview) {
    candidates.push({
      id: `review-${firstDueReview.id}`,
      title: `先清 ${firstDueReview.subject.name} 的到期複習`,
      description: `${firstDueReview.topic} 已到複習日，先把最容易掉分的記憶債清掉。`,
      reason: pendingReviews > 1 ? `目前還有 ${pendingReviews} 個到期任務。` : "今天有到期複習任務。",
      href: "/review",
      tone: "danger",
    })
  }

  const weakestArea = weakestAreas[0]
  if (weakestArea) {
    const weakAreaDescription =
      weakestArea.practiceAccuracy !== null
        ? `${weakestArea.subjectName}・${weakestArea.topic} 最近正確率 ${weakestArea.practiceAccuracy}%，先補這塊最有感。`
        : `${weakestArea.subjectName}・${weakestArea.topic} 還沒真正覆蓋，先碰這塊避免考前留下空白。`

    candidates.push({
      id: `weak-${weakestArea.key}`,
      title: `補強 ${weakestArea.subjectName}・${weakestArea.topic}`,
      description: weakAreaDescription,
      reason: weakestArea.note,
      href: "/practice",
      tone: weakestArea.priority === "high" ? "warning" : "focus",
    })
  }

  const lowestReadiness = subjectReadiness[0]
  if (lowestReadiness) {
    candidates.push({
      id: `readiness-${lowestReadiness.subjectId}`,
      title: `拉回 ${lowestReadiness.subjectName} 的準備度`,
      description: lowestReadiness.suggestedAction,
      reason: `目前準備度 ${lowestReadiness.score} 分。`,
      href: lowestReadiness.dueReviews > 0 || lowestReadiness.vocabularyDue > 0 ? "/review" : "/practice",
      tone: lowestReadiness.score < 50 ? "danger" : "focus",
    })
  }

  if (todaysStudyMinutes === 0) {
    candidates.push({
      id: "start-study-session",
      title: "先開今天第一段專注讀書",
      description: "先把 30–60 分鐘讀書打開，後面的做題和複習才會跟上。",
      reason: "今天還沒有學習紀錄。",
      href: "/study-log",
      tone: "focus",
    })
  }

  if (candidates.length === 0) {
    candidates.push({
      id: "keep-momentum",
      title: "維持今天的手感",
      description: "複習已經不擠了，接下來做一組題目確認自己的穩定度。",
      reason: "今天節奏算健康。",
      href: "/practice",
      tone: "success",
    })
  }

  return dedupePlanItems(candidates).slice(0, 3)
}

function mergeLastActivity<T>(
  map: Map<string, Date>,
  items: T[],
  getKey: (item: T) => string,
  getDate: (item: T) => Date | null
) {
  for (const item of items) {
    const key = getKey(item)
    const value = getDate(item)
    if (!value) continue

    const previous = map.get(key)
    if (!previous || previous < value) {
      map.set(key, value)
    }
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

function getSuggestedAction({
  subjectName,
  studyMinutes7d,
  practiceAccuracy14d,
  dueReviews,
  unresolvedWrongCount,
  vocabularyDue,
  weakTopic,
  hasPracticeData,
}: {
  subjectName: string
  studyMinutes7d: number
  practiceAccuracy14d: number | null
  dueReviews: number
  unresolvedWrongCount: number
  vocabularyDue: number
  weakTopic: string | null
  hasPracticeData: boolean
}) {
  if (dueReviews > 0) {
    return `先清掉 ${dueReviews} 個到期複習，別讓 ${subjectName} 的記憶債繼續堆。`
  }

  if (vocabularyDue > 0) {
    return `先複習 ${vocabularyDue} 個到期單字，把記憶穩定度拉回來。`
  }

  if (practiceAccuracy14d !== null && practiceAccuracy14d < 60) {
    return weakTopic
      ? `先回頭補 ${weakTopic}，做少量題目確認觀念，不要直接硬刷。`
      : `先整理錯題與觀念，再做一組小測，別讓低正確率延續。`
  }

  if (unresolvedWrongCount >= 4 && weakTopic) {
    return `錯題壓力偏高，先處理 ${weakTopic} 的未掌握題目。`
  }

  if (!hasPracticeData) {
    return `先做一組 ${subjectName} 題目，讓系統開始判斷你的表現。`
  }

  if (studyMinutes7d < 120) {
    return `這週投入偏少，先補一段 45–60 分鐘專注讀書。`
  }

  return weakTopic
    ? `維持節奏，接著補一組 ${weakTopic} 題目確認手感。`
    : `維持節奏，做一組題目確認這科的穩定度。`
}

function getMomentum({
  practiceAccuracy14d,
  dueReviews,
  unresolvedWrongCount,
  studyMinutes7d,
}: {
  practiceAccuracy14d: number | null
  dueReviews: number
  unresolvedWrongCount: number
  studyMinutes7d: number
}): DashboardSubjectReadinessItem["momentum"] {
  if (
    (practiceAccuracy14d !== null && practiceAccuracy14d >= 75 && dueReviews <= 2 && unresolvedWrongCount <= 3) ||
    (practiceAccuracy14d === null && studyMinutes7d >= 180 && dueReviews === 0)
  ) {
    return "up"
  }

  if (
    (practiceAccuracy14d !== null && practiceAccuracy14d < 60) ||
    dueReviews >= 4 ||
    unresolvedWrongCount >= 6
  ) {
    return "down"
  }

  return "steady"
}

function getReadinessLevel(score: number, daysUntilExam?: number | null): DashboardSubjectReadinessItem["level"] {
  let strongThreshold = 80
  let steadyThreshold = 65
  let warningThreshold = 50

  if (daysUntilExam !== null && daysUntilExam !== undefined && daysUntilExam >= 0) {
    if (daysUntilExam <= 7) {
      strongThreshold = 90; steadyThreshold = 78; warningThreshold = 65
    } else if (daysUntilExam <= 14) {
      strongThreshold = 87; steadyThreshold = 74; warningThreshold = 60
    } else if (daysUntilExam <= 30) {
      strongThreshold = 83; steadyThreshold = 70; warningThreshold = 55
    }
  }

  if (score >= strongThreshold) return "strong"
  if (score >= steadyThreshold) return "steady"
  if (score >= warningThreshold) return "warning"
  return "danger"
}

function getRecencyScore(lastActivityDays: number | null) {
  if (lastActivityDays === null) return 20
  // 指數衰減，半衰期約 10 天；底部設 20 與「從未」相區隔
  const raw = 100 * Math.exp(-0.069 * lastActivityDays)
  return Math.max(20, Math.round(raw))
}

function focusMultiplier(focusScore: number): number {
  const map: Record<number, number> = { 1: 0.6, 2: 0.75, 3: 0.9, 4: 1.0, 5: 1.15 }
  return map[focusScore] ?? 1.0
}

function studyTypeMultiplier(studyType: string): number {
  const map: Record<string, number> = { "做題": 1.2, "複習": 1.1, "上課": 1.0, "看書": 0.85 }
  return map[studyType] ?? 1.0
}

function scaleToScore(value: number, target: number) {
  if (target <= 0) return 0
  return clampScore(Math.round((value / target) * 100))
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value))
}

function normalizeTopic(topic: string) {
  const normalized = topic.trim().replace(/\s+/g, " ")
  return normalized.length > 0 ? normalized : "未分類"
}

function makeTopicKey(subjectId: string, rawTopic: string) {
  return `${subjectId}::${normalizeTopic(rawTopic)}`
}

function formatShortDate(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}
