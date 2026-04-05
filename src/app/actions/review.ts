"use server"

import { revalidatePath } from "next/cache"

import prisma from "@/lib/prisma"
import { applyVocabularyReview } from "@/lib/vocabulary-review"
import {
  assertOwnedRecord,
  getCurrentUserOrThrow,
  OWNERSHIP_ERROR_MESSAGE,
} from "@/lib/current-user"
import {
  REVIEW_TASK_SOURCE_TYPES,
} from "@/lib/vocabulary"

import type {
  ActionResult,
  ReviewTaskItem,
  VocabularyReviewInput,
  VocabularyStatus,
  WrongQuestionItem,
} from "@/types"

export async function getReviewTasks(): Promise<ReviewTaskItem[]> {
  const user = await getCurrentUserOrThrow()
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  return prisma.reviewTask.findMany({
    where: {
      user_id: user.id,
      review_date: { lte: today },
      completed: false
    },
    include: {
      subject: {
        select: {
          id: true,
          name: true,
        },
      },
      vocabulary_word: {
        select: {
          id: true,
          word: true,
          meaning: true,
          status: true,
          average_response_ms: true,
        },
      },
    },
    orderBy: { review_date: "asc" },
  })
}

export async function getWrongQuestions(): Promise<WrongQuestionItem[]> {
  const user = await getCurrentUserOrThrow()
  return prisma.wrongQuestion.findMany({
    where: { user_id: user.id },
    include: {
      subject: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { first_wrong_date: "desc" },
    take: 100,
  })
}

export async function createManualReviewTask(data: {
  subject_id: string
  topic: string
  review_date: Date
  review_stage: number
}): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()
  const trimmedTopic = data.topic.trim()

  if (!trimmedTopic) {
    return {
      success: false,
      message: "請填寫任務主題。",
    }
  }

  const subject = await prisma.subject.findFirst({
    where: {
      id: data.subject_id,
      user_id: user.id,
    },
    select: {
      id: true,
      name: true,
    },
  })

  const ownedSubject = assertOwnedRecord(subject, OWNERSHIP_ERROR_MESSAGE)

  const existing = await prisma.reviewTask.findFirst({
    where: {
      user_id: user.id,
      subject_id: ownedSubject.id,
      topic: trimmedTopic,
      completed: false,
      source_type: REVIEW_TASK_SOURCE_TYPES.manual,
    },
    select: { id: true },
  })

  if (existing) {
    return {
      success: false,
      message: `${ownedSubject.name}「${trimmedTopic}」已有未完成的複習任務。`,
    }
  }

  await prisma.reviewTask.create({
    data: {
      user_id: user.id,
      subject_id: ownedSubject.id,
      topic: trimmedTopic,
      source_type: REVIEW_TASK_SOURCE_TYPES.manual,
      review_date: data.review_date,
      review_stage: data.review_stage,
      completed: false,
    },
  })

  revalidatePath("/review")
  revalidatePath("/dashboard")

  return {
    success: true,
    message: `已新增 ${ownedSubject.name} 的複習任務。`,
  }
}

export async function completeReviewTask(id: string, resultScore?: number) {
  const user = await getCurrentUserOrThrow()
  const ownedTask = await prisma.reviewTask.findFirst({
    where: {
      id,
      user_id: user.id,
    },
    include: {
      vocabulary_word: {
        select: {
          id: true,
          word: true,
          meaning: true,
          status: true,
          average_response_ms: true,
        },
      },
    },
  })

  const task = assertOwnedRecord(ownedTask, OWNERSHIP_ERROR_MESSAGE)

  if (task.source_type === REVIEW_TASK_SOURCE_TYPES.vocabulary && task.vocabulary_word_id) {
    const fallbackRating =
      typeof resultScore === "number" && resultScore >= 90
        ? "easy"
        : typeof resultScore === "number" && resultScore >= 60
          ? "okay"
          : "hard"

    await reviewVocabularyTask(task.id, {
      rating: fallbackRating,
      confidence: 3,
      response_ms: Math.round(task.vocabulary_word?.average_response_ms ?? 7000),
      review_task_id: task.id,
    })
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.reviewTask.update({
      where: { id: task.id },
      data: { completed: true, result_score: resultScore },
    })

    if (
      task.source_type === REVIEW_TASK_SOURCE_TYPES.wrongQuestion &&
      task.wrong_question_id
    ) {
      const wq = await tx.wrongQuestion.findUnique({
        where: { id: task.wrong_question_id }
      })
      if (wq && wq.status === "ACTIVE") {
        await tx.wrongQuestion.update({
          where: { id: task.wrong_question_id },
          data: { status: "CORRECTED" }
        })
      }
    }

  })

  revalidatePath("/review")
  revalidatePath("/dashboard")
}

export async function reviewVocabularyTask(
  taskId: string,
  input: VocabularyReviewInput
): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()
  const ownedTask = await prisma.reviewTask.findFirst({
    where: {
      id: taskId,
      user_id: user.id,
      source_type: REVIEW_TASK_SOURCE_TYPES.vocabulary,
    },
    include: {
      vocabulary_word: {
        include: {
          subject: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  const task = assertOwnedRecord(ownedTask, OWNERSHIP_ERROR_MESSAGE)

  if (!task.vocabulary_word) {
    return {
      success: false,
      message: "找不到對應的英文單字資料。",
    }
  }

  const vocabularyWord = task.vocabulary_word

  await prisma.$transaction(async (tx) => {
    await applyVocabularyReview({
      tx,
      userId: user.id,
      word: {
        ...vocabularyWord,
        subject: vocabularyWord.subject,
        status: vocabularyWord.status as VocabularyStatus,
      },
      rating: input.rating,
      confidence: input.confidence,
      responseMs: input.response_ms,
      reviewTaskId: task.id,
    })
  })

  revalidatePath("/review")
  revalidatePath("/dashboard")
  revalidatePath("/vocabulary")

  return {
    success: true,
    message: "已記錄這次英文單字複習。",
  }
}

export async function updateWrongQuestionStatus(id: string, status: "ACTIVE" | "CORRECTED" | "MASTERED" | "ARCHIVED") {
  const user = await getCurrentUserOrThrow()

  const ownedQuestion = await prisma.wrongQuestion.findFirst({
    where: {
      id,
      user_id: user.id,
    },
    select: {
      id: true,
    },
  })

  const question = assertOwnedRecord(ownedQuestion, OWNERSHIP_ERROR_MESSAGE)

  await prisma.$transaction(async (tx) => {
    await tx.wrongQuestion.update({
      where: { id: question.id },
      data: { status },
    })

    if (status === "MASTERED" || status === "ARCHIVED") {
      await tx.reviewTask.updateMany({
        where: {
          user_id: user.id,
          wrong_question_id: question.id,
          completed: false,
        },
        data: {
          completed: true,
        }
      })
    }
  })

  revalidatePath("/review")
  revalidatePath("/wrong-questions")
  revalidatePath("/dashboard")
}
