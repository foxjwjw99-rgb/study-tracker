"use server"

import { revalidatePath } from "next/cache"

import prisma from "@/lib/prisma"
import {
  assertOwnedRecord,
  getCurrentUserOrThrow,
  OWNERSHIP_ERROR_MESSAGE,
} from "@/lib/current-user"
import type { ActionResult, VocabularyListSummary, VocabularyListDeletionImpact } from "@/types"

export async function listVocabularyLists(): Promise<VocabularyListSummary[]> {
  const user = await getCurrentUserOrThrow()
  const lists = await prisma.vocabularyList.findMany({
    where: { user_id: user.id },
    select: {
      id: true,
      name: true,
      _count: { select: { words: true } },
    },
    orderBy: { name: "asc" },
  })
  return lists
    .map((list) => ({ id: list.id, name: list.name, word_count: list._count.words }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"))
}

export async function createVocabularyList(name: string): Promise<ActionResult & { list?: VocabularyListSummary }> {
  const user = await getCurrentUserOrThrow()
  const trimmed = name.trim().replace(/\s+/g, " ")
  if (!trimmed) {
    return { success: false, message: "請輸入有效的清單名稱。" }
  }

  const existing = await prisma.vocabularyList.findFirst({
    where: { user_id: user.id, name: trimmed },
    select: { id: true },
  })
  if (existing) {
    return { success: false, message: "已經有同名的單字清單了。" }
  }

  const created = await prisma.vocabularyList.create({
    data: { user_id: user.id, name: trimmed },
    select: { id: true, name: true },
  })

  revalidatePath("/vocabulary")
  revalidatePath("/import")
  revalidatePath("/settings")

  return {
    success: true,
    message: `已建立清單「${created.name}」。`,
    list: { id: created.id, name: created.name, word_count: 0 },
  }
}

export async function renameVocabularyList(id: string, name: string): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()
  const trimmed = name.trim().replace(/\s+/g, " ")
  if (!trimmed) {
    return { success: false, message: "請輸入有效的清單名稱。" }
  }

  const list = await prisma.vocabularyList.findFirst({
    where: { id, user_id: user.id },
    select: { id: true, name: true },
  })
  const owned = assertOwnedRecord(list, OWNERSHIP_ERROR_MESSAGE)

  if (owned.name === trimmed) {
    return { success: true, message: "清單名稱未變更。" }
  }

  const collision = await prisma.vocabularyList.findFirst({
    where: { user_id: user.id, name: trimmed, NOT: { id: owned.id } },
    select: { id: true },
  })
  if (collision) {
    return { success: false, message: "已經有同名的清單。" }
  }

  await prisma.vocabularyList.update({
    where: { id: owned.id },
    data: { name: trimmed },
  })

  revalidatePath("/vocabulary")
  revalidatePath("/import")
  revalidatePath("/settings")
  revalidatePath("/dashboard")

  return { success: true, message: `已將清單改名為「${trimmed}」。` }
}

export async function getVocabularyListDeletionImpact(id: string): Promise<VocabularyListDeletionImpact> {
  const user = await getCurrentUserOrThrow()
  const list = await prisma.vocabularyList.findFirst({
    where: { id, user_id: user.id },
    select: { id: true, name: true },
  })
  const owned = assertOwnedRecord(list, OWNERSHIP_ERROR_MESSAGE)

  const [wordsCount, reviewLogsCount, reviewTasksCount] = await prisma.$transaction([
    prisma.vocabularyWord.count({ where: { list_id: owned.id } }),
    prisma.vocabularyReviewLog.count({ where: { list_id: owned.id } }),
    prisma.reviewTask.count({ where: { vocabulary_list_id: owned.id } }),
  ])

  return {
    listId: owned.id,
    listName: owned.name,
    wordsCount,
    reviewLogsCount,
    reviewTasksCount,
    totalCount: wordsCount + reviewLogsCount + reviewTasksCount,
  }
}

export async function deleteVocabularyListCascade(id: string): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()
  const impact = await getVocabularyListDeletionImpact(id)

  await prisma.$transaction([
    prisma.vocabularyReviewLog.deleteMany({ where: { list_id: impact.listId, user_id: user.id } }),
    prisma.reviewTask.deleteMany({ where: { vocabulary_list_id: impact.listId, user_id: user.id } }),
    prisma.vocabularyWord.deleteMany({ where: { list_id: impact.listId, user_id: user.id } }),
    prisma.vocabularyList.delete({ where: { id: impact.listId } }),
  ])

  revalidatePath("/vocabulary")
  revalidatePath("/import")
  revalidatePath("/settings")
  revalidatePath("/review")
  revalidatePath("/dashboard")

  return { success: true, message: `已刪除清單「${impact.listName}」，並清除相關資料。` }
}
