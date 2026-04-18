"use server"

import { revalidatePath } from "next/cache"

import type { Prisma } from "@prisma/client"

import prisma from "@/lib/prisma"
import { getCurrentUserOrThrow } from "@/lib/current-user"
import { resolveSubjectUnit } from "@/lib/subject-unit"
import {
  importPayloadSchema,
  isImportedQuestionGroup,
  mathImportPayloadSchema,
  isMathSpecFormat,
  type ImportedQuestion,
  type ImportedQuestionGroup,
  type MathMcQuestion,
} from "@/app/import/schema"
import { buildFailureLabel, zodErrorToFailures, type ImportFailure } from "@/app/import/parser"
import type { QuestionImportTarget } from "@/types"

export type { ImportFailure } from "@/app/import/parser"

export type ImportResult = {
  success: boolean
  message: string
  validCount: number
  duplicateCount: number
  errorCount: number
  groupCount: number
  groupQuestionCount: number
  duplicateGroupCount: number
  failures: ImportFailure[]
}

function emptyFailures(): ImportFailure[] {
  return []
}

function describeDbError(err: unknown): string {
  if (err instanceof Error) return err.message
  return "寫入資料庫時發生未知錯誤"
}

const DEFAULT_IMPORT_TARGET: QuestionImportTarget = {
  visibility: "private",
}

export async function importQuestions(
  data: unknown,
  importTarget: QuestionImportTarget = DEFAULT_IMPORT_TARGET,
): Promise<ImportResult> {
  const user = await getCurrentUserOrThrow()

  // Detect and route math spec v1.0 format
  if (Array.isArray(data) && data.length > 0 && isMathSpecFormat(data[0])) {
    return importMathQuestions(user.id, data, importTarget)
  }

  const parsed = importPayloadSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      message: "JSON 格式錯誤。請檢查匯入格式要求。",
      validCount: 0,
      duplicateCount: 0,
      errorCount: parsed.error.issues.length,
      groupCount: 0,
      groupQuestionCount: 0,
      duplicateGroupCount: 0,
      failures: zodErrorToFailures(parsed.error, data),
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
      failures: emptyFailures(),
    }
  }

  const items = parsed.data
  const subjectMap = await ensureSubjectsForImport(user.id, items.map((item) => item.subject))
  if (!subjectMap) {
    return {
      success: false,
      message: "科目數量已達 200 上限，無法再新增。",
      validCount: 0,
      duplicateCount: 0,
      errorCount: items.length,
      groupCount: 0,
      groupQuestionCount: 0,
      duplicateGroupCount: 0,
      failures: emptyFailures(),
    }
  }

  const existing = await loadExistingImportState(user.id)
  const payloadState = createPayloadSeenState()
  const failures: ImportFailure[] = []
  let validCount = 0
  let duplicateCount = 0
  let errorCount = 0
  let groupCount = 0
  let groupQuestionCount = 0
  let duplicateGroupCount = 0

  try {
    // NOTE: Partial import is intentional. Per-row failures are caught below so
    // one bad row doesn't roll back the whole transaction. Only a thrown error
    // that escapes these try/catches will roll everything back.
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i]
        const subjectId = subjectMap.get(item.subject)
        if (!subjectId) {
          const childCount = isImportedQuestionGroup(item) ? item.questions.length : 1
          errorCount += childCount
          failures.push({
            index: i,
            label: buildFailureLabel(data, i),
            reason: "建立科目失敗",
          })
          continue
        }

        if (isImportedQuestionGroup(item)) {
          const result = await importSingleGroup(tx, user.id, subjectId, item, normalizedTarget.target, existing, payloadState)
          groupCount += result.groupCount
          groupQuestionCount += result.questionCount
          duplicateGroupCount += result.duplicateGroupCount
          duplicateCount += result.duplicateQuestionCount
          errorCount += result.errorCount
          if (result.groupReason) {
            failures.push({
              index: i,
              label: buildFailureLabel(data, i),
              reason: result.groupReason,
            })
          }
          for (const child of result.childFailures) {
            failures.push({
              index: i,
              childIndex: child.childIndex,
              label: buildFailureLabel(data, i, child.childIndex),
              reason: child.reason,
            })
          }
        } else {
          const result = await importSingleQuestion(tx, user.id, subjectId, item, normalizedTarget.target, existing, payloadState)
          validCount += result.validCount
          duplicateCount += result.duplicateCount
          errorCount += result.errorCount
          if (result.reason) {
            failures.push({
              index: i,
              label: buildFailureLabel(data, i),
              reason: result.reason,
            })
          }
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
      failures,
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
    failures,
  }
}

type ResolveImportTargetResult =
  | {
      success: true
      target:
        | {
            visibility: "private"
          }
        | {
            visibility: "study_group"
            shared_study_group_id: string
          }
    }
  | {
      success: false
      message: string
    }

async function resolveImportTarget(
  userId: string,
  importTarget: QuestionImportTarget
): Promise<ResolveImportTargetResult> {
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

type NormalizedImportTarget = Extract<ResolveImportTargetResult, { success: true }>["target"]

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

type SingleQuestionResult = {
  validCount: number
  duplicateCount: number
  errorCount: number
  reason?: string
}

async function importSingleQuestion(
  tx: Prisma.TransactionClient,
  userId: string,
  subjectId: string,
  question: ImportedQuestion,
  importTarget: NormalizedImportTarget,
  existing: ExistingImportState,
  payloadState: PayloadSeenState,
): Promise<SingleQuestionResult> {
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

  try {
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
  } catch (err) {
    console.error("Error creating single question", err)
    return {
      validCount: 0,
      duplicateCount: 0,
      errorCount: 1,
      reason: `寫入題目失敗：${describeDbError(err)}`,
    }
  }

  existing.questionTextKeys.add(textKey)
  if (question.external_id) {
    existing.questionExternalIds.add(questionExternalKey(subjectId, question.external_id))
  }

  return { validCount: 1, duplicateCount: 0, errorCount: 0 }
}

type GroupChildFailure = { childIndex: number; reason: string }
type SingleGroupResult = {
  groupCount: number
  questionCount: number
  duplicateGroupCount: number
  duplicateQuestionCount: number
  errorCount: number
  groupReason?: string
  childFailures: GroupChildFailure[]
}

async function importSingleGroup(
  tx: Prisma.TransactionClient,
  userId: string,
  subjectId: string,
  group: ImportedQuestionGroup,
  importTarget: NormalizedImportTarget,
  existing: ExistingImportState,
  payloadState: PayloadSeenState,
): Promise<SingleGroupResult> {
  const childFailures: GroupChildFailure[] = []

  if (group.external_id) {
    const externalKey = groupExternalKey(subjectId, group.external_id)
    if (existing.groupExternalIds.has(externalKey) || payloadState.groupExternalIds.has(externalKey)) {
      return { groupCount: 0, questionCount: 0, duplicateGroupCount: 1, duplicateQuestionCount: 0, errorCount: 0, childFailures }
    }
    payloadState.groupExternalIds.add(externalKey)
  }

  const textKey = groupTextKey(subjectId, group.group_context)
  if (existing.groupTextKeys.has(textKey) || payloadState.groupTextKeys.has(textKey)) {
    return { groupCount: 0, questionCount: 0, duplicateGroupCount: 1, duplicateQuestionCount: 0, errorCount: 0, childFailures }
  }

  payloadState.groupTextKeys.add(textKey)

  const resolvedGroupUnit = await resolveSubjectUnit(tx, {
    subjectId,
    topic: group.topic,
    createIfMissing: true,
    source: "IMPORTED",
  })

  let createdGroup
  try {
    createdGroup = await tx.questionGroup.create({
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
  } catch (err) {
    console.error("Error creating question group", err)
    return {
      groupCount: 0,
      questionCount: 0,
      duplicateGroupCount: 0,
      duplicateQuestionCount: 0,
      errorCount: group.questions.length,
      groupReason: `寫入題組失敗：${describeDbError(err)}`,
      childFailures,
    }
  }

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
          group_id: createdGroup!.id,
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
      childFailures.push({
        childIndex: index,
        reason: `寫入小題失敗：${describeDbError(error)}`,
      })
    }
  }

  return {
    groupCount: 1,
    questionCount,
    duplicateGroupCount: 0,
    duplicateQuestionCount,
    errorCount,
    childFailures,
  }
}

// ─── 數學題庫 JSON 規格書 v1.0 匯入 ─────────────────────────────────────────

type RichContent = { text: string; latex: string; image_url: string }

function buildRichContent(text: string, latex: string, image_url: string): RichContent {
  return { text, latex, image_url }
}

function richContentToLegacyText(rich: RichContent): string {
  return (rich.text || rich.latex || "").slice(0, 2000)
}

function mathQuestionToLegacyOptions(q: MathMcQuestion): string {
  const options = [
    q.option_1_text || q.option_1_latex || q.option_1_image_url,
    q.option_2_text || q.option_2_latex || q.option_2_image_url,
    q.option_3_text || q.option_3_latex || q.option_3_image_url,
    q.option_4_text || q.option_4_latex || q.option_4_image_url,
  ]
  return JSON.stringify(options)
}

function mathQuestionToStructuredOptions(q: MathMcQuestion): RichContent[] {
  return [
    buildRichContent(q.option_1_text, q.option_1_latex, q.option_1_image_url),
    buildRichContent(q.option_2_text, q.option_2_latex, q.option_2_image_url),
    buildRichContent(q.option_3_text, q.option_3_latex, q.option_3_image_url),
    buildRichContent(q.option_4_text, q.option_4_latex, q.option_4_image_url),
  ]
}

async function importMathQuestions(
  userId: string,
  rawData: unknown[],
  importTarget: QuestionImportTarget = DEFAULT_IMPORT_TARGET,
): Promise<ImportResult> {
  const parsed = mathImportPayloadSchema.safeParse(rawData)
  if (!parsed.success) {
    return {
      success: false,
      message: "數學題庫格式錯誤，請檢查下方錯誤清單。",
      validCount: 0,
      duplicateCount: 0,
      errorCount: parsed.error.issues.length,
      groupCount: 0,
      groupQuestionCount: 0,
      duplicateGroupCount: 0,
      failures: zodErrorToFailures(parsed.error, rawData),
    }
  }

  const normalizedTarget = await resolveImportTarget(userId, importTarget)
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
      failures: emptyFailures(),
    }
  }

  const questions = parsed.data
  const subjectMap = await ensureSubjectsForImport(userId, questions.map((q) => q.subject))
  if (!subjectMap) {
    return {
      success: false,
      message: "科目數量已達 200 上限，無法再新增。",
      validCount: 0,
      duplicateCount: 0,
      errorCount: questions.length,
      groupCount: 0,
      groupQuestionCount: 0,
      duplicateGroupCount: 0,
      failures: emptyFailures(),
    }
  }

  type IndexedMath = { q: MathMcQuestion; originalIndex: number }

  // Group questions by group_id, preserving original array indices for failure reporting.
  const standaloneQuestions: IndexedMath[] = []
  const groupedQuestions = new Map<string, IndexedMath[]>()

  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i]
    const entry = { q, originalIndex: i }
    if (q.group_id) {
      const bucket = groupedQuestions.get(q.group_id) ?? []
      bucket.push(entry)
      groupedQuestions.set(q.group_id, bucket)
    } else {
      standaloneQuestions.push(entry)
    }
  }

  const target = normalizedTarget.target
  const existing = await loadExistingImportState(userId)
  const payloadState = createPayloadSeenState()
  const failures: ImportFailure[] = []
  let validCount = 0
  let duplicateCount = 0
  let errorCount = 0
  let groupCount = 0
  let groupQuestionCount = 0
  let duplicateGroupCount = 0

  const pushMathFailure = (originalIndex: number, reason: string) => {
    failures.push({ index: originalIndex, label: buildFailureLabel(rawData, originalIndex), reason })
  }

  try {
    // NOTE: Partial import intentional. Per-row try/catch prevents single bad
    // rows from rolling back the whole transaction.
    await prisma.$transaction(async (tx) => {
      // Import standalone questions
      for (const { q, originalIndex } of standaloneQuestions) {
        const subjectId = subjectMap.get(q.subject)
        if (!subjectId) {
          errorCount += 1
          pushMathFailure(originalIndex, "建立科目失敗")
          continue
        }

        const questionRich = buildRichContent(q.question_text, q.question_latex, q.question_image_url)
        const legacyQuestion = richContentToLegacyText(questionRich)

        if (q.external_id) {
          const externalKey = questionExternalKey(subjectId, q.external_id)
          if (existing.questionExternalIds.has(externalKey) || payloadState.questionExternalIds.has(externalKey)) {
            duplicateCount += 1; continue
          }
          payloadState.questionExternalIds.add(externalKey)
        }

        const textKey = questionTextKey(subjectId, legacyQuestion)
        if (existing.questionTextKeys.has(textKey) || payloadState.questionTextKeys.has(textKey)) {
          duplicateCount += 1; continue
        }
        payloadState.questionTextKeys.add(textKey)

        const resolvedUnit = await resolveSubjectUnit(tx, {
          subjectId,
          topic: q.topic,
          createIfMissing: true,
          source: "IMPORTED",
        })

        const explanationRich = buildRichContent(q.explanation_text, q.explanation_latex, q.explanation_image_url)

        try {
          await tx.question.create({
            data: {
              user_id: userId,
              subject_id: subjectId,
              topic: resolvedUnit.topicSnapshot || q.topic,
              unit_id: resolvedUnit.unitId!,
              external_id: q.external_id ?? null,
              question: legacyQuestion,
              question_structured: JSON.stringify(questionRich),
              question_type: "multiple_choice",
              options: mathQuestionToLegacyOptions(q),
              options_structured: JSON.stringify(mathQuestionToStructuredOptions(q)),
              answer: q.answer,
              explanation: richContentToLegacyText(explanationRich) || null,
              explanation_structured: JSON.stringify(explanationRich),
              image_url: q.question_image_url || null,
              visibility: target.visibility,
              shared_study_group_id:
                target.visibility === "study_group"
                  ? target.shared_study_group_id
                  : null,
            },
          })
          existing.questionTextKeys.add(textKey)
          if (q.external_id) {
            existing.questionExternalIds.add(questionExternalKey(subjectId, q.external_id))
          }
          validCount += 1
        } catch (err) {
          console.error("Error creating math standalone question", err)
          errorCount += 1
          pushMathFailure(originalIndex, `寫入題目失敗：${describeDbError(err)}`)
        }
      }

      // Import grouped questions
      for (const [groupId, groupItems] of groupedQuestions) {
        if (groupItems.length === 0) continue
        const firstEntry = groupItems[0]
        const firstItem = firstEntry.q
        const firstOriginalIndex = firstEntry.originalIndex
        const subjectId = subjectMap.get(firstItem.subject)
        if (!subjectId) {
          errorCount += groupItems.length
          for (const entry of groupItems) pushMathFailure(entry.originalIndex, "建立科目失敗")
          continue
        }

        const contextRich = buildRichContent(firstItem.group_text, firstItem.group_latex, firstItem.group_image_url)
        const legacyContext = firstItem.group_text || firstItem.group_latex || groupId

        // Use group_id as external_id for the group
        const groupExternalId = groupId
        const gExternalKey = groupExternalKey(subjectId, groupExternalId)
        if (existing.groupExternalIds.has(gExternalKey) || payloadState.groupExternalIds.has(gExternalKey)) {
          duplicateGroupCount += 1
          duplicateCount += groupItems.length
          continue
        }
        payloadState.groupExternalIds.add(gExternalKey)

        const gTextKey = groupTextKey(subjectId, legacyContext)
        if (existing.groupTextKeys.has(gTextKey) || payloadState.groupTextKeys.has(gTextKey)) {
          duplicateGroupCount += 1
          duplicateCount += groupItems.length
          continue
        }
        payloadState.groupTextKeys.add(gTextKey)

        const resolvedUnit = await resolveSubjectUnit(tx, {
          subjectId,
          topic: firstItem.topic,
          createIfMissing: true,
          source: "IMPORTED",
        })

        let createdGroup
        try {
          createdGroup = await tx.questionGroup.create({
            data: {
              user_id: userId,
              subject_id: subjectId,
              topic: resolvedUnit.topicSnapshot || firstItem.topic,
              unit_id: resolvedUnit.unitId,
              external_id: groupExternalId,
              title: firstItem.group_title || null,
              context: legacyContext,
              context_structured: JSON.stringify(contextRich),
            },
          })
        } catch (err) {
          console.error("Error creating math question group", err)
          errorCount += groupItems.length
          pushMathFailure(firstOriginalIndex, `寫入題組失敗：${describeDbError(err)}`)
          continue
        }

        existing.groupTextKeys.add(gTextKey)
        existing.groupExternalIds.add(gExternalKey)
        groupCount += 1

        for (let index = 0; index < groupItems.length; index += 1) {
          const { q, originalIndex: qOriginalIndex } = groupItems[index]
          const qSubjectId = subjectMap.get(q.subject) ?? subjectId

          const questionRich = buildRichContent(q.question_text, q.question_latex, q.question_image_url)
          const legacyQuestion = richContentToLegacyText(questionRich)
          const explanationRich = buildRichContent(q.explanation_text, q.explanation_latex, q.explanation_image_url)

          const groupChildTextKey = questionTextKey(qSubjectId, `${legacyContext}::${legacyQuestion}`)
          const plainTextKey = questionTextKey(qSubjectId, legacyQuestion)
          if (
            existing.questionTextKeys.has(plainTextKey) ||
            payloadState.questionTextKeys.has(groupChildTextKey) ||
            payloadState.questionTextKeys.has(plainTextKey)
          ) {
            duplicateCount += 1
            continue
          }
          payloadState.questionTextKeys.add(groupChildTextKey)
          payloadState.questionTextKeys.add(plainTextKey)

          try {
            await tx.question.create({
              data: {
                user_id: userId,
                subject_id: qSubjectId,
                topic: resolvedUnit.topicSnapshot || q.topic,
                unit_id: resolvedUnit.unitId!,
                external_id: q.external_id ?? null,
                question: legacyQuestion,
                question_structured: JSON.stringify(questionRich),
                question_type: "multiple_choice",
                options: mathQuestionToLegacyOptions(q),
                options_structured: JSON.stringify(mathQuestionToStructuredOptions(q)),
                answer: q.answer,
                explanation: richContentToLegacyText(explanationRich) || null,
                explanation_structured: JSON.stringify(explanationRich),
                image_url: q.question_image_url || null,
                visibility: target.visibility,
                shared_study_group_id:
                  target.visibility === "study_group"
                    ? target.shared_study_group_id
                    : null,
                group_id: createdGroup!.id,
                group_order: index,
              },
            })
            groupQuestionCount += 1
            existing.questionTextKeys.add(plainTextKey)
            if (q.external_id) {
              existing.questionExternalIds.add(questionExternalKey(qSubjectId, q.external_id))
            }
          } catch (err) {
            console.error("Error creating math grouped question", err)
            errorCount += 1
            pushMathFailure(qOriginalIndex, `寫入小題失敗：${describeDbError(err)}`)
          }
        }
      }
    })
  } catch (error) {
    console.error("Error importing math question payload", error)
    return {
      success: false,
      message: "匯入過程中發生錯誤，請稍後再試。",
      validCount,
      duplicateCount,
      errorCount: errorCount + 1,
      groupCount,
      groupQuestionCount,
      duplicateGroupCount,
      failures,
    }
  }

  revalidatePath("/practice")
  revalidatePath("/import")

  return {
    success: true,
    message:
      target.visibility === "study_group"
        ? "匯入結束，題目已分享到讀書房。"
        : "匯入結束。",
    validCount,
    duplicateCount,
    errorCount,
    groupCount,
    groupQuestionCount,
    duplicateGroupCount,
    failures,
  }
}
