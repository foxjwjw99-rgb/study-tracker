import type { Prisma } from "@prisma/client"

import { REVIEW_TASK_SOURCE_TYPES } from "@/lib/vocabulary"
import {
  getWrongQuestionInitialReviewDate,
  WRONG_QUESTION_REVIEW_STAGES,
} from "@/lib/wrong-question-review"

type TransactionClient = Prisma.TransactionClient

type ResetWrongQuestionReviewScheduleInput = {
  tx: TransactionClient
  userId: string
  subjectId: string
  topic: string
  unitId?: string | null
  wrongQuestionId: string
  baseDate: Date
}

export async function resetWrongQuestionReviewSchedule({
  tx,
  userId,
  subjectId,
  topic,
  unitId,
  wrongQuestionId,
  baseDate,
}: ResetWrongQuestionReviewScheduleInput): Promise<Date> {
  const reviewDate = getWrongQuestionInitialReviewDate(baseDate)

  await tx.reviewTask.updateMany({
    where: {
      user_id: userId,
      wrong_question_id: wrongQuestionId,
      completed: false,
    },
    data: {
      completed: true,
    },
  })

  await tx.reviewTask.create({
    data: {
      user_id: userId,
      subject_id: subjectId,
      topic,
      unit_id: unitId ?? null,
      wrong_question_id: wrongQuestionId,
      source_type: REVIEW_TASK_SOURCE_TYPES.wrongQuestion,
      review_date: reviewDate,
      review_stage: WRONG_QUESTION_REVIEW_STAGES[0],
      completed: false,
    },
  })

  return reviewDate
}
