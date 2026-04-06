export const WRONG_QUESTION_REVIEW_STAGES = [1, 3, 7, 14] as const

export const WRONG_QUESTION_STATUS = {
  pending: "ACTIVE",
  corrected: "CORRECTED",
  mastered: "MASTERED",
  archived: "ARCHIVED",
} as const

export const WRONG_QUESTION_STATUS_LABEL = {
  ACTIVE: "未訂正",
  CORRECTED: "已訂正",
  MASTERED: "已掌握",
  ARCHIVED: "封存",
} as const

export type WrongQuestionStatus = (typeof WRONG_QUESTION_STATUS)[keyof typeof WRONG_QUESTION_STATUS]

export function getNextWrongQuestionReviewStage(currentStage: number) {
  const currentIndex = WRONG_QUESTION_REVIEW_STAGES.indexOf(
    currentStage as (typeof WRONG_QUESTION_REVIEW_STAGES)[number]
  )

  if (currentIndex === -1) {
    return null
  }

  return WRONG_QUESTION_REVIEW_STAGES[currentIndex + 1] ?? null
}

export function getWrongQuestionInitialReviewDate(firstWrongDate: Date) {
  return addDays(firstWrongDate, WRONG_QUESTION_REVIEW_STAGES[0])
}

export function getWrongQuestionNextReviewDate(currentStage: number, now = new Date()) {
  const nextStage = getNextWrongQuestionReviewStage(currentStage)

  if (nextStage === null) {
    return null
  }

  return addDays(now, Math.max(1, nextStage - currentStage))
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}
