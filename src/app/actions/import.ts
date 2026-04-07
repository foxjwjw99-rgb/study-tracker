"use server"

import { revalidatePath } from "next/cache"

import type { Prisma } from "@prisma/client"

import prisma from "@/lib/prisma"
import { getCurrentUserOrThrow } from "@/lib/current-user"
import { resolveSubjectUnit } from "@/lib/subject-unit"
import {
  importPayloadSchema,
  importQuestionGroupsSchema,
  isImportedQuestionGroup,
  type ImportedQuestion,
  type ImportedQuestionGroup,
} from "@/app/import/schema"
import type { QuestionImportTarget } from "@/types"

export type ImportResult = {
  success: boolean
  message: string
  validCount: number
  duplicateCount: number
  errorCount: number
  groupCount: number
  groupQuestionCount: number
  duplicateGroupCount: number
}

const DEFAULT_IMPORT_TARGET: QuestionImportTarget = {
  visibility: "private",
}

export async function importQuestions(
  data: unknown,
  importTarget: QuestionImportTarget = DEFAULT_IMPORT_TARGET,
): Promise<ImportResult> {
  const user = await getCurrentUserOrThrow()

  const parsed = importPayloadSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      message: "JSON 格式錯誤。請檢查匯入格式要求。",
      validCount: 0,
      duplicateCount: 0,
      errorCount: 0,
      groupCount: 0,
      groupQuestionCount: 0,
      duplicateGroupCount: 0,
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
      groupCount: 0,
      groupQuestionCount: 0,
      duplicateGroupCount: 0,
    }
  }

  const items = parsed.data
  const subjectMap = await ensureSubjectsForImport(user.id, items.map((item) => item.subject))
  if (!subjectMap) {
    return {
      success: false,
      message: "建立科目失敗。",
      validCount: 0,
      duplicateCount: 0,
      errorCount: items.length,
      groupCount: 0,
      groupQuestionCount: 0,
      duplicateGroupCount: 0,
    }
  }

  const existing = await loadExistingImportState(user.id)
  const payloadState = createPayloadSeenState()
  let validCount = 0
  let duplicateCount = 0
  let errorCount = 0
  let groupCount = 0
  let groupQuestionCount = 0
  let duplicateGroupCount = 0

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const subjectId = subjectMap.get(item.subject)
        if (!subjectId) {
          errorCount += isImportedQuestionGroup(item) ? item.questions.length : 1
          continue
        }

        if (isImportedQuestionGroup(item)) {
          const result = await importSingleGroup(tx, user.id, subjectId, item, normalizedTarget.target, existing, payloadState)
          groupCount += result.groupCount
          groupQuestionCount += result.questionCount
          duplicateGroupCount += result.duplicateGroupCount
          duplicateCount += result.duplicateQuestionCount
          errorCount += result.errorCount
        } else {
          const result = await importSingleQuestion(tx, user.id, subjectId, item, normalizedTarget.target, existing, payloadState)
          validCount += result.validCount
          duplicateCount += result.duplicateCount
          errorCount += result.errorCount
        }
      }
    })
  } catch (error) {
    console.error("Error importing question payload", error)
    return {
      success: false,
      message: "匯入過程中發生錯誤，請稍後再試。",
      validCount,
      duplicateCount,
      errorCount: errorCount + 1,
      groupCount,
      groupQuestionCount,
      duplicateGroupCount,
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
    groupCount,
    groupQuestionCount,
    duplicateGroupCount,
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
  importTarget: QuestionImportTarget = DEFAULT_IMPORT_TARGET,
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
  const subjectMap = await ensureSubjectsForImport(user.id, groups.map((group) => group.subject))
  if (!subjectMap) {
    return {
      success: false,
      message: "建立科目失敗。",
      groupCount: 0,
      questionCount: 0,
      duplicateGroupCount: 0,
      errorCount: groups.length,
    }
  }

  const existing = await loadExistingImportState(user.id)
  const payloadState = createPayloadSeenState()
  let groupCount = 0
  let questionCount = 0
  let duplicateGroupCount = 0
  let errorCount = 0

  try {
    await prisma.$transaction(async (tx) => {
      for (const group of groups) {
        const subjectId = subjectMap.get(group.subject)
        if (!subjectId) {
          errorCount += group.questions.length
          continue
        }

        const result = await importSingleGroup(tx, user.id, subjectId, group, normalizedTarget.target, existing, payloadState)
        groupCount += result.groupCount
        questionCount += result.questionCount
        duplicateGroupCount += result.duplicateGroupCount
        errorCount += result.errorCount
      }
    })
  } catch (error) {
    console.error("Error importing question groups", error)
    return {
      success: false,
      message: "題組匯入失敗，請稍後再試。",
      groupCount,
      questionCount,
      duplicateGroupCount,
      errorCount: errorCount + 1,
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

type NormalizedImportTarget = Awaited<ReturnType<typeof resolveImportTarget>> extends { success: true; target: infer T }
  ? T
  : never

type ExistingImportState = {
  questionExternalIds: Set<string>
  questionTextKeys: Set<string>
  groupExternalIds: Set<string>
  groupTextKeys: Set<string>
}

type PayloadSeenState = {
  questionExternalIds: Set<string>
  questionTextKeys: Set<string>
  groupExternalIds: Set<string>
  groupTextKeys: Set<string>
}

async function ensureSubjectsForImport(userId: string, subjectNames: string[]) {
  const dbSubjects = await prisma.subject.findMany({ where: { user_id: userId } })
  const subjectMap = new Map<string, string>(dbSubjects.map((subject) => [subject.name, subject.id]))

  const MAX_SUBJECTS_PER_USER = 200
  const uniqueImportSubjects = Array.from(new Set(subjectNames))
  const missingSubjects = uniqueImportSubjects.filter((name) => !subjectMap.has(name))

  if (dbSubjects.length + missingSubjects.length > MAX_SUBJECTS_PER_USER) {
    return null
  }

  if (missingSubjects.length > 0) {
    await prisma.subject.createMany({
      data: missingSubjects.map((name) => ({
        user_id: userId,
        name,
      })),
    })

    const newSubjects = await prisma.subject.findMany({
      where: {
        user_id: userId,
        name: { in: missingSubjects },
      },
    })

    for (const subject of newSubjects) {
      subjectMap.set(subject.name, subject.id)
    }
  }

  return subjectMap
}

async function loadExistingImportState(userId: string): Promise<ExistingImportState> {
  const [questions, groups] = await Promise.all([
    prisma.question.findMany({
      where: { user_id: userId },
      select: { subject_id: true, question: true, external_id: true },
    }),
    prisma.questionGroup.findMany({
      where: { user_id: userId },
      select: { subject_id: true, context: true, external_id: true },
    }),
  ])

  return {
    questionExternalIds: new Set(
      questions
        .filter((question) => question.external_id)
        .map((question) => JSON.stringify([question.subject_id, question.external_id])),
    ),
    questionTextKeys: new Set(
      questions.map((question) => JSON.stringify([question.subject_id, question.question.trim()])),
    ),
    groupExternalIds: new Set(
      groups
        .filter((group) => group.external_id)
        .map((group) => JSON.stringify([group.subject_id, group.external_id])),
    ),
    groupTextKeys: new Set(
      groups.map((group) => JSON.stringify([group.subject_id, group.context.trim()])),
    ),
  }
}

function createPayloadSeenState(): PayloadSeenState {
  return {
    questionExternalIds: new Set<string>(),
    questionTextKeys: new Set<string>(),
    groupExternalIds: new Set<string>(),
    groupTextKeys: new Set<string>(),
  }
}

function questionExternalKey(subjectId: string, externalId: string) {
  return JSON.stringify([subjectId, externalId])
}

function questionTextKey(subjectId: string, question: string) {
  return JSON.stringify([subjectId, question.trim()])
}

function groupExternalKey(subjectId: string, externalId: string) {
  return JSON.stringify([subjectId, externalId])
}

function groupTextKey(subjectId: string, groupContext: string) {
  return JSON.stringify([subjectId, groupContext.trim()])
}

async function importSingleQuestion(
  tx: Prisma.TransactionClient,
  userId: string,
  subjectId: string,
  question: ImportedQuestion,
  importTarget: NormalizedImportTarget,
  existing: ExistingImportState,
  payloadState: PayloadSeenState,
) {
  if (question.external_id) {
    const externalKey = questionExternalKey(subjectId, question.external_id)
    if (existing.questionExternalIds.has(externalKey) || payloadState.questionExternalIds.has(externalKey)) {
      return { validCount: 0, duplicateCount: 1, errorCount: 0 }
    }
    payloadState.questionExternalIds.add(externalKey)
  }

  const textKey = questionTextKey(subjectId, question.question)
  if (existing.questionTextKeys.has(textKey) || payloadState.questionTextKeys.has(textKey)) {
    return { validCount: 0, duplicateCount: 1, errorCount: 0 }
  }

  payloadState.questionTextKeys.add(textKey)

  const isFib = question.question_type === "fill_in_blank"
  const resolvedUnit = await resolveSubjectUnit(tx, {
    subjectId,
    topic: question.topic,
    createIfMissing: true,
    source: "IMPORTED",
  })

  await tx.question.create({
    data: {
      user_id: userId,
      subject_id: subjectId,
      topic: resolvedUnit.topicSnapshot || question.topic,
      unit_id: resolvedUnit.unitId!,
      external_id: question.external_id,
      question: question.question,
      question_type: isFib ? "fill_in_blank" : "multiple_choice",
      options: isFib ? "[]" : JSON.stringify(question.options),
      answer: isFib ? 0 : question.answer,
      text_answer: isFib ? question.text_answer : null,
      explanation: question.explanation ?? null,
      image_url: question.image ?? null,
      table_data: question.table ? JSON.stringify(question.table) : null,
      visibility: importTarget.visibility,
      shared_study_group_id: importTarget.visibility === "study_group" ? importTarget.shared_study_group_id : null,
    },
  })

  existing.questionTextKeys.add(textKey)
  if (question.external_id) {
    existing.questionExternalIds.add(questionExternalKey(subjectId, question.external_id))
  }

  return { validCount: 1, duplicateCount: 0, errorCount: 0 }
}

async function importSingleGroup(
  tx: Prisma.TransactionClient,
  userId: string,
  subjectId: string,
  group: ImportedQuestionGroup,
  importTarget: NormalizedImportTarget,
  existing: ExistingImportState,
  payloadState: PayloadSeenState,
) {
  if (group.external_id) {
    const externalKey = groupExternalKey(subjectId, group.external_id)
    if (existing.groupExternalIds.has(externalKey) || payloadState.groupExternalIds.has(externalKey)) {
      return { groupCount: 0, questionCount: 0, duplicateGroupCount: 1, duplicateQuestionCount: 0, errorCount: 0 }
    }
    payloadState.groupExternalIds.add(externalKey)
  }

  const textKey = groupTextKey(subjectId, group.group_context)
  if (existing.groupTextKeys.has(textKey) || payloadState.groupTextKeys.has(textKey)) {
    return { groupCount: 0, questionCount: 0, duplicateGroupCount: 1, duplicateQuestionCount: 0, errorCount: 0 }
  }

  payloadState.groupTextKeys.add(textKey)

  const resolvedGroupUnit = await resolveSubjectUnit(tx, {
    subjectId,
    topic: group.topic,
    createIfMissing: true,
    source: "IMPORTED",
  })

  const createdGroup = await tx.questionGroup.create({
    data: {
      user_id: userId,
      subject_id: subjectId,
      topic: resolvedGroupUnit.topicSnapshot || group.topic,
      unit_id: resolvedGroupUnit.unitId,
      external_id: group.external_id ?? null,
      title: group.group_title ?? null,
      context: group.group_context,
      table_data: group.table ? JSON.stringify(group.table) : null,
    },
  })

  existing.groupTextKeys.add(textKey)
  if (group.external_id) {
    existing.groupExternalIds.add(groupExternalKey(subjectId, group.external_id))
  }

  let questionCount = 0
  let duplicateQuestionCount = 0
  let errorCount = 0

  for (let index = 0; index < group.questions.length; index += 1) {
    const question = group.questions[index]

    if (question.external_id && group.external_id) {
      const combinedKey = questionExternalKey(subjectId, `${group.external_id}::${question.external_id}`)
      if (existing.questionExternalIds.has(combinedKey) || payloadState.questionExternalIds.has(combinedKey)) {
        duplicateQuestionCount += 1
        continue
      }
      payloadState.questionExternalIds.add(combinedKey)
    } else if (question.external_id) {
      const externalKey = questionExternalKey(subjectId, question.external_id)
      if (existing.questionExternalIds.has(externalKey) || payloadState.questionExternalIds.has(externalKey)) {
        duplicateQuestionCount += 1
        continue
      }
      payloadState.questionExternalIds.add(externalKey)
    }

    const groupChildTextKey = questionTextKey(subjectId, `${group.group_context}::${question.question}`)
    const plainTextKey = questionTextKey(subjectId, question.question)
    if (
      existing.questionTextKeys.has(plainTextKey) ||
      payloadState.questionTextKeys.has(groupChildTextKey) ||
      payloadState.questionTextKeys.has(plainTextKey)
    ) {
      duplicateQuestionCount += 1
      continue
    }

    payloadState.questionTextKeys.add(groupChildTextKey)
    payloadState.questionTextKeys.add(plainTextKey)

    const isFib = question.question_type === "fill_in_blank"

    try {
      await tx.question.create({
        data: {
          user_id: userId,
          subject_id: subjectId,
          topic: resolvedGroupUnit.topicSnapshot || group.topic,
          unit_id: resolvedGroupUnit.unitId!,
          external_id: question.external_id ?? null,
          question: question.question,
          question_type: isFib ? "fill_in_blank" : "multiple_choice",
          options: isFib ? "[]" : JSON.stringify(question.options),
          answer: isFib ? 0 : question.answer,
          text_answer: isFib ? question.text_answer : null,
          explanation: question.explanation ?? null,
          image_url: question.image ?? null,
          table_data: question.table ? JSON.stringify(question.table) : null,
          visibility: importTarget.visibility,
          shared_study_group_id: importTarget.visibility === "study_group" ? importTarget.shared_study_group_id : null,
          group_id: createdGroup.id,
          group_order: index,
        },
      })
      questionCount += 1
      existing.questionTextKeys.add(plainTextKey)
      if (question.external_id) {
        existing.questionExternalIds.add(questionExternalKey(subjectId, question.external_id))
        if (group.external_id) {
          existing.questionExternalIds.add(questionExternalKey(subjectId, `${group.external_id}::${question.external_id}`))
        }
      }
    } catch (error) {
      console.error("Error creating grouped question", error)
      errorCount += 1
    }
  }

  return {
    groupCount: 1,
    questionCount,
    duplicateGroupCount: 0,
    duplicateQuestionCount,
    errorCount,
  }
}
