"use server"

import { revalidatePath } from "next/cache"

import prisma from "@/lib/prisma"
import {
  assertOwnedRecord,
  getCurrentUserOrThrow,
  OWNERSHIP_ERROR_MESSAGE,
} from "@/lib/current-user"

import type { StudyLogListItem } from "@/types"

export async function getStudyLogs(): Promise<StudyLogListItem[]> {
  const user = await getCurrentUserOrThrow()
  return prisma.studyLog.findMany({
    where: { user_id: user.id },
    include: {
      subject: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { study_date: "desc" },
    take: 50,
  })
}

export async function createStudyLog(data: {
  subject_id: string
  topic: string
  study_date: Date
  duration_minutes: number
  study_type: string
  focus_score: number
  planned_done: boolean
  source_type?: string
  notes?: string
}) {
  const MAX_DURATION_MINUTES = 720 // 12 hours cap per session
  if (data.duration_minutes < 1 || data.duration_minutes > MAX_DURATION_MINUTES) {
    throw new Error(`每次學習時間必須介於 1 至 ${MAX_DURATION_MINUTES} 分鐘之間。`)
  }

  const user = await getCurrentUserOrThrow()
  const subject = await prisma.subject.findFirst({
    where: {
      id: data.subject_id,
      user_id: user.id,
    },
    select: { id: true },
  })

  assertOwnedRecord(subject, OWNERSHIP_ERROR_MESSAGE)

  const log = await prisma.studyLog.create({
    data: {
      ...data,
      duration_minutes: Math.min(data.duration_minutes, MAX_DURATION_MINUTES),
      source_type: data.source_type ?? "manual",
      user_id: user.id,
    },
  })
  revalidatePath("/study-log")
  revalidatePath("/dashboard")
  return log
}

export async function deleteStudyLog(id: string) {
  const user = await getCurrentUserOrThrow()
  const existingLog = await prisma.studyLog.findFirst({
    where: {
      id,
      user_id: user.id,
    },
    select: { id: true },
  })

  const ownedLog = assertOwnedRecord(existingLog, OWNERSHIP_ERROR_MESSAGE)

  await prisma.studyLog.delete({
    where: { id: ownedLog.id },
  })
  revalidatePath("/study-log")
  revalidatePath("/dashboard")
}
