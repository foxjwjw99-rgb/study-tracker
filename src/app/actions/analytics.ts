"use server"

import prisma from "@/lib/prisma"
import { getCurrentUserOrThrow } from "@/lib/current-user"
import { eachDayOfInterval } from "date-fns"
import {
  formatShortDateInTaipei,
  getEndOfTodayUTC,
  getStartOfDaysAgoUTC,
  getStartOfTodayUTC,
  getStartOfWeekUTC,
} from "@/lib/date-utils"

import type {
  AccuracyTrendPoint,
  AnalyticsData,
  HighEffortLowReturnItem,
  SubjectStatsItem,
  VocabularyDailyTrendPoint,
  VocabularyDifficultyItem,
  VocabularyOverview,
  VocabularyStatusDistributionItem,
  VocabularySubjectProgressItem,
} from "@/types"

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const user = await getCurrentUserOrThrow()
  const todayStart = getStartOfTodayUTC()
  const todayEnd = getEndOfTodayUTC()
  const startOf7DaysAgo = getStartOfDaysAgoUTC(6)
  const weekStart = getStartOfWeekUTC()

  const subjects = await prisma.subject.findMany({ where: { user_id: user.id } })
  const subjectMap = new Map(subjects.map((s) => [s.id, s.name]))

  const [
    subjectStatsRaw,
    recentStudyLogs,
    recentPracticeLogsRaw,
    recentPracticeLogs7Days,
    vocabularyWords,
    vocabularyReviewLogs7Days,
    todayVocabularyReviewCount,
    weekVocabularyReviewCount,
  ] = await Promise.all([
    prisma.practiceLog.groupBy({
      by: ["subject_id"],
      where: { user_id: user.id },
      _sum: {
        total_questions: true,
        correct_questions: true,
      },
    }),
    prisma.studyLog.groupBy({
      by: ["topic", "subject_id"],
      where: { user_id: user.id, study_date: { gte: startOf7DaysAgo } },
      _sum: { duration_minutes: true },
    }),
    prisma.practiceLog.groupBy({
      by: ["subject_id", "topic"],
      where: { user_id: user.id, practice_date: { gte: startOf7DaysAgo } },
      _sum: { total_questions: true, correct_questions: true },
    }),
    prisma.practiceLog.findMany({
      where: {
        user_id: user.id,
        practice_date: { gte: startOf7DaysAgo },
      },
      select: { practice_date: true, total_questions: true, correct_questions: true },
    }),
    prisma.vocabularyWord.findMany({
      where: { user_id: user.id },
      select: {
        id: true,
        word: true,
        meaning: true,
        status: true,
        ease_factor: true,
        interval_days: true,
        lapse_count: true,
        review_count: true,
        average_response_ms: true,
        average_confidence: true,
        next_review_date: true,
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.vocabularyReviewLog.findMany({
      where: {
        user_id: user.id,
        created_at: { gte: startOf7DaysAgo },
      },
      select: {
        id: true,
        created_at: true,
        vocabulary_word_id: true,
        subject_id: true,
      },
      orderBy: { created_at: "asc" },
    }),
    prisma.vocabularyReviewLog.count({
      where: {
        user_id: user.id,
        created_at: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    }),
    prisma.vocabularyReviewLog.count({
      where: {
        user_id: user.id,
        created_at: {
          gte: weekStart,
          lte: todayEnd,
        },
      },
    }),
  ])

  let totalAllPracticeQs = 0
  let totalAllCorrectQs = 0
  const subjectStatsMap = new Map<string, { total: number; correct: number }>()

  for (const stat of subjectStatsRaw) {
    const tq = stat._sum.total_questions || 0
    const cq = stat._sum.correct_questions || 0
    totalAllPracticeQs += tq
    totalAllCorrectQs += cq
    subjectStatsMap.set(stat.subject_id, { total: tq, correct: cq })
  }

  const overallAvgAccuracy = totalAllPracticeQs > 0 ? totalAllCorrectQs / totalAllPracticeQs : 0

  const subjectStats: SubjectStatsItem[] = subjects.map((subject) => {
    const stats = subjectStatsMap.get(subject.id) || { total: 0, correct: 0 }
    return {
      id: subject.id,
      name: subject.name,
      accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null,
      totalQuestions: stats.total,
    }
  })

  const total7DayTime = recentStudyLogs.reduce((sum, l) => sum + (l._sum.duration_minutes || 0), 0)
  const avgTimePerTopic = recentStudyLogs.length > 0 ? total7DayTime / recentStudyLogs.length : 0

  const recentTopicStatsMap = new Map<string, { total: number; correct: number }>()
  for (const log of recentPracticeLogsRaw) {
    const normalizedTopic = log.topic.trim().replace(/\s+/g, " ")
    const key = `${log.subject_id}-${normalizedTopic}`
    const existing = recentTopicStatsMap.get(key) || { total: 0, correct: 0 }
    existing.total += log._sum.total_questions || 0
    existing.correct += log._sum.correct_questions || 0
    recentTopicStatsMap.set(key, existing)
  }

  const highEffortLowReturn: HighEffortLowReturnItem[] = []

  for (const sl of recentStudyLogs) {
    const topicTime = sl._sum.duration_minutes || 0
    if (topicTime > avgTimePerTopic) {
      const normalizedSlTopic = sl.topic.trim().replace(/\s+/g, " ")
      const topicStats = recentTopicStatsMap.get(`${sl.subject_id}-${normalizedSlTopic}`)

      let topicAccuracy: number | null = null
      if (topicStats && topicStats.total > 0) {
        topicAccuracy = topicStats.correct / topicStats.total
      }

      const subjectName = subjectMap.get(sl.subject_id) || "Unknown"

      if (topicAccuracy !== null && topicAccuracy < overallAvgAccuracy) {
        highEffortLowReturn.push({
          subject: subjectName,
          topic: normalizedSlTopic,
          timeSpent: topicTime,
          accuracy: Math.round(topicAccuracy * 100),
          avgAccuracy: Math.round(overallAvgAccuracy * 100),
        })
      }
    }
  }

  const trendData: AccuracyTrendPoint[] = []
  for (let i = 6; i >= 0; i--) {
    const d = getStartOfDaysAgoUTC(i)
    const dayKey = formatShortDateInTaipei(d)
    const logsThisDay = recentPracticeLogs7Days.filter(
      (l) => formatShortDateInTaipei(new Date(l.practice_date)) === dayKey
    )

    const tq = logsThisDay.reduce((sum, l) => sum + l.total_questions, 0)
    const cq = logsThisDay.reduce((sum, l) => sum + l.correct_questions, 0)

    trendData.push({
      date: dayKey,
      accuracy: tq > 0 ? Math.round((cq / tq) * 100) : 0,
    })
  }

  const vocabularyTotal = vocabularyWords.length
  const familiarCount = vocabularyWords.filter((word) => word.status === "FAMILIAR").length
  const masteredCount = vocabularyWords.filter(
    (word) => word.status === "FAMILIAR" && word.review_count >= 3 && word.lapse_count <= 2
  ).length
  const dueCount = vocabularyWords.filter(
    (word) => word.next_review_date && word.next_review_date <= todayEnd
  ).length

  const vocabularyOverview: VocabularyOverview = {
    totalWords: vocabularyTotal,
    reviewedToday: todayVocabularyReviewCount,
    reviewedThisWeek: weekVocabularyReviewCount,
    dueWords: dueCount,
    familiarRate: vocabularyTotal > 0 ? Math.round((familiarCount / vocabularyTotal) * 100) : 0,
    masteredWords: masteredCount,
    masteredRate: vocabularyTotal > 0 ? Math.round((masteredCount / vocabularyTotal) * 100) : 0,
  }

  const vocabularyStatusDistribution: VocabularyStatusDistributionItem[] = [
    { key: "NEW", label: "NEW", count: vocabularyWords.filter((word) => word.status === "NEW").length },
    {
      key: "LEARNING",
      label: "LEARNING",
      count: vocabularyWords.filter((word) => word.status === "LEARNING").length,
    },
    {
      key: "FAMILIAR",
      label: "FAMILIAR",
      count: vocabularyWords.filter((word) => word.status === "FAMILIAR").length,
    },
  ]

  const reviewWordCountByDay = new Map<string, Set<string>>()
  const reviewCountByDay = new Map<string, number>()
  for (const log of vocabularyReviewLogs7Days) {
    const dayKey = formatShortDateInTaipei(log.created_at)
    const wordSet = reviewWordCountByDay.get(dayKey) || new Set<string>()
    wordSet.add(log.vocabulary_word_id)
    reviewWordCountByDay.set(dayKey, wordSet)
    reviewCountByDay.set(dayKey, (reviewCountByDay.get(dayKey) || 0) + 1)
  }

  const vocabularyTrend: VocabularyDailyTrendPoint[] = eachDayOfInterval({
    start: startOf7DaysAgo,
    end: todayStart,
  }).map((day) => {
    const dayKey = formatShortDateInTaipei(day)
    return {
      date: dayKey,
      reviewedWords: reviewWordCountByDay.get(dayKey)?.size || 0,
      reviewCount: reviewCountByDay.get(dayKey) || 0,
    }
  })

  const vocabularyDifficultWords: VocabularyDifficultyItem[] = [...vocabularyWords]
    .sort((a, b) => {
      const difficultyA = a.lapse_count * 100 + (3.5 - a.ease_factor) * 20 + (a.review_count - (a.average_confidence ?? 3))
      const difficultyB = b.lapse_count * 100 + (3.5 - b.ease_factor) * 20 + (b.review_count - (b.average_confidence ?? 3))
      if (difficultyB !== difficultyA) return difficultyB - difficultyA
      if (b.lapse_count !== a.lapse_count) return b.lapse_count - a.lapse_count
      if (a.ease_factor !== b.ease_factor) return a.ease_factor - b.ease_factor
      return b.review_count - a.review_count
    })
    .slice(0, 10)
    .map((word) => ({
      id: word.id,
      word: word.word,
      meaning: word.meaning,
      subjectName: word.subject.name,
      status: word.status as "NEW" | "LEARNING" | "FAMILIAR",
      lapseCount: word.lapse_count,
      easeFactor: Number(word.ease_factor.toFixed(2)),
      reviewCount: word.review_count,
      averageResponseMs: word.average_response_ms ? Math.round(word.average_response_ms) : null,
      averageConfidence: word.average_confidence ? Number(word.average_confidence.toFixed(1)) : null,
      intervalDays: Number(word.interval_days.toFixed(1)),
    }))

  const reviewedThisWeekBySubject = new Map<string, number>()
  for (const log of vocabularyReviewLogs7Days) {
    reviewedThisWeekBySubject.set(log.subject_id, (reviewedThisWeekBySubject.get(log.subject_id) || 0) + 1)
  }

  const subjectProgressMap = new Map<
    string,
    {
      subjectId: string
      subjectName: string
      totalWords: number
      dueWords: number
      familiarWords: number
      reviewedThisWeek: number
    }
  >()

  for (const word of vocabularyWords) {
    const current = subjectProgressMap.get(word.subject.id) || {
      subjectId: word.subject.id,
      subjectName: word.subject.name,
      totalWords: 0,
      dueWords: 0,
      familiarWords: 0,
      reviewedThisWeek: reviewedThisWeekBySubject.get(word.subject.id) || 0,
    }

    current.totalWords += 1
    if (word.status === "FAMILIAR") current.familiarWords += 1
    if (word.next_review_date && word.next_review_date <= todayEnd) current.dueWords += 1

    subjectProgressMap.set(word.subject.id, current)
  }

  const vocabularySubjectProgress: VocabularySubjectProgressItem[] = [...subjectProgressMap.values()]
    .map((item) => ({
      ...item,
      familiarRate: item.totalWords > 0 ? Math.round((item.familiarWords / item.totalWords) * 100) : 0,
    }))
    .sort((a, b) => b.totalWords - a.totalWords || a.subjectName.localeCompare(b.subjectName, "zh-Hant"))

  return {
    subjectStats,
    highEffortLowReturn,
    accuracyTrend: trendData,
    vocabularyOverview,
    vocabularyStatusDistribution,
    vocabularyTrend,
    vocabularyDifficultWords,
    vocabularySubjectProgress,
  }
}
