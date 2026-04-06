import "server-only"

import type { User } from "@prisma/client"

import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import type { CurrentUserSummary } from "@/types"

export const OWNERSHIP_ERROR_MESSAGE = "找不到或無權限存取該資料。"

type CurrentUserContext = {
  user: User
}

export async function resolveCurrentUserContext(): Promise<CurrentUserContext> {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user) {
    throw new Error("UNAUTHORIZED")
  }

  return { user }
}

export async function getCurrentUserOrThrow() {
  const { user } = await resolveCurrentUserContext()
  return user
}

export async function listUserSummaries(): Promise<CurrentUserSummary[]> {
  const { user } = await resolveCurrentUserContext()
  return [toCurrentUserSummary(user)]
}

export function toCurrentUserSummary(user: User): CurrentUserSummary {
  return {
    id: user.id,
    name: user.name,
    exam_date: user.exam_date,
    created_at: user.created_at,
  }
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
