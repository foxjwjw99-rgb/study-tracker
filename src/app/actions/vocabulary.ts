"use server"

import { revalidatePath } from "next/cache"
import { endOfDay } from "date-fns"

import { vocabularyImportSchema } from "@/app/import/vocabulary-schema"
import { getCurrentUserOrThrow } from "@/lib/current-user"
import prisma from "@/lib/prisma"
import { applyVocabularyReview } from "@/lib/vocabulary-review"
import {
  formatVocabularyStatus,
} from "@/lib/vocabulary"
import type {
  ImportResult,
} from "@/app/actions/import"
import type {
  VocabularyBankItem,
  VocabularyReviewInput,
  VocabularyQueueItem,
  VocabularyReviewUpdateResult,
  VocabularyStatus,
  VocabularyStatusFilter,
  VocabularyWordItem,
  QuestionImportTarget,
} from "@/types"

const DEFAULT_IMPORT_TARGET: QuestionImportTarget = {
  visibility: "private",
}

export async function importVocabularyWords(
  data: unknown,
  importTarget: QuestionImportTarget = DEFAULT_IMPORT_TARGET
): Promise<ImportResult> {
  const user = await getCurrentUserOrThrow()
  const parsed = vocabularyImportSchema.safeParse(data)

  if (!parsed.success) {
    return {
      success: false,
      message: "JSON 格式錯誤。請檢查英文單字匯入格式。",
      validCount: 0,
      duplicateCount: 0,
      errorCount: 0,
    }
  }

  const normalizedTarget = await resolveVocabularyImportTarget(user.id, importTarget)
  if (!normalizedTarget.success) {
    return {
      success: false,
      message: normalizedTarget.message,
      validCount: 0,
      duplicateCount: 0,
      errorCount: 0,
    }
  }

  const items = parsed.data
  let validCount = 0
  let duplicateCount = 0
  let errorCount = 0

  try {
    for (const recipientUserId of normalizedTarget.recipientUserIds) {
      const dbSubjects = await prisma.subject.findMany({
        where: { user_id: recipientUserId },
        select: {
          id: true,
          name: true,
        },
      })
      const subjectMap = new Map<string, string>(
        dbSubjects.map((subject) => [subject.name.trim(), subject.id])
      )

      const uniqueImportSubjects = Array.from(new Set(items.map((item) => item.subject.trim())))
      const missingSubjects = uniqueImportSubjects.filter((sub) => !subjectMap.has(sub))

      if (missingSubjects.length > 0) {
        try {
          await prisma.subject.createMany({
            data: missingSubjects.map((name) => ({
              user_id: recipientUserId,
              name,
            })),
          })
          const newSubjects = await prisma.subject.findMany({
            where: {
              user_id: recipientUserId,
              name: { in: missingSubjects },
            },
          })
          for (const sub of newSubjects) {
            subjectMap.set(sub.name.trim(), sub.id)
          }
        } catch (e) {
          console.error("Error creating subjects", e)
          return {
            success: false,
            message: "建立科目失敗。",
            validCount: 0,
            duplicateCount: 0,
            errorCount: items.length,
          }
        }
      }

      const dbWords = await prisma.vocabularyWord.findMany({
        where: { user_id: recipientUserId },
        select: { subject_id: true, word: true },
      })

      const existingWordSet = new Set(
        dbWords.map((w: { subject_id: string; word: string }) => `${w.subject_id}::${w.word.trim()}`)
      )

      const newWordsData = []

      for (const item of items) {
        const subjectId = subjectMap.get(item.subject.trim())
        if (!subjectId) {
          errorCount += 1
          continue
        }

        const dedupKey = `${subjectId}::${item.word.trim()}`
        if (existingWordSet.has(dedupKey)) {
          duplicateCount += 1
          continue
        }

        existingWordSet.add(dedupKey)

        newWordsData.push({
          user_id: recipientUserId,
          subject_id: subjectId,
          word: item.word.trim(),
          part_of_speech: item.part_of_speech?.trim() || null,
          meaning: item.meaning.trim(),
          example_sentence: item.example_sentence.trim(),
          example_sentence_translation: item.example_sentence_translation?.trim() || null,
          status: "NEW",
        })
      }

      if (newWordsData.length > 0) {
        try {
          const result = await prisma.vocabularyWord.createMany({
            data: newWordsData,
          })
          validCount += result.count
        } catch (e) {
          console.error("Error creating vocabulary words batch", e)
          errorCount += newWordsData.length
        }
      }
    }
  } catch (error) {
    console.error("Error during vocabulary import:", error)
    return {
      success: false,
      message: "匯入過程發生錯誤，請稍後再試。",
      validCount,
      duplicateCount,
      errorCount: items.length - validCount - duplicateCount,
    }
  }

  revalidatePath("/import")
  revalidatePath("/vocabulary")
  revalidatePath("/review")

  return {
    success: true,
    message:
      normalizedTarget.visibility === "study_group"
        ? `英文單字已分享到讀書房，已分發給 ${normalizedTarget.memberCount} 位成員；每個人的複習進度仍各自獨立。`
        : "英文單字匯入完成。",
    validCount,
    duplicateCount,
    errorCount,
  }
}

async function resolveVocabularyImportTarget(userId: string, importTarget: QuestionImportTarget) {
  if (importTarget.visibility === "private") {
    return {
      success: true as const,
      visibility: "private" as const,
      recipientUserIds: [userId],
      memberCount: 1,
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
      message: "你不在這個讀書房中，不能分享單字。",
    }
  }

  const members = await prisma.studyGroupMember.findMany({
    where: {
      study_group_id: membership.study_group_id,
    },
    select: {
      user_id: true,
    },
  })

  return {
    success: true as const,
    visibility: "study_group" as const,
    recipientUserIds: members.map((member) => member.user_id),
    memberCount: members.length,
  }
}

export async function getVocabularyBank(): Promise<VocabularyBankItem[]> {
  const user = await getCurrentUserOrThrow()
  const groups = await prisma.vocabularyWord.groupBy({
    by: ["subject_id"],
    where: { user_id: user.id },
    _count: {
      _all: true,
    },
  })

  if (groups.length === 0) {
    return []
  }

  const subjects = await prisma.subject.findMany({
    where: {
      user_id: user.id,
      id: {
        in: groups.map((group) => group.subject_id),
      },
    },
    select: {
      id: true,
      name: true,
    },
  })

  const subjectNameMap = new Map(subjects.map((subject) => [subject.id, subject.name]))

  return groups
    .map((group) => ({
      subject_id: group.subject_id,
      subject_name: subjectNameMap.get(group.subject_id) || "未知科目",
      word_count: group._count._all,
    }))
    .sort((left, right) => left.subject_name.localeCompare(right.subject_name, "zh-Hant"))
}

export async function getVocabularyWords(filters?: {
  subject_id?: string
  status?: VocabularyStatusFilter
}): Promise<VocabularyWordItem[]> {
  const user = await getCurrentUserOrThrow()
  const statusFilter = filters?.status ?? "all"
  const todayEnd = endOfDay(new Date())
  const words = await prisma.vocabularyWord.findMany({
    where: {
      user_id: user.id,
      ...(filters?.subject_id ? { subject_id: filters.subject_id } : {}),
      ...buildStatusFilter(statusFilter, todayEnd),
    },
    include: {
      subject: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  return words.sort(compareVocabularyWords)
}

export async function getVocabularySession(
  subjectId?: string,
  limit = 10,
  status: VocabularyStatusFilter = "all"
): Promise<VocabularyQueueItem[]> {
  const words = await getVocabularyWords({
    subject_id: subjectId,
    status,
  })

  return words.slice(0, limit).map(toVocabularyQueueItem)
}

export async function updateVocabularyReviewStatus(
  wordId: string,
  input: VocabularyReviewInput
): Promise<VocabularyReviewUpdateResult> {
  const user = await getCurrentUserOrThrow()
  const word = await prisma.vocabularyWord.findFirst({
    where: {
      id: wordId,
      user_id: user.id,
    },
    include: {
      subject: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!word) {
    return { success: false, message: "找不到這個單字。", word: NOT_FOUND_WORD }
  }

  const updatedWord = await prisma.$transaction(async (tx) => {
    const result = await applyVocabularyReview({
      tx,
      userId: user.id,
      word: {
        ...word,
        status: word.status as VocabularyStatus,
      },
      rating: input.rating,
      confidence: input.confidence,
      responseMs: input.response_ms,
      reviewTaskId: input.review_task_id,
    })

    return result.word
  })

  revalidatePath("/vocabulary")
  revalidatePath("/review")
  revalidatePath("/dashboard")

  return {
    success: true,
    message: `已更新 ${updatedWord.word}，目前狀態為${formatVocabularyStatus(updatedWord.status as VocabularyStatus)}。`,
    word: toVocabularyQueueItem(updatedWord),
  }
}

function buildStatusFilter(status: VocabularyStatusFilter, todayEnd: Date) {
  if (status === "new") return { status: "NEW" }
  if (status === "learning") return { status: "LEARNING" }
  if (status === "familiar") return { status: "FAMILIAR" }
  if (status === "due") return { next_review_date: { lte: todayEnd } }
  return {}
}

const NOT_FOUND_WORD: VocabularyQueueItem = {
  id: "",
  word: "",
  part_of_speech: null,
  meaning: "",
  example_sentence: "",
  example_sentence_translation: null,
  status: "NEW",
  subject_id: "",
  subject_name: "",
  next_review_date: null,
  last_reviewed_at: null,
  ease_factor: 2.5,
  interval_days: 0,
  review_count: 0,
  lapse_count: 0,
  average_response_ms: null,
  average_confidence: null,
}

function compareVocabularyWords(left: VocabularyWordItem, right: VocabularyWordItem) {
  const leftTime = left.next_review_date?.getTime() ?? Number.MAX_SAFE_INTEGER
  const rightTime = right.next_review_date?.getTime() ?? Number.MAX_SAFE_INTEGER

  if (leftTime !== rightTime) {
    return leftTime - rightTime
  }

  return right.created_at.getTime() - left.created_at.getTime()
}

function toVocabularyQueueItem(word: VocabularyWordItem): VocabularyQueueItem {
  return {
    id: word.id,
    word: word.word,
    part_of_speech: (word as unknown as { part_of_speech?: string | null }).part_of_speech ?? null,
    meaning: word.meaning,
    example_sentence: word.example_sentence,
    example_sentence_translation:
      (word as unknown as { example_sentence_translation?: string | null }).example_sentence_translation ?? null,
    status: word.status as VocabularyStatus,
    subject_id: word.subject_id,
    subject_name: word.subject.name,
    next_review_date: word.next_review_date,
    last_reviewed_at: word.last_reviewed_at,
    ease_factor: word.ease_factor,
    interval_days: word.interval_days,
    review_count: word.review_count,
    lapse_count: word.lapse_count,
    average_response_ms: word.average_response_ms,
    average_confidence: word.average_confidence,
  }
}

export async function recordVocabularySessionStudyLog(
  subjectId: string,
  durationMinutes: number,
  reviewedCount: number
): Promise<void> {
  const MAX_DURATION_MINUTES = 720
  const clampedDuration = Math.min(Math.max(1, Math.round(durationMinutes)), MAX_DURATION_MINUTES)

  const user = await getCurrentUserOrThrow()
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, user_id: user.id },
    select: { id: true },
  })

  if (!subject) {
    return
  }

  await prisma.studyLog.create({
    data: {
      user_id: user.id,
      subject_id: subjectId,
      topic: `英文單字複習（${reviewedCount} 個）`,
      study_date: new Date(),
      duration_minutes: clampedDuration,
      study_type: "複習",
      focus_score: 3,
      planned_done: true,
      source_type: "vocabulary_review",
    },
  })

  revalidatePath("/study-log")
  revalidatePath("/dashboard")
}

export async function deleteVocabularyWord(id: string): Promise<void> {
  const user = await getCurrentUserOrThrow()

  await prisma.$transaction(async (tx) => {
    await tx.vocabularyReviewLog.deleteMany({
      where: {
        vocabulary_word_id: id,
        user_id: user.id,
      },
    })

    await tx.reviewTask.deleteMany({
      where: {
        vocabulary_word_id: id,
        user_id: user.id,
      },
    })

    await tx.vocabularyWord.deleteMany({
      where: {
        id,
        user_id: user.id,
      },
    })
  })

  revalidatePath("/vocabulary")
  revalidatePath("/review")
  revalidatePath("/dashboard")
}
