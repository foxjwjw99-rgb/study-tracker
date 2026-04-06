"use server"

import { revalidatePath } from "next/cache"

import prisma from "@/lib/prisma"
import {
  assertOwnedRecord,
  getCurrentUserOrThrow,
  OWNERSHIP_ERROR_MESSAGE,
} from "@/lib/current-user"
import { resolveSubjectUnit } from "@/lib/subject-unit"
import { REVIEW_TASK_SOURCE_TYPES } from "@/lib/vocabulary"
import {
  getWrongQuestionInitialReviewDate,
  WRONG_QUESTION_REVIEW_STAGES,
  WRONG_QUESTION_STATUS,
} from "@/lib/wrong-question-review"

import type { PracticeLogListItem } from "@/types"
import type {
  PracticeQuestionAnswerInput,
  PracticeQuestionBankSummary,
  PracticeQuestionItem,
  PracticeQuestionSessionResult,
} from "@/types"

export type QuestionManagementItem = {
  id: string
  topic: string
  question: string
  question_type: "multiple_choice" | "fill_in_blank"
  options: string[]
  answer: number
  text_answer: string | null
  explanation: string | null
  image_url: string | null
  visibility: "private" | "study_group"
  shared_study_group_id: string | null
  created_at: Date
}

export async function getQuestionsForManagement(
  subjectNameOrId: string,
  topic?: string
): Promise<QuestionManagementItem[]> {
  const user = await getCurrentUserOrThrow()
  const normalizedSubjectName = await resolveSubjectName(user.id, subjectNameOrId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questions: any[] = await (prisma.question as any).findMany({
    where: {
      user_id: user.id,
      subject: { name: normalizedSubjectName },
      ...(topic ? { topic } : {}),
    },
    select: {
      id: true,
      topic: true,
      question: true,
      question_type: true,
      options: true,
      answer: true,
      text_answer: true,
      explanation: true,
      image_url: true,
      visibility: true,
      shared_study_group_id: true,
      created_at: true,
    },
    orderBy: [{ topic: "asc" }, { created_at: "asc" }],
  })

  return questions.map((q) => ({
    id: q.id,
    topic: q.topic,
    question: q.question,
    question_type: (q.question_type === "fill_in_blank" ? "fill_in_blank" : "multiple_choice") as "multiple_choice" | "fill_in_blank",
    options: safeParseOptions(q.options),
    answer: q.answer,
    text_answer: (q.text_answer ?? null) as string | null,
    explanation: q.explanation ?? null,
    image_url: q.image_url ?? null,
    visibility: (q.visibility === "study_group" ? "study_group" : "private") as "private" | "study_group",
    shared_study_group_id: q.shared_study_group_id ?? null,
    created_at: q.created_at,
  }))
}

export async function deleteQuestion(id: string) {
  const user = await getCurrentUserOrThrow()
  const question = await prisma.question.findFirst({
    where: { id, user_id: user.id },
    select: { id: true },
  })

  assertOwnedRecord(question, OWNERSHIP_ERROR_MESSAGE)

  await prisma.question.delete({ where: { id, user_id: user.id } })
  revalidatePath("/import")
  revalidatePath("/practice")
}

export async function deleteQuestions(ids: string[]) {
  if (ids.length === 0) return
  const user = await getCurrentUserOrThrow()
  await prisma.question.deleteMany({
    where: { id: { in: ids }, user_id: user.id },
  })
  revalidatePath("/import")
  revalidatePath("/practice")
}

export type UpdateQuestionInput = {
  topic: string
  question: string
  options: string[]
  answer: number
  explanation: string | null
}

export async function updateQuestion(id: string, data: UpdateQuestionInput) {
  const user = await getCurrentUserOrThrow()
  const existing = await prisma.question.findFirst({
    where: { id, user_id: user.id },
    select: { id: true },
  })

  assertOwnedRecord(existing, OWNERSHIP_ERROR_MESSAGE)

  await prisma.question.update({
    where: { id },
    data: {
      topic: data.topic,
      question: data.question,
      options: JSON.stringify(data.options),
      answer: data.answer,
      explanation: data.explanation,
    },
  })
  revalidatePath("/import")
  revalidatePath("/practice")
}

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
    take: 50,
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
  const normalizedSubjectName = await resolveSubjectName(user.id, subjectNameOrId)

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

export async function getPracticeQuestionUnits(
  subjectNameOrId: string
): Promise<{ unitId: string; unitName: string; count: number }[]> {
  const user = await getCurrentUserOrThrow()
  const accessibleGroupIds = await getAccessibleStudyGroupIds(user.id)
  const normalizedSubjectName = await resolveSubjectName(user.id, subjectNameOrId)

  const questions = await prisma.question.findMany({
    where: {
      ...buildAccessibleQuestionWhere(user.id, accessibleGroupIds),
      subject: { name: normalizedSubjectName },
    },
    select: {
      unit_id: true,
      unit: { select: { name: true } },
    },
  })

  const countByUnit = new Map<string, { unitName: string; count: number }>()
  for (const q of questions) {
    const unitId = q.unit_id
    const unitName = q.unit?.name ?? q.unit_id
    const existing = countByUnit.get(unitId)
    if (existing) {
      existing.count += 1
    } else {
      countByUnit.set(unitId, { unitName, count: 1 })
    }
  }

  return Array.from(countByUnit.entries())
    .map(([unitId, { unitName, count }]) => ({ unitId, unitName, count }))
    .sort((a, b) => a.unitName.localeCompare(b.unitName, "zh-Hant"))
}

export async function getPracticeQuestions(
  subjectNameOrId: string,
  requestedCount: number,
  unitId?: string
): Promise<PracticeQuestionItem[]> {
  const user = await getCurrentUserOrThrow()
  const accessibleGroupIds = await getAccessibleStudyGroupIds(user.id)

  const normalizedSubjectName = await resolveSubjectName(user.id, subjectNameOrId)
  const practiceSubjectId = await ensureLocalSubjectId(user.id, normalizedSubjectName)

  const questions = await prisma.question.findMany({
    where: {
      ...buildAccessibleQuestionWhere(user.id, accessibleGroupIds),
      subject: {
        name: normalizedSubjectName,
      },
      ...(unitId ? { unit_id: unitId } : {}),
    },
    include: {
      unit: { select: { id: true, name: true } },
      group: {
        select: {
          id: true,
          title: true,
          context: true,
        },
      },
      shared_study_group: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ created_at: "desc" }],
  })

  const parsedQuestions = buildPracticeSessionQuestions(questions, practiceSubjectId, normalizedSubjectName)

  if (requestedCount <= 0 || requestedCount >= parsedQuestions.length) {
    return parsedQuestions
  }

  return parsedQuestions.slice(0, requestedCount)
}

export async function getPracticeQuestionsWeakFirst(
  subjectNameOrId: string,
  requestedCount: number
): Promise<PracticeQuestionItem[]> {
  const user = await getCurrentUserOrThrow()
  const accessibleGroupIds = await getAccessibleStudyGroupIds(user.id)
  const normalizedSubjectName = await resolveSubjectName(user.id, subjectNameOrId)
  const practiceSubjectId = await ensureLocalSubjectId(user.id, normalizedSubjectName)

  // Get units with unresolved wrong questions
  const wrongUnits = await prisma.wrongQuestion.findMany({
    where: {
      user_id: user.id,
      subject: { name: normalizedSubjectName },
      status: { not: "MASTERED" },
      unit_id: { not: null },
    },
    select: { unit_id: true },
    distinct: ["unit_id"],
  })
  const weakUnitSet = new Set(wrongUnits.map((wq) => wq.unit_id).filter(Boolean) as string[])

  const allQuestions = await prisma.question.findMany({
    where: {
      ...buildAccessibleQuestionWhere(user.id, accessibleGroupIds),
      subject: { name: normalizedSubjectName },
    },
    include: {
      unit: { select: { id: true, name: true } },
      group: {
        select: {
          id: true,
          title: true,
          context: true,
        },
      },
      shared_study_group: { select: { id: true, name: true } },
    },
    orderBy: [{ created_at: "desc" }],
  })

  const orderedQuestions = buildPracticeSessionQuestions(allQuestions, practiceSubjectId, normalizedSubjectName)
  const weakQuestions: PracticeQuestionItem[] = []
  const otherQuestions: PracticeQuestionItem[] = []

  for (const item of orderedQuestions) {
    if (item.unit_id && weakUnitSet.has(item.unit_id)) {
      weakQuestions.push(item)
    } else {
      otherQuestions.push(item)
    }
  }

  const result = [...weakQuestions, ...otherQuestions]

  if (requestedCount <= 0 || requestedCount >= result.length) {
    return result
  }
  return result.slice(0, requestedCount)
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
  unit_id?: string | null
  unit_name?: string | null
  question_id?: string | null
  question_text?: string | null
  correct_answer_text?: string | null
  user_answer_text?: string | null
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

  const next_review_date = getWrongQuestionInitialReviewDate(data.first_wrong_date)

  const resolvedUnit = await resolveSubjectUnit(prisma, {
    subjectId: data.subject_id,
    unitId: data.unit_id,
    unitName: data.unit_name,
    topic: data.topic,
    createIfMissing: true,
    source: "SYSTEM",
  })

  const wq = await prisma.wrongQuestion.create({
    data: {
      user_id: user.id,
      subject_id: data.subject_id,
      topic: resolvedUnit.topicSnapshot || data.topic,
      unit_id: resolvedUnit.unitId,
      question_id: data.question_id ?? null,
      question_text: data.question_text ?? null,
      correct_answer_text: data.correct_answer_text ?? null,
      user_answer_text: data.user_answer_text ?? null,
      source: data.source,
      source_type: "manual_add",
      error_reason: data.error_reason,
      first_wrong_date: data.first_wrong_date,
      last_wrong_date: data.first_wrong_date,
      status: WRONG_QUESTION_STATUS.pending,
      next_review_date,
      wrong_count: 1,
      notes: data.notes,
      is_manual_added: true,
    },
  })

  await prisma.reviewTask.create({
    data: {
      user_id: user.id,
      subject_id: data.subject_id,
      topic: resolvedUnit.topicSnapshot || data.topic,
      unit_id: resolvedUnit.unitId,
      wrong_question_id: wq.id,
      source_type: REVIEW_TASK_SOURCE_TYPES.wrongQuestion,
      review_date: next_review_date,
      review_stage: WRONG_QUESTION_REVIEW_STAGES[0],
    },
  })

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
    data.answers.map((answer) => [answer.question_id, answer])
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
    const answer = answerMap.get(createAnswerKey(question.id, ownedSubject.id))
    if (question.question_type === "fill_in_blank") {
      return answer?.is_user_correct !== true
    }
    return answer?.selected_answer !== question.answer
  })
  const correctQuestions = questions.length - wrongQuestions.length
  const durationMinutes = Math.max(1, Math.round(data.duration_seconds / 60))
  const practiceDate = new Date()
  const uniqueUnitIds = [...new Set(questions.map((question) => question.unit_id).filter(Boolean))]
  const uniqueTopics = [...new Set(questions.map((question) => question.topic))]
  const unitNameById = new Map<string, string>()
  for (const question of questions) {
    if (question.unit_id && !unitNameById.has(question.unit_id)) {
      unitNameById.set(question.unit_id, question.topic)
    }
  }
  const uniqueUnitNames = [...unitNameById.values()]
  const topicLabel =
    uniqueUnitNames.length === 1
      ? uniqueUnitNames[0]
      : uniqueTopics.length === 1
        ? uniqueTopics[0]
        : `題庫練習（${Math.max(uniqueUnitIds.length, uniqueTopics.length)} 個單元）`
  const usedSharedQuestions = questions.some((question) => question.visibility === "study_group")

  const questionResults = await prisma.$transaction(async (tx) => {
    const sessionUnit =
      uniqueUnitIds.length === 1
        ? await resolveSubjectUnit(tx, {
            subjectId: ownedSubject.id,
            unitId: questions[0]?.unit_id ?? null,
            topic: uniqueUnitNames[0] ?? uniqueTopics[0] ?? topicLabel,
            createIfMissing: true,
            source: "SYSTEM",
          })
        : uniqueUnitNames.length === 1
          ? await resolveSubjectUnit(tx, {
              subjectId: ownedSubject.id,
              topic: uniqueUnitNames[0],
              createIfMissing: true,
              source: "SYSTEM",
            })
          : { unitId: null, topicSnapshot: topicLabel }

    await tx.practiceLog.create({
      data: {
        user_id: user.id,
        subject_id: ownedSubject.id,
        topic: sessionUnit.topicSnapshot || topicLabel,
        unit_id: sessionUnit.unitId,
        source: usedSharedQuestions ? "共享題庫" : "匯入題庫",
        practice_date: practiceDate,
        total_questions: questions.length,
        correct_questions: correctQuestions,
        duration_minutes: durationMinutes,
        error_type: wrongQuestions.length > 0 ? "不會" : undefined,
        notes: `題庫練習完成，共 ${questions.length} 題，答對 ${correctQuestions} 題。`,
      },
    })

    const questionResults: NonNullable<PracticeQuestionSessionResult["questionResults"]> = []

    for (const q of questions) {
      const answer = answerMap.get(createAnswerKey(q.id, ownedSubject.id))
      const parsedOptions = safeParseOptions(q.options)
      const isCorrect = q.question_type === "fill_in_blank"
        ? answer?.is_user_correct === true
        : answer?.selected_answer === q.answer
      questionResults.push({
        question_id: q.id,
        topic: q.topic,
        question: q.question,
        question_type: q.question_type as "multiple_choice" | "fill_in_blank",
        options: parsedOptions,
        answer: q.answer,
        text_answer: q.text_answer ?? null,
        explanation: q.explanation ?? null,
        isCorrect,
        selectedAnswer: answer?.selected_answer ?? null,
        typedAnswer: answer?.text_answer ?? null,
        wrongQuestionId: null,
      })
    }

    for (const wrongQuestion of wrongQuestions) {
      const nextReviewDate = getWrongQuestionInitialReviewDate(practiceDate)

      const answer = answerMap.get(createAnswerKey(wrongQuestion.id, ownedSubject.id))
      let selectedAnswerText: string
      let correctAnswerText: string
      if (wrongQuestion.question_type === "fill_in_blank") {
        selectedAnswerText = answer?.text_answer || "未作答"
        correctAnswerText = wrongQuestion.text_answer ?? "（見題目）"
      } else {
        const parsedOptions = safeParseOptions(wrongQuestion.options)
        const selectedIdx = answer?.selected_answer
        selectedAnswerText =
          selectedIdx === null || selectedIdx === undefined
            ? "未作答"
            : parsedOptions[selectedIdx] || `選項 ${selectedIdx + 1}`
        correctAnswerText =
          parsedOptions[wrongQuestion.answer] || `選項 ${wrongQuestion.answer + 1}`
      }

      const resolvedUnit = await resolveSubjectUnit(tx, {
        subjectId: ownedSubject.id,
        unitId: wrongQuestion.unit_id,
        topic: wrongQuestion.topic,
        createIfMissing: true,
        source: "SYSTEM",
      })

      const sourceLabel = wrongQuestion.visibility === "study_group" ? "共享題庫" : "題庫練習"
      const newNotes = `題目：${wrongQuestion.question}\n你的答案：${selectedAnswerText}\n正確答案：${correctAnswerText}`

      const existingWq = await tx.wrongQuestion.findFirst({
        where: { user_id: user.id, question_id: wrongQuestion.id, status: { not: "ARCHIVED" } },
        select: { id: true, status: true },
      })

      let wqId: string
      if (existingWq) {
        const wasAlreadyMastered = existingWq.status === "MASTERED"
        await tx.wrongQuestion.update({
          where: { id: existingWq.id },
          data: {
            wrong_count: { increment: 1 },
            last_wrong_date: practiceDate,
            user_answer_text: selectedAnswerText,
            notes: newNotes,
            ...(wasAlreadyMastered ? {
              status: WRONG_QUESTION_STATUS.pending,
              next_review_date: nextReviewDate,
              correct_streak: 0,
            } : {}),
          },
        })
        wqId = existingWq.id
        if (wasAlreadyMastered) {
          await tx.reviewTask.create({
            data: {
              user_id: user.id,
              subject_id: ownedSubject.id,
              topic: resolvedUnit.topicSnapshot || wrongQuestion.topic,
              unit_id: resolvedUnit.unitId,
              wrong_question_id: existingWq.id,
              source_type: REVIEW_TASK_SOURCE_TYPES.wrongQuestion,
              review_date: nextReviewDate,
              review_stage: WRONG_QUESTION_REVIEW_STAGES[0],
            },
          })
        }
      } else {
        const wq = await tx.wrongQuestion.create({
          data: {
            user_id: user.id,
            subject_id: ownedSubject.id,
            question_id: wrongQuestion.id,
            unit_id: resolvedUnit.unitId,
            topic: resolvedUnit.topicSnapshot || wrongQuestion.topic,
            question_text: wrongQuestion.question,
            correct_answer_text: correctAnswerText,
            user_answer_text: selectedAnswerText,
            source: sourceLabel,
            source_type: "wrong_answer",
            error_reason: "題庫練習答錯",
            first_wrong_date: practiceDate,
            last_wrong_date: practiceDate,
            status: WRONG_QUESTION_STATUS.pending,
            wrong_count: 1,
            next_review_date: nextReviewDate,
            notes: newNotes,
          },
        })
        wqId = wq.id
        await tx.reviewTask.create({
          data: {
            user_id: user.id,
            subject_id: ownedSubject.id,
            topic: resolvedUnit.topicSnapshot || wrongQuestion.topic,
            unit_id: resolvedUnit.unitId,
            wrong_question_id: wq.id,
            source_type: REVIEW_TASK_SOURCE_TYPES.wrongQuestion,
            review_date: nextReviewDate,
            review_stage: WRONG_QUESTION_REVIEW_STAGES[0],
          },
        })
      }

      const resultEntry = questionResults.find((r) => r.question_id === wrongQuestion.id)
      if (resultEntry) {
        resultEntry.wrongQuestionId = wqId
      }
    }

    return questionResults
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
    questionResults,
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

async function resolveSubjectName(userId: string, subjectNameOrId: string): Promise<string> {
  const ownSubject = await prisma.subject.findFirst({
    where: { OR: [{ id: subjectNameOrId, user_id: userId }, { name: subjectNameOrId, user_id: userId }] },
    select: { name: true },
  })
  return ownSubject?.name ?? stripSharedSubjectPrefix(subjectNameOrId)
}

function parseSourceQuestionId(questionId: string) {
  return questionId.split("::")[0] ?? questionId
}

function createAnswerKey(sourceQuestionId: string, practiceSubjectId: string) {
  return `${sourceQuestionId}::${practiceSubjectId}`
}

function buildPracticeQuestionItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  question: any,
  practiceSubjectId: string,
  subjectName: string,
): PracticeQuestionItem | null {
  const isFib = question.question_type === "fill_in_blank"
  const base = {
    id: createAnswerKey(question.id, practiceSubjectId),
    source_question_id: question.id,
    subject_id: practiceSubjectId,
    subject_name: subjectName,
    topic: question.topic,
    unit_id: question.unit_id ?? null,
    unit_name: question.unit?.name ?? question.topic,
    group_id: question.group_id ?? null,
    group_title: question.group?.title ?? null,
    group_context: question.group?.context ?? null,
    group_order: question.group_order ?? null,
    question: question.question,
    explanation: question.explanation,
    image_url: question.image_url,
    visibility: question.visibility === "study_group" ? "study_group" : "private",
    shared_study_group_id: question.shared_study_group_id,
    shared_study_group_name: question.shared_study_group?.name ?? null,
  } satisfies Omit<PracticeQuestionItem, "question_type" | "options" | "answer" | "text_answer">

  if (isFib) {
    return {
      ...base,
      question_type: "fill_in_blank",
      options: [],
      answer: 0,
      text_answer: question.text_answer ?? null,
    }
  }

  const options = safeParseOptions(question.options)
  if (options.length === 0) return null

  return {
    ...base,
    question_type: "multiple_choice",
    options,
    answer: question.answer,
    text_answer: null,
  }
}

function buildPracticeSessionQuestions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  questions: any[],
  practiceSubjectId: string,
  subjectName: string,
) {
  const grouped = new Map<string, PracticeQuestionItem[]>()
  const standalone: PracticeQuestionItem[] = []

  for (const question of questions) {
    const item = buildPracticeQuestionItem(question, practiceSubjectId, subjectName)
    if (!item) continue

    if (item.group_id) {
      const key = item.group_id
      const current = grouped.get(key) ?? []
      current.push(item)
      grouped.set(key, current)
      continue
    }

    standalone.push(item)
  }

  const groupedBlocks = Array.from(grouped.values()).map((items) =>
    items.sort((a, b) => {
      const orderDiff = (a.group_order ?? Number.MAX_SAFE_INTEGER) - (b.group_order ?? Number.MAX_SAFE_INTEGER)
      if (orderDiff !== 0) return orderDiff
      return a.id.localeCompare(b.id, "zh-Hant")
    })
  )

  shuffleInPlace(standalone)
  shuffleInPlace(groupedBlocks)

  return [...groupedBlocks.flat(), ...standalone]
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
