import type { Prisma } from "@prisma/client"

import {
  formatVocabularyTaskTopic,
  getVocabularySchedule,
  REVIEW_TASK_SOURCE_TYPES,
} from "@/lib/vocabulary"
import type {
  VocabularyConfidenceLevel,
  VocabularyReviewRating,
  VocabularyStatus,
  VocabularyWordItem,
} from "@/types"

type VocabularyWordForReview = Omit<VocabularyWordItem, "status"> & {
  status: VocabularyStatus
}

type ApplyVocabularyReviewInput = {
  tx: Prisma.TransactionClient
  userId: string
  word: VocabularyWordForReview
  rating: VocabularyReviewRating
  confidence: VocabularyConfidenceLevel
  responseMs: number
  reviewTaskId?: string
}

type ApplyVocabularyReviewResult = {
  quality: number
  reviewStage: number
  word: VocabularyWordItem
}

export async function applyVocabularyReview({
  tx,
  userId,
  word,
  rating,
  confidence,
  responseMs,
  reviewTaskId,
}: ApplyVocabularyReviewInput): Promise<ApplyVocabularyReviewResult> {
  const now = new Date()
  const normalizedConfidence = Math.min(Math.max(confidence, 1), 5) as VocabularyConfidenceLevel
  const normalizedResponseMs = Math.min(Math.max(Math.round(responseMs), 800), 120000)
  const schedule = getVocabularySchedule({
    status: word.status,
    easeFactor: word.ease_factor,
    intervalDays: word.interval_days,
    reviewCount: word.review_count,
    lapseCount: word.lapse_count,
    averageResponseMs: word.average_response_ms,
    averageConfidence: word.average_confidence,
    lastReviewedAt: word.last_reviewed_at,
    nextReviewDate: word.next_review_date,
    rating,
    confidence: normalizedConfidence,
    responseMs: normalizedResponseMs,
    now,
  })

  const savedWord = await tx.vocabularyWord.update({
    where: { id: word.id },
    data: {
      status: schedule.nextStatus,
      ease_factor: schedule.easeFactor,
      interval_days: schedule.intervalDays,
      review_count: schedule.reviewCount,
      lapse_count: schedule.lapseCount,
      average_response_ms: schedule.averageResponseMs,
      average_confidence: schedule.averageConfidence,
      last_reviewed_at: now,
      next_review_date: schedule.nextReviewDate,
    },
    include: {
      list: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  await tx.vocabularyReviewLog.create({
    data: {
      user_id: userId,
      list_id: word.list_id,
      vocabulary_word_id: word.id,
      review_task_id: reviewTaskId,
      rating,
      confidence: normalizedConfidence,
      response_ms: normalizedResponseMs,
      quality: schedule.quality,
      scheduled_days: schedule.scheduledDays,
      elapsed_days: schedule.elapsedDays,
      interval_days: schedule.intervalDays,
      ease_factor: schedule.easeFactor,
    },
  })

  const reviewTaskData = {
    user_id: userId,
    vocabulary_list_id: word.list_id,
    vocabulary_word_id: word.id,
    topic: formatVocabularyTaskTopic(word.word),
    source_type: REVIEW_TASK_SOURCE_TYPES.vocabulary,
    review_date: schedule.nextReviewDate,
    review_stage: schedule.reviewStage,
    completed: false,
  }

  if (reviewTaskId) {
    await tx.reviewTask.update({
      where: { id: reviewTaskId },
      data: {
        completed: true,
        result_score: schedule.quality * 20,
      },
    })
  }

  const existingOpenTask = await tx.reviewTask.findFirst({
    where: {
      user_id: userId,
      vocabulary_word_id: word.id,
      completed: false,
      ...(reviewTaskId ? { NOT: { id: reviewTaskId } } : {}),
    },
    select: {
      id: true,
    },
  })

  if (existingOpenTask) {
    await tx.reviewTask.update({
      where: { id: existingOpenTask.id },
      data: reviewTaskData,
    })
  } else {
    await tx.reviewTask.create({
      data: reviewTaskData,
    })
  }

  return {
    quality: schedule.quality,
    reviewStage: schedule.reviewStage,
    word: savedWord,
  }
}
