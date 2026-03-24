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
