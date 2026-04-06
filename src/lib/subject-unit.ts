import type { Prisma, PrismaClient, SubjectUnitSource } from "@prisma/client"

const UNIT_ALIAS_NORMALIZE_PATTERN = /[()（）\[\]{}【】「」『』]/g

export function normalizeUnitAlias(input: string) {
  return input
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(UNIT_ALIAS_NORMALIZE_PATTERN, "")
    .replace(/[&＆]/g, "與")
    .replace(/[\/／]/g, "/")
    .replace(/[，,、]/g, "")
    .replace(/\s+/g, "")
}

export function buildUnitSlug(input: string) {
  const slug = input
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(UNIT_ALIAS_NORMALIZE_PATTERN, "")
    .replace(/[&＆]/g, " and ")
    .replace(/[\/／，,、]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return slug || "unit"
}

type UnitClient = PrismaClient | Prisma.TransactionClient

export type ResolveSubjectUnitInput = {
  subjectId: string
  unitId?: string | null
  unitName?: string | null
  topic?: string | null
  createIfMissing?: boolean
  source?: SubjectUnitSource
}

export type ResolvedSubjectUnit = {
  unitId: string | null
  unitName: string | null
  topicSnapshot: string
}

export async function resolveSubjectUnit(
  db: UnitClient,
  input: ResolveSubjectUnitInput,
): Promise<ResolvedSubjectUnit> {
  const rawName = input.unitName?.trim() || input.topic?.trim() || ""
  const topicSnapshot = rawName

  if (input.unitId) {
    const unit = await db.subjectUnit.findFirst({
      where: { id: input.unitId, subject_id: input.subjectId },
      select: { id: true, name: true },
    })
    if (unit) {
      return {
        unitId: unit.id,
        unitName: unit.name,
        topicSnapshot: topicSnapshot || unit.name,
      }
    }
  }

  if (!rawName) {
    return {
      unitId: null,
      unitName: null,
      topicSnapshot: "",
    }
  }

  const normalizedAlias = normalizeUnitAlias(rawName)

  const alias = await db.subjectUnitAlias.findFirst({
    where: {
      subject_id: input.subjectId,
      normalized_alias: normalizedAlias,
    },
    include: {
      subject_unit: {
        select: { id: true, name: true },
      },
    },
  })

  if (alias?.subject_unit) {
    return {
      unitId: alias.subject_unit.id,
      unitName: alias.subject_unit.name,
      topicSnapshot: topicSnapshot || alias.subject_unit.name,
    }
  }

  const byName = await db.subjectUnit.findFirst({
    where: {
      subject_id: input.subjectId,
      OR: [{ name: rawName }, { slug: buildUnitSlug(rawName) }],
    },
    select: { id: true, name: true },
  })

  if (byName) {
    await ensureSubjectUnitAlias(db, input.subjectId, byName.id, rawName)
    return {
      unitId: byName.id,
      unitName: byName.name,
      topicSnapshot: topicSnapshot || byName.name,
    }
  }

  if (!input.createIfMissing) {
    return {
      unitId: null,
      unitName: null,
      topicSnapshot,
    }
  }

  const created = await db.subjectUnit.create({
    data: {
      subject_id: input.subjectId,
      name: rawName,
      slug: buildUnitSlug(rawName),
      source: input.source ?? "SYSTEM",
      aliases: {
        create: {
          subject_id: input.subjectId,
          alias: rawName,
          normalized_alias: normalizedAlias,
        },
      },
    },
    select: { id: true, name: true },
  })

  return {
    unitId: created.id,
    unitName: created.name,
    topicSnapshot: topicSnapshot || created.name,
  }
}

export async function ensureSubjectUnitAlias(
  db: UnitClient,
  subjectId: string,
  subjectUnitId: string,
  alias: string,
) {
  const trimmedAlias = alias.trim()
  if (!trimmedAlias) return

  const normalizedAlias = normalizeUnitAlias(trimmedAlias)
  const existing = await db.subjectUnitAlias.findFirst({
    where: {
      subject_id: subjectId,
      normalized_alias: normalizedAlias,
    },
    select: { id: true, subject_unit_id: true },
  })

  if (existing) return

  await db.subjectUnitAlias.create({
    data: {
      subject_id: subjectId,
      subject_unit_id: subjectUnitId,
      alias: trimmedAlias,
      normalized_alias: normalizedAlias,
    },
  })
}
