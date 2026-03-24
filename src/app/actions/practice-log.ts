"use server"

import { revalidatePath } from "next/cache"

import prisma from "@/lib/prisma"
import {
  assertOwnedRecord,
  getCurrentUserOrThrow,
  OWNERSHIP_ERROR_MESSAGE,
} from "@/lib/current-user"
import { REVIEW_TASK_SOURCE_TYPES } from "@/lib/vocabulary"

import type { PracticeLogListItem } from "@/types"
import type {
  PracticeQuestionAnswerInput,
  PracticeQuestionBankSummary,
  PracticeQuestionItem,
  PracticeQuestionSessionResult,
} from "@/types"

export async function getPracticeLogs(): Promise<PracticeLogListItem[]> {
  const user = await getCurrentUserOrThrow()
  return prisma.practiceLog.findMany({
    where: { user_id: user.id },
    include: {
      subject: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { practice_date: "desc" },
  })
}

export async function getPracticeQuestionBank(): Promise<PracticeQuestionBankSummary[]> {
  const user = await getCurrentUserOrThrow()
  const accessibleGroupIds = await getAccessibleStudyGroupIds(user.id)

  const questions = await prisma.question.findMany({
    where: buildAccessibleQuestionWhere(user.id, accessibleGroupIds),
    select: {
      visibility: true,
      subject: {
        select: {
          name: true,
        },
      },
    },
  })

  if (questions.length === 0) {
    return []
  }

  const ownSubjects = await prisma.subject.findMany({
    where: { user_id: user.id },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  })

  const ownSubjectByName = new Map(ownSubjects.map((subject) => [subject.name, subject]))
  const grouped = new Map<string, PracticeQuestionBankSummary>()

  for (const question of questions) {
    const subjectName = question.subject.name
    const localSubject = ownSubjectByName.get(subjectName)
    const subjectId = localSubject?.id ?? `shared:${subjectName}`
    const current = grouped.get(subjectName)

    if (current) {
      current.question_count += 1
      if (question.visibility === "study_group") {
        current.shared_question_count += 1
      } else {
        current.private_question_count += 1
      }
      continue
    }

    grouped.set(subjectName, {
      subject_id: subjectId,
      subject_name: subjectName,
      question_count: 1,
      private_question_count: question.visibility === "private" ? 1 : 0,
      shared_question_count: question.visibility === "study_group" ? 1 : 0,
    })
  }

  return Array.from(grouped.values()).sort((a, b) => a.subject_name.localeCompare(b.subject_name, "zh-Hant"))
}

export async function getPracticeQuestionTopics(
  subjectNameOrId: string
): Promise<{ topic: string; count: number }[]> {
  const user = await getCurrentUserOrThrow()
  const accessibleGroupIds = await getAccessibleStudyGroupIds(user.id)

  const ownSubject = await prisma.subject.findFirst({
    where: { OR: [{ id: subjectNameOrId, user_id: user.id }, { name: subjectNameOrId, user_id: user.id }] },
    select: { name: true },
  })
  const normalizedSubjectName = ownSubject?.name ?? stripSharedSubjectPrefix(subjectNameOrId)

  const questions = await prisma.question.findMany({
    where: {
      ...buildAccessibleQuestionWhere(user.id, accessibleGroupIds),
      subject: { name: normalizedSubjectName },
    },
    select: { topic: true },
  })

  const countByTopic = new Map<string, number>()
  for (const q of questions) {
    countByTopic.set(q.topic, (countByTopic.get(q.topic) ?? 0) + 1)
  }

  return Array.from(countByTopic.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => a.topic.localeCompare(b.topic, "zh-Hant"))
}

export async function getPracticeQuestions(
  subjectNameOrId: string,
  requestedCount: number,
  topic?: string
): Promise<PracticeQuestionItem[]> {
  const user = await getCurrentUserOrThrow()
  const accessibleGroupIds = await getAccessibleStudyGroupIds(user.id)

  const ownSubject = await prisma.subject.findFirst({
    where: {
      OR: [
        { id: subjectNameOrId, user_id: user.id },
        { name: subjectNameOrId, user_id: user.id },
      ],
    },
    select: {
      id: true,
      name: true,
    },
  })

  const normalizedSubjectName = ownSubject?.name ?? stripSharedSubjectPrefix(subjectNameOrId)
  const practiceSubjectId = await ensureLocalSubjectId(user.id, normalizedSubjectName)

  const questions = await prisma.question.findMany({
    where: {
      ...buildAccessibleQuestionWhere(user.id, accessibleGroupIds),
      subject: {
        name: normalizedSubjectName,
      },
      ...(topic ? { topic } : {}),
    },
    include: {
      shared_study_group: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      created_at: "desc",
    },
  })

  const parsedQuestions: PracticeQuestionItem[] = questions.flatMap((question) => {
    try {
      const options = JSON.parse(question.options) as unknown
      if (!Array.isArray(options) || options.some((option) => typeof option !== "string")) {
        return []
      }

      return [{
        id: createAnswerKey(question.id, practiceSubjectId),
        source_question_id: question.id,
        subject_id: practiceSubjectId,
        subject_name: normalizedSubjectName,
        topic: question.topic,
        question: question.question,
        options,
        answer: question.answer,
        explanation: question.explanation,
        image_url: question.image_url,
        visibility: question.visibility === "study_group" ? "study_group" : "private",
        shared_study_group_id: question.shared_study_group_id,
        shared_study_group_name: question.shared_study_group?.name ?? null,
      }]
    } catch {
      return []
    }
  })

  shuffleInPlace(parsedQuestions)

  if (requestedCount <= 0 || requestedCount >= parsedQuestions.length) {
    return parsedQuestions
  }

  return parsedQuestions.slice(0, requestedCount)
}

export async function createPracticeLog(data: {
  subject_id: string
  topic: string
  source?: string
  practice_date: Date
  total_questions: number
  correct_questions: number
  duration_minutes: number
  error_type?: string
  notes?: string
}) {
  const user = await getCurrentUserOrThrow()
  const subject = await prisma.subject.findFirst({
    where: {
      id: data.subject_id,
      user_id: user.id,
    },
    select: { id: true },
  })

  assertOwnedRecord(subject, OWNERSHIP_ERROR_MESSAGE)

  const log = await prisma.practiceLog.create({
    data: {
      ...data,
      user_id: user.id,
    },
  })
  revalidatePath("/practice")
  revalidatePath("/dashboard")
  return log
}

export async function deletePracticeLog(id: string) {
  const user = await getCurrentUserOrThrow()
  const existingLog = await prisma.practiceLog.findFirst({
    where: {
      id,
      user_id: user.id,
    },
    select: { id: true },
  })

  const ownedLog = assertOwnedRecord(existingLog, OWNERSHIP_ERROR_MESSAGE)

  await prisma.practiceLog.delete({
    where: { id: ownedLog.id },
  })
  revalidatePath("/practice")
  revalidatePath("/dashboard")
}

export async function addWrongQuestion(data: {
  subject_id: string
  topic: string
  source?: string
  error_reason?: string
  first_wrong_date: Date
  notes?: string
}) {
  const user = await getCurrentUserOrThrow()
  const subject = await prisma.subject.findFirst({
    where: {
      id: data.subject_id,
      user_id: user.id,
    },
    select: { id: true },
  })

  assertOwnedRecord(subject, OWNERSHIP_ERROR_MESSAGE)

  const next_review_date = new Date(data.first_wrong_date)
  next_review_date.setDate(next_review_date.getDate() + 1)

  let wq = await prisma.wrongQuestion.findFirst({
    where: {
      user_id: user.id,
      subject_id: data.subject_id,
      topic: data.topic,
      status: { not: "已掌握" },
    },
  })

  if (wq) {
    wq = await prisma.wrongQuestion.update({
      where: { id: wq.id },
      data: {
        updated_at: new Date(),
        notes: data.notes ? (wq.notes ? `${wq.notes}\n---\n${data.notes}` : data.notes) : wq.notes,
        next_review_date,
      },
    })
  } else {
    wq = await prisma.wrongQuestion.create({
      data: {
        ...data,
        user_id: user.id,
        status: "未訂正",
        next_review_date,
      },
    })
  }

  const reviewTask = await prisma.reviewTask.findFirst({
    where: {
      user_id: user.id,
      subject_id: data.subject_id,
      topic: data.topic,
      completed: false,
      source_type: REVIEW_TASK_SOURCE_TYPES.wrongQuestion,
    },
  })

  if (reviewTask) {
    await prisma.reviewTask.update({
      where: { id: reviewTask.id },
      data: {
        review_date: next_review_date,
        wrong_question_id: wq.id,
      },
    })
  } else {
    await prisma.reviewTask.create({
      data: {
        user_id: user.id,
        subject_id: data.subject_id,
        topic: data.topic,
        wrong_question_id: wq.id,
        source_type: REVIEW_TASK_SOURCE_TYPES.wrongQuestion,
        review_date: next_review_date,
        review_stage: 1,
      },
    })
  }

  revalidatePath("/review")
  revalidatePath("/practice")
  revalidatePath("/dashboard")
  return wq
}

export async function submitPracticeQuestionSession(data: {
  subject_id: string
  duration_seconds: number
  answers: PracticeQuestionAnswerInput[]
}): Promise<PracticeQuestionSessionResult> {
  const user = await getCurrentUserOrThrow()
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

  if (data.answers.length === 0) {
    return {
      success: false,
      message: "這次練習沒有作答紀錄。",
      totalQuestions: 0,
      correctQuestions: 0,
      wrongQuestionCount: 0,
    }
  }

  const answerMap = new Map(
    data.answers.map((answer) => [answer.question_id, answer.selected_answer])
  )
  const sourceQuestionIds = Array.from(
    new Set(data.answers.map((answer) => parseSourceQuestionId(answer.question_id)))
  )
  const accessibleGroupIds = await getAccessibleStudyGroupIds(user.id)

  const questions = await prisma.question.findMany({
    where: {
      ...buildAccessibleQuestionWhere(user.id, accessibleGroupIds),
      id: {
        in: sourceQuestionIds,
      },
      subject: {
        name: ownedSubject.name,
      },
    },
  })

  if (questions.length !== sourceQuestionIds.length) {
    return {
      success: false,
      message: "題目資料不完整，請重新開始練習。",
      totalQuestions: 0,
      correctQuestions: 0,
      wrongQuestionCount: 0,
    }
  }

  const wrongQuestions = questions.filter((question) => {
    const selectedAnswer = answerMap.get(createAnswerKey(question.id, ownedSubject.id))
    return selectedAnswer !== question.answer
  })
  const correctQuestions = questions.length - wrongQuestions.length
  const durationMinutes = Math.max(1, Math.round(data.duration_seconds / 60))
  const practiceDate = new Date()
  const uniqueTopics = [...new Set(questions.map((question) => question.topic))]
  const topicLabel =
    uniqueTopics.length === 1
      ? uniqueTopics[0]
      : `題庫練習（${uniqueTopics.length} 個單元）`
  const usedSharedQuestions = questions.some((question) => question.visibility === "study_group")

  await prisma.$transaction(async (tx) => {
    await tx.practiceLog.create({
      data: {
        user_id: user.id,
        subject_id: ownedSubject.id,
        topic: topicLabel,
        source: usedSharedQuestions ? "共享題庫" : "匯入題庫",
        practice_date: practiceDate,
        total_questions: questions.length,
        correct_questions: correctQuestions,
        duration_minutes: durationMinutes,
        error_type: wrongQuestions.length > 0 ? "不會" : undefined,
        notes: `題庫練習完成，共 ${questions.length} 題，答對 ${correctQuestions} 題。`,
      },
    })

    for (const wrongQuestion of wrongQuestions) {
      const nextReviewDate = new Date(practiceDate)
      nextReviewDate.setDate(nextReviewDate.getDate() + 1)

      const selectedAnswer = answerMap.get(createAnswerKey(wrongQuestion.id, ownedSubject.id))
      const parsedOptions = safeParseOptions(wrongQuestion.options)
      const selectedAnswerText =
        selectedAnswer === null || selectedAnswer === undefined
          ? "未作答"
          : parsedOptions[selectedAnswer] || `選項 ${selectedAnswer + 1}`
      const correctAnswerText =
        parsedOptions[wrongQuestion.answer] || `選項 ${wrongQuestion.answer + 1}`

      let wq = await tx.wrongQuestion.findFirst({
        where: {
          user_id: user.id,
          subject_id: ownedSubject.id,
          topic: wrongQuestion.topic,
          status: { not: "已掌握" },
        },
      })

      const sourceLabel = wrongQuestion.visibility === "study_group" ? "共享題庫" : "題庫練習"
      const newNotes = `題目：${wrongQuestion.question}\n你的答案：${selectedAnswerText}\n正確答案：${correctAnswerText}`

      if (wq) {
        wq = await tx.wrongQuestion.update({
          where: { id: wq.id },
          data: {
            updated_at: new Date(),
            notes: wq.notes ? `${wq.notes}\n---\n${newNotes}` : newNotes,
            next_review_date: nextReviewDate,
          },
        })
      } else {
        wq = await tx.wrongQuestion.create({
          data: {
            user_id: user.id,
            subject_id: ownedSubject.id,
            topic: wrongQuestion.topic,
            source: sourceLabel,
            error_reason: "題庫練習答錯",
            first_wrong_date: practiceDate,
            status: "未訂正",
            next_review_date: nextReviewDate,
            notes: newNotes,
          },
        })
      }

      const existingReviewTask = await tx.reviewTask.findFirst({
        where: {
          user_id: user.id,
          subject_id: ownedSubject.id,
          topic: wrongQuestion.topic,
          completed: false,
          source_type: REVIEW_TASK_SOURCE_TYPES.wrongQuestion,
        },
      })

      if (existingReviewTask) {
        await tx.reviewTask.update({
          where: { id: existingReviewTask.id },
          data: {
            review_date: nextReviewDate,
            wrong_question_id: wq.id,
          },
        })
      } else {
        await tx.reviewTask.create({
          data: {
            user_id: user.id,
            subject_id: ownedSubject.id,
            topic: wrongQuestion.topic,
            wrong_question_id: wq.id,
            source_type: REVIEW_TASK_SOURCE_TYPES.wrongQuestion,
            review_date: nextReviewDate,
            review_stage: 1,
          },
        })
      }
    }
  })

  revalidatePath("/practice")
  revalidatePath("/review")
  revalidatePath("/dashboard")
  revalidatePath("/analytics")

  return {
    success: true,
    message: "題庫練習已完成並儲存紀錄。",
    totalQuestions: questions.length,
    correctQuestions,
    wrongQuestionCount: wrongQuestions.length,
  }
}

async function getAccessibleStudyGroupIds(userId: string) {
  const memberships = await prisma.studyGroupMember.findMany({
    where: { user_id: userId },
    select: { study_group_id: true },
  })

  return memberships.map((membership) => membership.study_group_id)
}

function buildAccessibleQuestionWhere(userId: string, accessibleGroupIds: string[]) {
  return {
    OR: [
      {
        user_id: userId,
      },
      ...(accessibleGroupIds.length > 0
        ? [
            {
              visibility: "study_group",
              shared_study_group_id: {
                in: accessibleGroupIds,
              },
            },
          ]
        : []),
    ],
  }
}

async function ensureLocalSubjectId(userId: string, subjectName: string) {
  const existingSubject = await prisma.subject.findFirst({
    where: {
      user_id: userId,
      name: subjectName,
    },
    select: {
      id: true,
    },
  })

  if (existingSubject) {
    return existingSubject.id
  }

  const createdSubject = await prisma.subject.create({
    data: {
      user_id: userId,
      name: subjectName,
    },
    select: {
      id: true,
    },
  })

  return createdSubject.id
}

function stripSharedSubjectPrefix(value: string) {
  return value.startsWith("shared:") ? value.slice("shared:".length) : value
}

function parseSourceQuestionId(questionId: string) {
  return questionId.split("::")[0] ?? questionId
}

function createAnswerKey(sourceQuestionId: string, practiceSubjectId: string) {
  return `${sourceQuestionId}::${practiceSubjectId}`
}

function safeParseOptions(rawOptions: string) {
  try {
    const parsed = JSON.parse(rawOptions) as unknown
    if (Array.isArray(parsed) && parsed.every((option) => typeof option === "string")) {
      return parsed
    }
  } catch {
    return []
  }

  return []
}

function shuffleInPlace<T>(items: T[]) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = items[index]
    items[index] = items[swapIndex]
    items[swapIndex] = current
  }
}
