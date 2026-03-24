import "server-only"

import type { User } from "@prisma/client"
import { cookies } from "next/headers"

import prisma from "@/lib/prisma"
import type { CurrentUserSummary } from "@/types"

export const CURRENT_USER_COOKIE = "study-tracker-user-id"
export const OWNERSHIP_ERROR_MESSAGE = "找不到或無權限存取該資料。"
const DEFAULT_USER_NAME = "測試學生"

type CurrentUserContext = {
  user: User
  hasCookie: boolean
}

export async function resolveCurrentUserContext(): Promise<CurrentUserContext> {
  const cookieStore = await cookies()
  const cookieUserId = cookieStore.get(CURRENT_USER_COOKIE)?.value

  if (cookieUserId) {
    const cookieUser = await prisma.user.findUnique({
      where: { id: cookieUserId },
    })

    if (cookieUser) {
      return {
        user: cookieUser,
        hasCookie: true,
      }
    }
  }

  const firstUser = await prisma.user.findFirst({
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
  })

  if (firstUser) {
    return {
      user: firstUser,
      hasCookie: false,
    }
  }

  const createdUser = await prisma.user.create({
    data: {
      name: DEFAULT_USER_NAME,
    },
  })

  return {
    user: createdUser,
    hasCookie: false,
  }
}

export async function getCurrentUserOrThrow() {
  const { user } = await resolveCurrentUserContext()
  return user
}

export async function listUserSummaries(): Promise<CurrentUserSummary[]> {
  return prisma.user.findMany({
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      exam_date: true,
      created_at: true,
    },
  })
}

export function toCurrentUserSummary(user: User): CurrentUserSummary {
  return {
    id: user.id,
    name: user.name,
    exam_date: user.exam_date,
    created_at: user.created_at,
  }
}

export async function setCurrentUserCookie(userId: string) {
  const cookieStore = await cookies()
  cookieStore.set(CURRENT_USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
}

export function assertOwnedRecord<T>(
  record: T | null | undefined,
  message = OWNERSHIP_ERROR_MESSAGE
): NonNullable<T> {
  if (!record) {
    throw new Error(message)
  }

  return record
}
