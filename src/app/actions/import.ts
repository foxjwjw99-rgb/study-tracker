"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { getCurrentUserOrThrow } from "@/lib/current-user"
import { importQuestionsSchema } from "@/app/import/schema"
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

  const uniqueImportSubjects = Array.from(new Set(questions.map((q) => q.subject)))
  const missingSubjects = uniqueImportSubjects.filter((sub) => !subjectMap.has(sub))

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
    dbQuestions.map((q) => `${q.subject_id}::${q.question}`)
  )

  const newQuestionsData = []

  for (const q of questions) {
    const subjectId = subjectMap.get(q.subject)
    if (!subjectId) {
      errorCount += 1
      continue
    }

    const dedupKey = `${subjectId}::${q.question}`
    if (existingQuestionsSet.has(dedupKey)) {
      duplicateCount += 1
      continue
    }

    existingQuestionsSet.add(dedupKey)

    newQuestionsData.push({
      user_id: user.id,
      subject_id: subjectId,
      topic: q.topic,
      external_id: q.external_id,
      question: q.question,
      options: JSON.stringify(q.options),
      answer: q.answer,
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
