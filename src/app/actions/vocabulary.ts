"use server"

import { revalidatePath } from "next/cache"
import { getEndOfTodayUTC } from "@/lib/date-utils"

import { vocabularyImportSchema, resolveListName } from "@/app/import/vocabulary-schema"
import { getCurrentUserOrThrow } from "@/lib/current-user"
import prisma from "@/lib/prisma"
import { VocabularyWordStatus } from "@prisma/client"
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
  VocabularyImportTarget,
} from "@/types"

const DEFAULT_IMPORT_TARGET: VocabularyImportTarget = {
  visibility: "private",
}

function buildVocabularyImportResult(
  partial: Pick<ImportResult, "success" | "message"> &
    Partial<Omit<ImportResult, "success" | "message">>
): ImportResult {
  return {
    success: partial.success,
    message: partial.message,
    validCount: partial.validCount ?? 0,
    duplicateCount: partial.duplicateCount ?? 0,
    errorCount: partial.errorCount ?? 0,
    groupCount: partial.groupCount ?? 0,
    groupQuestionCount: partial.groupQuestionCount ?? 0,
    duplicateGroupCount: partial.duplicateGroupCount ?? 0,
    failures: partial.failures ?? [],
  }
}

export async function importVocabularyWords(
  data: unknown,
  importTarget: VocabularyImportTarget = DEFAULT_IMPORT_TARGET
): Promise<ImportResult> {
  const user = await getCurrentUserOrThrow()
  const parsed = vocabularyImportSchema.safeParse(data)

  if (!parsed.success) {
    return buildVocabularyImportResult({
      success: false,
      message: "JSON 格式錯誤。請檢查英文單字匯入格式。",
    })
  }

  const normalizedTarget = await resolveVocabularyImportTarget(user.id, importTarget)
  if (!normalizedTarget.success) {
    return buildVocabularyImportResult({
      success: false,
      message: normalizedTarget.message,
    })
  }

  const items = parsed.data
  const overrideListName = importTarget.list_name?.trim() || null

  let validCount = 0
  let duplicateCount = 0
  let errorCount = 0

  try {
    for (const recipientUserId of normalizedTarget.recipientUserIds) {
      // Collect every distinct list name needed for this recipient.
      const neededListNames = new Set<string>()
      for (const item of items) {
        const name = overrideListName || resolveListName(item)
        if (name) neededListNames.add(name)
      }

      const dbLists = await prisma.vocabularyList.findMany({
        where: { user_id: recipientUserId, name: { in: Array.from(neededListNames) } },
        select: { id: true, name: true },
      })
      const listMap = new Map<string, string>(dbLists.map((l) => [l.name, l.id]))
      const missing = Array.from(neededListNames).filter((n) => !listMap.has(n))

      if (missing.length > 0) {
        await prisma.vocabularyList.createMany({
          data: missing.map((name) => ({ user_id: recipientUserId, name })),
          skipDuplicates: true,
        })
        const refreshed = await prisma.vocabularyList.findMany({
          where: { user_id: recipientUserId, name: { in: missing } },
          select: { id: true, name: true },
        })
        for (const l of refreshed) listMap.set(l.name, l.id)
      }

      const dbWords = await prisma.vocabularyWord.findMany({
        where: { user_id: recipientUserId },
        select: { list_id: true, word: true },
      })

      const existingWordSet = new Set(
        dbWords.map((w) => `${w.list_id}::${w.word.trim()}`)
      )

      const newWordsData: {
        user_id: string
        list_id: string
        word: string
        part_of_speech: string | null
        meaning: string
        example_sentence: string
        example_sentence_translation: string | null
        status: VocabularyWordStatus
      }[] = []

      for (const item of items) {
        const listName = overrideListName || resolveListName(item)
        const listId = listName ? listMap.get(listName) : undefined
        if (!listId) {
          errorCount += 1
          continue
        }

        const dedupKey = `${listId}::${item.word.trim()}`
        if (existingWordSet.has(dedupKey)) {
          duplicateCount += 1
          continue
        }
        existingWordSet.add(dedupKey)

        newWordsData.push({
          user_id: recipientUserId,
          list_id: listId,
          word: item.word.trim(),
          part_of_speech: item.part_of_speech?.trim() || null,
          meaning: item.meaning.trim(),
          example_sentence: item.example_sentence.trim(),
          example_sentence_translation: item.example_sentence_translation?.trim() || null,
          status: VocabularyWordStatus.NEW,
        })
      }

      if (newWordsData.length > 0) {
        try {
          const result = await prisma.vocabularyWord.createMany({ data: newWordsData })
          validCount += result.count
        } catch (e) {
          console.error("Error creating vocabulary words batch", e)
          errorCount += newWordsData.length
        }
      }
    }
  } catch (error) {
    console.error("Error during vocabulary import:", error)
    return buildVocabularyImportResult({
      success: false,
      message: "匯入過程發生錯誤，請稍後再試。",
      validCount,
      duplicateCount,
      errorCount: items.length - validCount - duplicateCount,
    })
  }

  revalidatePath("/import")
  revalidatePath("/vocabulary")
  revalidatePath("/review")

  return buildVocabularyImportResult({
    success: true,
    message:
      normalizedTarget.visibility === "study_group"
        ? `英文單字已分享到讀書房，已分發給 ${normalizedTarget.memberCount} 位成員；每個人的複習進度仍各自獨立。`
        : "英文單字匯入完成。",
    validCount,
    duplicateCount,
    errorCount,
  })
}

async function resolveVocabularyImportTarget(userId: string, importTarget: VocabularyImportTarget) {
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
    by: ["list_id"],
    where: { user_id: user.id },
    _count: { _all: true },
  })

  if (groups.length === 0) return []

  const lists = await prisma.vocabularyList.findMany({
    where: {
      user_id: user.id,
      id: { in: groups.map((g) => g.list_id) },
    },
    select: { id: true, name: true },
  })

  const nameMap = new Map(lists.map((l) => [l.id, l.name]))

  return groups
    .map((group) => ({
      list_id: group.list_id,
      list_name: nameMap.get(group.list_id) || "未知清單",
      word_count: group._count._all,
    }))
    .sort((a, b) => a.list_name.localeCompare(b.list_name, "zh-Hant"))
}

export async function getVocabularyWords(filters?: {
  list_id?: string
  status?: VocabularyStatusFilter
}): Promise<VocabularyWordItem[]> {
  const user = await getCurrentUserOrThrow()
  const statusFilter = filters?.status ?? "all"
  const todayEnd = getEndOfTodayUTC()
  const words = await prisma.vocabularyWord.findMany({
    where: {
      user_id: user.id,
      ...(filters?.list_id ? { list_id: filters.list_id } : {}),
      ...buildStatusFilter(statusFilter, todayEnd),
    },
    include: {
      list: {
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
  listId?: string,
  limit = 10,
  status: VocabularyStatusFilter = "all"
): Promise<VocabularyQueueItem[]> {
  const words = await getVocabularyWords({ list_id: listId, status })
  return words.slice(0, limit).map(toVocabularyQueueItem)
}

export async function updateVocabularyReviewStatus(
  wordId: string,
  input: VocabularyReviewInput
): Promise<VocabularyReviewUpdateResult> {
  const user = await getCurrentUserOrThrow()
  const word = await prisma.vocabularyWord.findFirst({
    where: { id: wordId, user_id: user.id },
    include: {
      list: { select: { id: true, name: true } },
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
  if (status === "new") return { status: VocabularyWordStatus.NEW }
  if (status === "learning") return { status: VocabularyWordStatus.LEARNING }
  if (status === "familiar") return { status: VocabularyWordStatus.FAMILIAR }
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
  list_id: "",
  list_name: "",
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
    list_id: word.list_id,
    list_name: word.list.name,
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
