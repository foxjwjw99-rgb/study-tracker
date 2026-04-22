"use server"

import { revalidatePath } from "next/cache"

import prisma from "@/lib/prisma"
import {
  assertOwnedRecord,
  getCurrentUserOrThrow,
  OWNERSHIP_ERROR_MESSAGE,
} from "@/lib/current-user"

import { buildUnitSlug, normalizeUnitAlias } from "@/lib/subject-unit"

import type { ActionResult, Subject, SubjectDeletionImpact } from "@/types"

export async function updateExamDate(date: Date) {
  const user = await getCurrentUserOrThrow()
  await prisma.user.update({
    where: { id: user.id },
    data: { exam_date: date },
  })
  revalidatePath("/", "layout")
}

export async function getSubjects(): Promise<Subject[]> {
  const user = await getCurrentUserOrThrow()
  return prisma.subject.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      name: true,
      target_score: true,
      exam_weight: true,
    },
  })
}

export async function createSubject(data: {
  name: string
  target_score?: number | null
  exam_weight?: number | null
}) {
  const user = await getCurrentUserOrThrow()
  const trimmedName = data.name.trim().replace(/\s+/g, " ")

  if (!trimmedName) {
    return {
      success: false,
      message: "請輸入有效的科目名稱。",
    }
  }

  const existingSubject = await prisma.subject.findFirst({
    where: {
      user_id: user.id,
      name: trimmedName,
    }
  })

  if (existingSubject) {
    return {
      success: false,
      message: "已經有同名的科目了。",
    }
  }

  const subject = await prisma.subject.create({
    data: {
      name: trimmedName,
      target_score: data.target_score ?? null,
      exam_weight: data.exam_weight ?? null,
      user_id: user.id,
    },
  })
  revalidatePath("/settings")
  revalidatePath("/dashboard")
  return subject
}

export async function updateSubjectExamWeight(
  subjectId: string,
  examWeight: number | null,
): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()

  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, user_id: user.id },
    select: { id: true },
  })
  assertOwnedRecord(subject, OWNERSHIP_ERROR_MESSAGE)

  await prisma.subject.update({
    where: { id: subjectId },
    data: { exam_weight: examWeight },
  })

  revalidatePath("/settings")
  revalidatePath("/dashboard")
  return { success: true, message: "已更新科目比重。" }
}

export async function getSubjectDeletionImpact(id: string): Promise<SubjectDeletionImpact> {
  const user = await getCurrentUserOrThrow()
  const subject = await prisma.subject.findFirst({
    where: {
      id,
      user_id: user.id,
    },
    select: {
      id: true,
      name: true,
    },
  })

  const ownedSubject = assertOwnedRecord(subject, OWNERSHIP_ERROR_MESSAGE)

  const [
    studyLogsCount,
    practiceLogsCount,
    wrongQuestionsCount,
    reviewTasksCount,
    questionsCount,
  ] = await prisma.$transaction([
    prisma.studyLog.count({ where: { subject_id: ownedSubject.id } }),
    prisma.practiceLog.count({ where: { subject_id: ownedSubject.id } }),
    prisma.wrongQuestion.count({ where: { subject_id: ownedSubject.id } }),
    prisma.reviewTask.count({ where: { subject_id: ownedSubject.id } }),
    prisma.question.count({ where: { subject_id: ownedSubject.id } }),
  ])

  return {
    subjectId: ownedSubject.id,
    subjectName: ownedSubject.name,
    studyLogsCount,
    practiceLogsCount,
    wrongQuestionsCount,
    reviewTasksCount,
    questionsCount,
    totalCount:
      studyLogsCount +
      practiceLogsCount +
      wrongQuestionsCount +
      reviewTasksCount +
      questionsCount,
  }
}

export async function deleteSubject(id: string): Promise<ActionResult> {
  const impact = await getSubjectDeletionImpact(id)

  if (impact.totalCount > 0) {
    return {
      success: false,
      message: "這個科目已有相關學習資料，請使用進階刪除確認影響範圍後再刪除。",
    }
  }

  await prisma.subject.delete({
    where: { id: impact.subjectId },
  })

  revalidatePath("/settings")
  revalidatePath("/dashboard")

  return {
    success: true,
    message: `已刪除科目 ${impact.subjectName}。`,
  }
}

export type ExamUnitSubjectEntry = {
  subjectId: string
  subjectName: string
  units: { id: string; name: string; order: number }[]
}

export async function getExamUnits(): Promise<ExamUnitSubjectEntry[]> {
  const user = await getCurrentUserOrThrow()
  const subjects = await prisma.subject.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      name: true,
      exam_units: {
        orderBy: { display_order: "asc" },
        select: { id: true, name: true, display_order: true },
      },
    },
  })
  return subjects.map((s) => ({
    subjectId: s.id,
    subjectName: s.name,
    units: s.exam_units.map((u) => ({ id: u.id, name: u.name, order: u.display_order })),
  }))
}

export async function upsertExamUnits(
  entries: { subjectName: string; units: string[] }[]
): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()

  const subjectNames = entries.map((e) => e.subjectName)
  const subjects = await prisma.subject.findMany({
    where: { user_id: user.id, name: { in: subjectNames } },
    select: { id: true, name: true },
  })

  const subjectMap = new Map(subjects.map((s) => [s.name, s.id]))
  const missing = subjectNames.filter((n) => !subjectMap.has(n))

  if (missing.length > 0) {
    return {
      success: false,
      message: `找不到科目：${missing.join("、")}。請先在「學習科目」新增這些科目。`,
    }
  }

  const normalizedEntries = entries.map((entry) => ({
    ...entry,
    units: Array.from(new Set(entry.units.map((unit) => unit.trim()).filter(Boolean))),
  }))

  await prisma.$transaction(
    normalizedEntries.map((entry) => {
      const subjectId = subjectMap.get(entry.subjectName)!
      return prisma.subjectUnit.deleteMany({ where: { subject_id: subjectId } })
    })
  )

  await prisma.$transaction(
    normalizedEntries.flatMap((entry) => {
      const subjectId = subjectMap.get(entry.subjectName)!
      return entry.units.map((name, idx) =>
        prisma.subjectUnit.create({
          data: {
            subject_id: subjectId,
            name,
            slug: buildUnitSlug(name),
            display_order: idx,
            source: "MANUAL",
            aliases: {
              create: {
                subject_id: subjectId,
                alias: name,
                normalized_alias: normalizeUnitAlias(name),
              },
            },
          },
        })
      )
    })
  )

  revalidatePath("/settings")
  revalidatePath("/dashboard")

  return { success: true, message: "考試範圍已儲存。" }
}

export async function deleteSubjectCascade(id: string): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()
  const impact = await getSubjectDeletionImpact(id)

  await prisma.$transaction([
    prisma.reviewTask.deleteMany({ where: { subject_id: impact.subjectId, user_id: user.id } }),
    prisma.wrongQuestion.deleteMany({ where: { subject_id: impact.subjectId, user_id: user.id } }),
    prisma.practiceLog.deleteMany({ where: { subject_id: impact.subjectId, user_id: user.id } }),
    prisma.studyLog.deleteMany({ where: { subject_id: impact.subjectId, user_id: user.id } }),
    prisma.question.deleteMany({ where: { subject_id: impact.subjectId, user_id: user.id } }),
    prisma.subject.delete({ where: { id: impact.subjectId } }),
  ])

  revalidatePath("/settings")
  revalidatePath("/dashboard")
  revalidatePath("/study-log")
  revalidatePath("/practice")
  revalidatePath("/review")
  revalidatePath("/vocabulary")
  revalidatePath("/import")

  return {
    success: true,
    message: `已刪除科目 ${impact.subjectName}，並清除相關資料。`,
  }
}
