"use server"

import { revalidatePath } from "next/cache"
import { startOfDay } from "date-fns"

import prisma from "@/lib/prisma"
import {
  assertOwnedRecord,
  getCurrentUserOrThrow,
  OWNERSHIP_ERROR_MESSAGE,
} from "@/lib/current-user"
import { resolveSubjectUnit } from "@/lib/subject-unit"
import { REVIEW_TASK_SOURCE_TYPES } from "@/lib/vocabulary"
import {
  getNextWrongQuestionReviewStage,
  getWrongQuestionInitialReviewDate,
  getWrongQuestionNextReviewDate,
  WRONG_QUESTION_REVIEW_STAGES,
  WRONG_QUESTION_STATUS,
} from "@/lib/wrong-question-review"
import type { ActionResult } from "@/types"

export type WrongQuestionSourceType =
  | "wrong_answer"
  | "manual_add"
  | "careless_mistake"
  | "guessed_correct"

export type WrongQuestionWithQuestion = {
  id: string
  user_id: string
  subject_id: string
  subject: { id: string; name: string }
  question_id: string | null
  question: {
    id: string
    question: string
    question_type: string
    options: string
    answer: number
    text_answer: string | null
    explanation: string | null
    topic: string
  } | null
  unit_id: string | null
  topic: string
  source: string | null
  source_type: string | null
  error_reason: string | null
  first_wrong_date: Date
  last_wrong_date: Date | null
  last_reviewed_at: Date | null
  status: string
  next_review_date: Date | null
  wrong_count: number
  review_count: number
  correct_streak: number
  question_text: string | null
  correct_answer_text: string | null
  user_answer_text: string | null
  notes: string | null
  is_manual_added: boolean
  is_careless: boolean
  created_at: Date
  updated_at: Date
}

export async function getWrongQuestionsWithFilters(params: {
  subject_id?: string
  status?: string
  is_careless?: boolean
  overdue_only?: boolean
  sort?: "latest" | "wrong_count" | "next_review_date"
  limit?: number
}): Promise<WrongQuestionWithQuestion[]> {
  const user = await getCurrentUserOrThrow()
  const now = new Date()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { user_id: user.id }

  if (params.subject_id) {
    where.subject_id = params.subject_id
  }
  if (params.status) {
    where.status = params.status
  }
  if (params.is_careless) {
    where.is_careless = true
  }
  if (params.overdue_only) {
    where.next_review_date = { lte: now }
    where.status = { notIn: ["MASTERED", "ARCHIVED"] }
  }

  const orderBy =
    params.sort === "wrong_count"
      ? { wrong_count: "desc" as const }
      : params.sort === "next_review_date"
        ? { next_review_date: "asc" as const }
        : { first_wrong_date: "desc" as const }

  return prisma.wrongQuestion.findMany({
    where,
    include: {
      subject: { select: { id: true, name: true } },
      question: {
        select: {
          id: true,
          question: true,
          question_type: true,
          options: true,
          answer: true,
          text_answer: true,
          explanation: true,
          topic: true,
        },
      },
    },
    orderBy,
    take: params.limit ?? 200,
  }) as Promise<WrongQuestionWithQuestion[]>
}

export async function getDueWrongQuestions(subject_id?: string): Promise<WrongQuestionWithQuestion[]> {
  const user = await getCurrentUserOrThrow()
  const now = new Date()

  return prisma.wrongQuestion.findMany({
    where: {
      user_id: user.id,
      status: { notIn: ["MASTERED", "ARCHIVED"] as never[] },
      next_review_date: { lte: now },
      question_id: { not: null },
      ...(subject_id ? { subject_id } : {}),
    },
    include: {
      subject: { select: { id: true, name: true } },
      question: {
        select: {
          id: true,
          question: true,
          question_type: true,
          options: true,
          answer: true,
          text_answer: true,
          explanation: true,
          topic: true,
        },
      },
    },
    orderBy: { next_review_date: "asc" },
    take: 50,
  }) as Promise<WrongQuestionWithQuestion[]>
}

export async function addToWrongBook(
  question_id: string,
  subject_id: string,
  source_type: WrongQuestionSourceType,
): Promise<ActionResult & { wrongQuestionId?: string }> {
  const user = await getCurrentUserOrThrow()

  const ownedSubject = assertOwnedRecord(
    await prisma.subject.findFirst({
      where: { id: subject_id, user_id: user.id },
      select: { id: true, name: true },
    }),
    OWNERSHIP_ERROR_MESSAGE
  )

  const question = await prisma.question.findFirst({
    where: { id: question_id },
    select: {
      id: true,
      topic: true,
      subject_id: true,
      unit_id: true,
      question: true,
      question_type: true,
      options: true,
      answer: true,
      text_answer: true,
    },
  })
  if (!question) {
    return { success: false, message: "找不到題目。" }
  }

  const now = new Date()
  const nextReviewDate = getWrongQuestionInitialReviewDate(now)
  const resolvedUnit = await resolveSubjectUnit(prisma, {
    subjectId: ownedSubject.id,
    unitId: question.unit_id,
    topic: question.topic,
    createIfMissing: true,
    source: "SYSTEM",
  })

  const wq = await prisma.wrongQuestion.create({
    data: {
      user_id: user.id,
      subject_id: ownedSubject.id,
      question_id,
      unit_id: resolvedUnit.unitId,
      topic: resolvedUnit.topicSnapshot || question.topic,
      question_text: question.question,
      correct_answer_text: getQuestionCorrectAnswerText(question),
      source_type,
      source: "手動加入",
      first_wrong_date: now,
      last_wrong_date: now,
      status: WRONG_QUESTION_STATUS.pending,
      wrong_count: 1,
      next_review_date: nextReviewDate,
      is_manual_added: true,
      is_careless: source_type === "careless_mistake",
    },
  })

  await prisma.reviewTask.create({
    data: {
      user_id: user.id,
      subject_id: ownedSubject.id,
      topic: resolvedUnit.topicSnapshot || question.topic,
      unit_id: resolvedUnit.unitId,
      wrong_question_id: wq.id,
      source_type: REVIEW_TASK_SOURCE_TYPES.wrongQuestion,
      review_date: nextReviewDate,
      review_stage: WRONG_QUESTION_REVIEW_STAGES[0],
    },
  })

  revalidatePath("/practice")
  revalidatePath("/wrong-questions")
  revalidatePath("/review")

  const labelMap: Record<WrongQuestionSourceType, string> = {
    wrong_answer: "已加入錯題本",
    manual_add: "已手動加入錯題本",
    careless_mistake: "已標記為粗心錯",
    guessed_correct: "已標記為猜對不熟",
  }

  return {
    success: true,
    message: labelMap[source_type],
    wrongQuestionId: wq.id,
  }
}

export async function removeFromWrongBook(wrong_question_id: string): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()

  const existing = await prisma.wrongQuestion.findFirst({
    where: { id: wrong_question_id, user_id: user.id },
    select: { id: true },
  })
  assertOwnedRecord(existing, OWNERSHIP_ERROR_MESSAGE)

  await prisma.$transaction(async (tx) => {
    await tx.wrongQuestion.update({
      where: { id: wrong_question_id },
      data: { status: "ARCHIVED" },
    })
    await tx.reviewTask.updateMany({
      where: { user_id: user.id, wrong_question_id, completed: false },
      data: { completed: true },
    })
  })

  revalidatePath("/practice")
  revalidatePath("/wrong-questions")
  revalidatePath("/review")

  return { success: true, message: "已從錯題本移除。" }
}

export async function submitWrongQuestionReview(data: {
  wrong_question_id: string
  question_id: string
  answered_correctly: boolean
  selected_answer?: number
  typed_answer?: string
}): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()

  const wq = assertOwnedRecord(
    await prisma.wrongQuestion.findFirst({
      where: { id: data.wrong_question_id, user_id: user.id },
    }),
    OWNERSHIP_ERROR_MESSAGE
  )

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    const currentStage = WRONG_QUESTION_REVIEW_STAGES[Math.min(wq.review_count, WRONG_QUESTION_REVIEW_STAGES.length - 1)]

    await tx.wrongQuestionReviewLog.create({
      data: {
        wrong_question_id: data.wrong_question_id,
        user_id: user.id,
        subject_id: wq.subject_id,
        question_id: data.question_id,
        answered_correctly: data.answered_correctly,
        selected_answer: data.selected_answer ?? null,
        typed_answer: data.typed_answer ?? null,
        review_mode: "wrong_book_review",
        review_stage: currentStage,
        result_score: data.answered_correctly ? 100 : 0,
        reviewed_at: now,
      },
    })

    const nextStage = getNextWrongQuestionReviewStage(currentStage)
    const nextReviewDate = data.answered_correctly
      ? (nextStage === null ? null : getWrongQuestionNextReviewDate(currentStage, now))
      : getWrongQuestionInitialReviewDate(now)

    const newStatus = data.answered_correctly
      ? nextStage === null
        ? WRONG_QUESTION_STATUS.mastered
        : WRONG_QUESTION_STATUS.corrected
      : WRONG_QUESTION_STATUS.pending

    await tx.wrongQuestion.update({
      where: { id: data.wrong_question_id },
      data: {
        review_count: { increment: 1 },
        correct_streak: data.answered_correctly ? { increment: 1 } : 0,
        last_reviewed_at: now,
        status: newStatus,
        next_review_date: nextReviewDate,
        ...(data.answered_correctly ? {} : { wrong_count: { increment: 1 }, last_wrong_date: now }),
      },
    })

    await tx.reviewTask.updateMany({
      where: { user_id: user.id, wrong_question_id: data.wrong_question_id, completed: false },
      data: { completed: true },
    })

    if (data.answered_correctly && nextStage !== null && nextReviewDate) {
      await tx.reviewTask.create({
        data: {
          user_id: user.id,
          subject_id: wq.subject_id,
          topic: wq.topic,
          unit_id: wq.unit_id,
          wrong_question_id: wq.id,
          source_type: REVIEW_TASK_SOURCE_TYPES.wrongQuestion,
          review_date: nextReviewDate,
          review_stage: nextStage,
        },
      })
    }
  })

  revalidatePath("/wrong-questions")
  revalidatePath("/review")
  revalidatePath("/dashboard")

  return { success: true, message: data.answered_correctly ? "答對！已更新複習排程。" : "答錯了，已重新排入第 1 天複習。" }
}

export async function getWrongQuestionStats(subject_id?: string) {
  const user = await getCurrentUserOrThrow()
  const now = new Date()
  const sevenDaysAgo = startOfDay(new Date(now))
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [dueCount, unresolvedCount, recentAddedCount, recentMasteredCount] = await Promise.all([
    prisma.wrongQuestion.count({
      where: {
        user_id: user.id,
        status: { notIn: ["MASTERED", "ARCHIVED"] as never[] },
        next_review_date: { lte: now },
        question_id: { not: null },
        ...(subject_id ? { subject_id } : {}),
      },
    }),
    prisma.wrongQuestion.count({
      where: {
        user_id: user.id,
        status: { notIn: ["MASTERED", "ARCHIVED"] as never[] },
        ...(subject_id ? { subject_id } : {}),
      },
    }),
    prisma.wrongQuestion.count({
      where: {
        user_id: user.id,
        first_wrong_date: { gte: sevenDaysAgo },
        ...(subject_id ? { subject_id } : {}),
      },
    }),
    prisma.wrongQuestion.count({
      where: {
        user_id: user.id,
        status: "MASTERED" as never,
        last_reviewed_at: { gte: sevenDaysAgo },
        ...(subject_id ? { subject_id } : {}),
      },
    }),
  ])

  return { dueCount, unresolvedCount, recentAddedCount, recentMasteredCount }
}

export async function createManualWrongQuestion(data: {
  subject_id: string
  topic: string
  question_text: string
  correct_answer_text: string
  user_answer_text?: string
  error_reason?: string
  notes?: string
  first_wrong_date?: Date
}): Promise<ActionResult> {
  const { addWrongQuestion } = await import("@/app/actions/practice-log")

  const first_wrong_date = data.first_wrong_date ?? new Date()

  try {
    await addWrongQuestion({
      subject_id: data.subject_id,
      topic: data.topic,
      question_text: data.question_text,
      correct_answer_text: data.correct_answer_text,
      user_answer_text: data.user_answer_text,
      error_reason: data.error_reason,
      notes: data.notes,
      source: "手動加入",
      first_wrong_date,
    })

    revalidatePath("/wrong-questions")

    return { success: true, message: "已加入錯題本。" }
  } catch {
    return { success: false, message: "加入失敗，請稍後再試。" }
  }
}

function getQuestionCorrectAnswerText(question: {
  question_type: string
  options: string
  answer: number
  text_answer: string | null
}) {
  if (question.question_type === "fill_in_blank") {
    return question.text_answer ?? "（見題目）"
  }

  try {
    const options = JSON.parse(question.options) as unknown
    if (Array.isArray(options) && typeof options[question.answer] === "string") {
      return options[question.answer] as string
    }
  } catch {
    // ignore JSON parse failures
  }

  return `選項 ${question.answer + 1}`
}
