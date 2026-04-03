"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { getCurrentUserOrThrow } from "@/lib/current-user"
import { importQuestionsSchema, importQuestionGroupsSchema } from "@/app/import/schema"
import type { QuestionImportTarget } from "@/types"

export type ImportResult = {
  success: boolean
  message: string
  validCount: number
  duplicateCount: number
  errorCount: number
}

const DEFAULT_IMPORT_TARGET: QuestionImportTarget = {
  visibility: "private",
}

export async function importQuestions(
  data: unknown,
  importTarget: QuestionImportTarget = DEFAULT_IMPORT_TARGET
): Promise<ImportResult> {
  const user = await getCurrentUserOrThrow()

  const parsed = importQuestionsSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      message: "JSON 格式錯誤。請檢查格式要求。",
      validCount: 0,
      duplicateCount: 0,
      errorCount: 0,
    }
  }

  const normalizedTarget = await resolveImportTarget(user.id, importTarget)
  if (!normalizedTarget.success) {
    return {
      success: false,
      message: normalizedTarget.message,
      validCount: 0,
      duplicateCount: 0,
      errorCount: 0,
    }
  }

  const questions = parsed.data
  let validCount = 0
  let duplicateCount = 0
  let errorCount = 0

  const dbSubjects = await prisma.subject.findMany({ where: { user_id: user.id } })
  const subjectMap = new Map<string, string>(
    dbSubjects.map((subject) => [subject.name, subject.id])
  )

  const MAX_SUBJECTS_PER_USER = 200
  const uniqueImportSubjects = Array.from(new Set(questions.map((q) => q.subject)))
  const missingSubjects = uniqueImportSubjects.filter((sub) => !subjectMap.has(sub))

  if (dbSubjects.length + missingSubjects.length > MAX_SUBJECTS_PER_USER) {
    return {
      success: false,
      message: `科目數量已達上限（${MAX_SUBJECTS_PER_USER} 個），請先刪除不需要的科目再匯入。`,
      validCount: 0,
      duplicateCount: 0,
      errorCount: questions.length,
    }
  }

  if (missingSubjects.length > 0) {
    try {
      await prisma.subject.createMany({
        data: missingSubjects.map((name) => ({
          user_id: user.id,
          name,
        })),
      })
      const newSubjects = await prisma.subject.findMany({
        where: {
          user_id: user.id,
          name: { in: missingSubjects },
        },
      })
      for (const sub of newSubjects) {
        subjectMap.set(sub.name, sub.id)
      }
    } catch (e) {
      console.error("Error creating subjects", e)
      return {
        success: false,
        message: "建立科目失敗。",
        validCount: 0,
        duplicateCount: 0,
        errorCount: questions.length,
      }
    }
  }

  const dbQuestions = await prisma.question.findMany({
    where: { user_id: user.id },
    select: { subject_id: true, question: true },
  })

  const existingQuestionsSet = new Set(
    dbQuestions.map((q) => JSON.stringify([q.subject_id, q.question]))
  )

  const newQuestionsData = []

  for (const q of questions) {
    const subjectId = subjectMap.get(q.subject)
    if (!subjectId) {
      errorCount += 1
      continue
    }

    const dedupKey = JSON.stringify([subjectId, q.question])
    if (existingQuestionsSet.has(dedupKey)) {
      duplicateCount += 1
      continue
    }

    existingQuestionsSet.add(dedupKey)

    const isFib = "question_type" in q && q.question_type === "fill_in_blank"
    newQuestionsData.push({
      user_id: user.id,
      subject_id: subjectId,
      topic: q.topic,
      external_id: q.external_id,
      question: q.question,
      question_type: isFib ? "fill_in_blank" : "multiple_choice",
      options: isFib ? "[]" : JSON.stringify((q as { options: string[] }).options),
      answer: isFib ? 0 : (q as { answer: number }).answer,
      text_answer: isFib ? (q as { text_answer: string }).text_answer : null,
      explanation: q.explanation,
      image_url: q.image ?? null,
      visibility: normalizedTarget.target.visibility,
      shared_study_group_id: normalizedTarget.target.shared_study_group_id ?? null,
    })
  }

  if (newQuestionsData.length > 0) {
    try {
      const result = await prisma.question.createMany({
        data: newQuestionsData,
      })
      validCount = result.count
    } catch (e) {
      console.error("Error creating questions batch", e)
      errorCount += newQuestionsData.length
    }
  }

  revalidatePath("/practice")
  revalidatePath("/import")

  return {
    success: true,
    message:
      normalizedTarget.target.visibility === "study_group"
        ? "匯入結束，題目已分享到讀書房。"
        : "匯入結束。",
    validCount,
    duplicateCount,
    errorCount,
  }
}

async function resolveImportTarget(userId: string, importTarget: QuestionImportTarget) {
  if (importTarget.visibility === "private") {
    return {
      success: true as const,
      target: {
        visibility: "private" as const,
      },
    }
  }

  if (!importTarget.shared_study_group_id) {
    return {
      success: false as const,
      message: "請選擇要分享的讀書房。",
    }
  }

  const membership = await prisma.studyGroupMember.findFirst({
    where: {
      user_id: userId,
      study_group_id: importTarget.shared_study_group_id,
    },
    select: {
      study_group_id: true,
    },
  })

  if (!membership) {
    return {
      success: false as const,
      message: "你不在這個讀書房中，不能分享題目。",
    }
  }

  return {
    success: true as const,
    target: {
      visibility: "study_group" as const,
      shared_study_group_id: membership.study_group_id,
    },
  }
}

export type ImportGroupResult = {
  success: boolean
  message: string
  groupCount: number
  questionCount: number
  duplicateGroupCount: number
  errorCount: number
}

export async function importQuestionGroups(
  data: unknown,
  importTarget: QuestionImportTarget = DEFAULT_IMPORT_TARGET
): Promise<ImportGroupResult> {
  const user = await getCurrentUserOrThrow()

  const parsed = importQuestionGroupsSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      message: "格式錯誤。請檢查題組格式要求。",
      groupCount: 0,
      questionCount: 0,
      duplicateGroupCount: 0,
      errorCount: 0,
    }
  }

  const normalizedTarget = await resolveImportTarget(user.id, importTarget)
  if (!normalizedTarget.success) {
    return {
      success: false,
      message: normalizedTarget.message,
      groupCount: 0,
      questionCount: 0,
      duplicateGroupCount: 0,
      errorCount: 0,
    }
  }

  const groups = parsed.data

  // Ensure subjects exist
  const dbSubjects = await prisma.subject.findMany({ where: { user_id: user.id } })
  const subjectMap = new Map<string, string>(dbSubjects.map((s) => [s.name, s.id]))

  const uniqueSubjects = Array.from(new Set(groups.map((g) => g.subject)))
  const missingSubjects = uniqueSubjects.filter((name) => !subjectMap.has(name))

  if (missingSubjects.length > 0) {
    await prisma.subject.createMany({
      data: missingSubjects.map((name) => ({ user_id: user.id, name })),
    })
    const newSubjects = await prisma.subject.findMany({
      where: { user_id: user.id, name: { in: missingSubjects } },
    })
    for (const sub of newSubjects) {
      subjectMap.set(sub.name, sub.id)
    }
  }

  // Load existing groups for dedup (keyed by user_id + subject_id + context)
  const existingGroups = await prisma.questionGroup.findMany({
    where: { user_id: user.id },
    select: { subject_id: true, context: true },
  })
  const existingGroupKeys = new Set(
    existingGroups.map((g) => JSON.stringify([g.subject_id, g.context]))
  )

  // Load existing questions for dedup
  const existingQs = await prisma.question.findMany({
    where: { user_id: user.id },
    select: { subject_id: true, question: true },
  })
  const existingQKeys = new Set(existingQs.map((q) => JSON.stringify([q.subject_id, q.question])))

  let groupCount = 0
  let questionCount = 0
  let duplicateGroupCount = 0
  let errorCount = 0

  for (const group of groups) {
    const subjectId = subjectMap.get(group.subject)
    if (!subjectId) {
      errorCount += group.questions.length
      continue
    }

    const groupKey = JSON.stringify([subjectId, group.context])
    if (existingGroupKeys.has(groupKey)) {
      duplicateGroupCount += 1
      continue
    }
    existingGroupKeys.add(groupKey)

    try {
      const createdGroup = await prisma.questionGroup.create({
        data: {
          user_id: user.id,
          subject_id: subjectId,
          topic: group.topic,
          title: group.title ?? null,
          context: group.context,
        },
      })
      groupCount += 1

      const questionsToCreate = []
      for (let i = 0; i < group.questions.length; i++) {
        const q = group.questions[i]
        const qKey = JSON.stringify([subjectId, q.question])
        if (existingQKeys.has(qKey)) continue
        existingQKeys.add(qKey)

        const isFib = "question_type" in q && q.question_type === "fill_in_blank"
        questionsToCreate.push({
          user_id: user.id,
          subject_id: subjectId,
          topic: group.topic,
          external_id: q.external_id ?? null,
          question: q.question,
          question_type: isFib ? "fill_in_blank" : "multiple_choice",
          options: isFib ? "[]" : JSON.stringify((q as { options: string[] }).options),
          answer: isFib ? 0 : (q as { answer: number }).answer,
          text_answer: isFib ? (q as { text_answer: string }).text_answer : null,
          explanation: q.explanation ?? null,
          image_url: null,
          visibility: normalizedTarget.target.visibility,
          shared_study_group_id:
            normalizedTarget.target.visibility === "study_group"
              ? normalizedTarget.target.shared_study_group_id
              : null,
          group_id: createdGroup.id,
          group_order: i,
        })
      }

      if (questionsToCreate.length > 0) {
        const result = await prisma.question.createMany({ data: questionsToCreate })
        questionCount += result.count
      }
    } catch (e) {
      console.error("Error creating question group", e)
      errorCount += group.questions.length
    }
  }

  revalidatePath("/practice")
  revalidatePath("/import")

  return {
    success: true,
    message:
      normalizedTarget.target.visibility === "study_group"
        ? "題組匯入完成，已分享到讀書房。"
        : "題組匯入完成。",
    groupCount,
    questionCount,
    duplicateGroupCount,
    errorCount,
  }
}
