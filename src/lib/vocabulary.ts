import { addDays, differenceInMilliseconds } from "date-fns"

import type {
  VocabularyConfidenceLevel,
  VocabularyReviewRating,
  VocabularyStatus,
} from "@/types"

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24
const MIN_EASE_FACTOR = 1.3
const MAX_EASE_FACTOR = 3.4
const FAMILIAR_THRESHOLD_DAYS = 10

export const REVIEW_TASK_SOURCE_TYPES = {
  manual: "manual",
  wrongQuestion: "wrong_question",
  vocabulary: "vocabulary",
} as const

type VocabularySrsState = {
  status: VocabularyStatus
  easeFactor: number
  intervalDays: number
  reviewCount: number
  lapseCount: number
  averageResponseMs: number | null
  averageConfidence: number | null
  lastReviewedAt: Date | null
  nextReviewDate: Date | null
}

type VocabularyScheduleInput = VocabularySrsState & {
  rating: VocabularyReviewRating
  confidence: VocabularyConfidenceLevel
  responseMs: number
  now?: Date
}

export type VocabularySchedule = {
  nextStatus: VocabularyStatus
  nextReviewDate: Date
  reviewStage: number
  intervalDays: number
  easeFactor: number
  reviewCount: number
  lapseCount: number
  averageResponseMs: number
  averageConfidence: number
  quality: number
  scheduledDays: number
  elapsedDays: number
}

export function getVocabularySchedule(input: VocabularyScheduleInput): VocabularySchedule {
  const now = input.now ?? new Date()
  const scheduledDays = Math.max(input.intervalDays, input.status === "NEW" ? 0 : 1)
  const elapsedDays = getElapsedDays(input.lastReviewedAt, now, scheduledDays)

  const nextReviewCount = input.reviewCount + 1
  const averageResponseMs = getRollingAverage(
    input.averageResponseMs,
    input.responseMs,
    input.reviewCount
  )
  const averageConfidence = getRollingAverage(
    input.averageConfidence,
    input.confidence,
    input.reviewCount
  )

  let nextIntervalDays = 1
  let nextEaseFactor = input.easeFactor || 2.5
  let nextLapseCount = input.lapseCount
  let quality = 3

  if (input.rating === "hard") {
    nextIntervalDays = 1
    nextEaseFactor = clamp(nextEaseFactor - 0.2, MIN_EASE_FACTOR, MAX_EASE_FACTOR)
    nextLapseCount += 1
    quality = 2
  } else if (input.rating === "okay") {
    const baseInterval = getOkayInterval(input.intervalDays, nextEaseFactor, input.reviewCount)
    nextIntervalDays = Math.max(1, baseInterval * 0.8)
    quality = 3
  } else {
    nextIntervalDays = getEasyInterval(input.intervalDays, nextEaseFactor, input.reviewCount)
    nextEaseFactor = clamp(nextEaseFactor + 0.15, MIN_EASE_FACTOR, MAX_EASE_FACTOR)
    quality = 5
  }

  nextIntervalDays = roundNumber(nextIntervalDays)
  nextEaseFactor = roundNumber(nextEaseFactor)

  const nextStatus =
    input.rating === "hard"
      ? "LEARNING"
      : nextIntervalDays >= FAMILIAR_THRESHOLD_DAYS
        ? "FAMILIAR"
        : "LEARNING"

  return {
    nextStatus,
    nextReviewDate: addDays(now, nextIntervalDays),
    reviewStage: Math.max(1, Math.round(nextIntervalDays)),
    intervalDays: nextIntervalDays,
    easeFactor: nextEaseFactor,
    reviewCount: nextReviewCount,
    lapseCount: nextLapseCount,
    averageResponseMs: roundNumber(averageResponseMs),
    averageConfidence: roundNumber(averageConfidence),
    quality,
    scheduledDays: roundNumber(scheduledDays),
    elapsedDays: roundNumber(elapsedDays),
  }
}

export function formatVocabularyTaskTopic(word: string) {
  return `英文單字：${word}`
}

export function formatVocabularyStatus(status: VocabularyStatus) {
  if (status === "FAMILIAR") {
    return "已熟悉"
  }

  if (status === "LEARNING") {
    return "學習中"
  }

  return "新單字"
}

function getEasyInterval(currentIntervalDays: number, easeFactor: number, reviewCount: number) {
  if (reviewCount === 0 || currentIntervalDays <= 0) {
    return 1
  }

  return Math.max(1, currentIntervalDays * easeFactor)
}

function getOkayInterval(currentIntervalDays: number, _easeFactor: number, reviewCount: number) {
  if (reviewCount === 0 || currentIntervalDays <= 0) {
    return 1
  }

  return Math.max(1, currentIntervalDays)
}

function getElapsedDays(lastReviewedAt: Date | null, now: Date, fallback: number) {
  if (!lastReviewedAt) {
    return fallback
  }

  return Math.max(
    differenceInMilliseconds(now, lastReviewedAt) / MILLISECONDS_PER_DAY,
    0
  )
}

function getRollingAverage(previous: number | null, next: number, previousCount: number) {
  if (previous === null || previousCount <= 0) {
    return next
  }

  return (previous * previousCount + next) / (previousCount + 1)
}

function roundNumber(value: number) {
  return Math.round(value * 100) / 100
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
