"use server"

import { revalidatePath } from "next/cache"

import prisma from "@/lib/prisma"
import {
  assertOwnedRecord,
  getCurrentUserOrThrow,
  setCurrentUserCookie,
} from "@/lib/current-user"
import type { ActionResult } from "@/types"

export async function ensureCurrentUserCookie(userId: string) {
  await setCurrentUserCookie(userId)
}

export async function switchCurrentUser(userId: string): Promise<ActionResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  const existingUser = assertOwnedRecord(user, "找不到指定的使用者。")
  await setCurrentUserCookie(existingUser.id)

  revalidatePath("/", "layout")

  return {
    success: true,
    message: `已切換到 ${existingUser.name}。`,
  }
}

export async function createUser(name: string): Promise<ActionResult> {
  const trimmedName = name.trim()

  if (!trimmedName) {
    return {
      success: false,
      message: "使用者名稱是必填的。",
    }
  }

  const user = await prisma.user.create({
    data: {
      name: trimmedName,
    },
  })

  await setCurrentUserCookie(user.id)
  revalidatePath("/", "layout")

  return {
    success: true,
    message: `已建立並切換到 ${user.name}。`,
  }
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  const currentUser = await getCurrentUserOrThrow()

  if (currentUser.id === userId) {
    return {
      success: false,
      message: "不能刪除目前正在使用的使用者，請先切換到別人。",
    }
  }

  const [userCount, user] = await Promise.all([
    prisma.user.count(),
    prisma.user.findUnique({ where: { id: userId } }),
  ])

  const existingUser = assertOwnedRecord(user, "找不到指定的使用者。")

  if (userCount <= 1) {
    return {
      success: false,
      message: "至少要保留一個使用者。",
    }
  }

  const [
    subjectCount,
    studyLogCount,
    practiceLogCount,
    wrongQuestionCount,
    reviewTaskCount,
    questionCount,
    vocabularyCount,
    ownedGroupCount,
    memberGroupCount,
  ] = await prisma.$transaction([
    prisma.subject.count({ where: { user_id: existingUser.id } }),
    prisma.studyLog.count({ where: { user_id: existingUser.id } }),
    prisma.practiceLog.count({ where: { user_id: existingUser.id } }),
    prisma.wrongQuestion.count({ where: { user_id: existingUser.id } }),
    prisma.reviewTask.count({ where: { user_id: existingUser.id } }),
    prisma.question.count({ where: { user_id: existingUser.id } }),
    prisma.vocabularyWord.count({ where: { user_id: existingUser.id } }),
    prisma.studyGroup.count({ where: { owner_user_id: existingUser.id } }),
    prisma.studyGroupMember.count({ where: { user_id: existingUser.id } }),
  ])

  const relatedCount =
    subjectCount +
    studyLogCount +
    practiceLogCount +
    wrongQuestionCount +
    reviewTaskCount +
    questionCount +
    vocabularyCount +
    ownedGroupCount +
    memberGroupCount

  if (relatedCount > 0) {
    return {
      success: false,
      message: "這個使用者已經有資料或加入了讀書房，暫時不能直接刪除。",
    }
  }

  await prisma.user.delete({
    where: { id: existingUser.id },
  })

  revalidatePath("/", "layout")
  revalidatePath("/settings")

  return {
    success: true,
    message: `已刪除使用者 ${existingUser.name}。`,
  }
}
