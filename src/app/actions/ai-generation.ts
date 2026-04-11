"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { getCurrentUserOrThrow } from "@/lib/current-user"
import {
  generateQuestionExplanation,
  generateWeaknessDiagnosis,
  suggestUnitForGroup,
  suggestUnitForQuestion,
  type UnitSuggestion,
  type WeakTopicStat,
} from "@/lib/ai/gemma"
import { normalizeUnitAlias } from "@/lib/subject-unit"
import type { AiUnitMappingStatus } from "@prisma/client"

/**
 * 為單題生成 AI 解析
 * 不覆蓋既有解析，只寫入 ai_explanation
 */
export async function generateQuestionAiExplanation(
  questionId: string,
  force: boolean = false
): Promise<{ success: boolean; explanation?: string; error?: string }> {
  try {
    const user = await getCurrentUserOrThrow()

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        group: true,
        subject: true,
      },
    })

    if (!question) {
      return { success: false, error: "題目不存在" }
    }

    if (question.user_id !== user.id) {
      return { success: false, error: "無權限" }
    }

    if (!force && question.ai_explanation) {
      return { success: true, explanation: question.ai_explanation }
    }

    // 解析選項
    let options: string[] | null = null
    try {
      if (question.options && question.options !== "[]") {
        options = JSON.parse(question.options) as string[]
      }
    } catch {
      // 忽略 JSON parse 錯誤
    }

    // 取得正確答案文字
    let correctAnswerText = String(question.answer)
    if (question.question_type === "multiple_choice" && options && options[question.answer]) {
      correctAnswerText = `${String.fromCharCode(65 + question.answer)}. ${options[question.answer]}`
    } else if (question.text_answer) {
      correctAnswerText = question.text_answer
    }

    // 呼叫 AI
    const aiExplanation = await generateQuestionExplanation(
      question.question,
      options,
      correctAnswerText,
      question.explanation || undefined,
      question.subject?.name || undefined
    )

    // 存進資料庫
    await prisma.question.update({
      where: { id: questionId },
      data: {
        ai_explanation: aiExplanation,
      },
    })

    revalidatePath("/practice")
    revalidatePath("/import")

    return { success: true, explanation: aiExplanation }
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知錯誤"
    return { success: false, error: message }
  }
}

/**
 * 批量預覽：AI 建議單元對應
 */
export interface MapPreviewResult {
  groupId: string
  topic: string
  currentUnitId?: string | null
  currentUnitName?: string
  suggestedUnit?: UnitSuggestion
}

export async function previewUnitMapping(
  subjectId: string,
  mode: 'groups' | 'questions' = 'groups',
  itemIds?: string[]
): Promise<{ success: boolean; data?: MapPreviewResult[]; error?: string }> {
  try {
    const user = await getCurrentUserOrThrow()

    const units = await prisma.subjectUnit.findMany({
      where: { subject_id: subjectId },
      include: {
        aliases: true,
      },
    })
    const availableUnits = units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      aliases: unit.aliases.map((alias) => alias.alias),
    }))

    if (mode === 'groups') {
      const groups = await prisma.questionGroup.findMany({
        where: {
          subject_id: subjectId,
          user_id: user.id,
          ...(itemIds && itemIds.length > 0 ? { id: { in: itemIds.slice(0, 20) } } : {}),
        },
        include: {
          unit: true,
        },
        ...(itemIds && itemIds.length > 0 ? {} : { take: 20 }),
      })
      const results: MapPreviewResult[] = []

      for (const group of groups) {
        const preview: MapPreviewResult = {
          groupId: group.id,
          topic: group.topic,
          currentUnitId: group.unit_id,
          currentUnitName: group.unit?.name,
        }

        const suggestion = await suggestUnitForGroup(
          group.topic,
          group.context,
          availableUnits
        )

        if (suggestion) {
          preview.suggestedUnit = suggestion
        }

        results.push(preview)
      }

      return { success: true, data: results }
    } else {
      const questions = await prisma.question.findMany({
        where: {
          user_id: user.id,
          subject: { id: subjectId },
          ...(itemIds && itemIds.length > 0 ? { id: { in: itemIds.slice(0, 20) } } : {}),
        },
        include: {
          subject: true,
        },
        ...(itemIds && itemIds.length > 0 ? {} : { take: 20 }),
      })
      const results: MapPreviewResult[] = []

      for (const question of questions) {
        const preview: MapPreviewResult = {
          groupId: question.id,
          topic: question.topic,
          currentUnitId: question.unit_id,
          currentUnitName: question.topic,
        }

        let questionContext = question.question
        if (question.question_type === 'multiple_choice' && question.options) {
          try {
            const opts = JSON.parse(question.options) as string[]
            questionContext += '\n选项: ' + opts.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(' ')
          } catch {
            // ignore
          }
        }

        const suggestion = await suggestUnitForQuestion(
          question.topic,
          questionContext,
          availableUnits
        )

        if (suggestion) {
          preview.suggestedUnit = suggestion
        }

        results.push(preview)
      }

      return { success: true, data: results }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    return { success: false, error: message }
  }
}

/**
 * 批量確認：應用單元對應
 */
export interface MappingConfirmation {
  groupId: string
  unitId: string
  confidence: number
  reason: string
}

export async function confirmUnitMapping(
  subjectId: string,
  mappings: MappingConfirmation[]
): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
  try {
    const user = await getCurrentUserOrThrow()

    let updatedCount = 0

    await prisma.$transaction(async (tx) => {
      const groupIds = [...new Set(mappings.map((mapping) => mapping.groupId))]
      const unitIds = [...new Set(mappings.map((mapping) => mapping.unitId))]

      const [groups, units] = await Promise.all([
        tx.questionGroup.findMany({
          where: {
            id: { in: groupIds },
            user_id: user.id,
            subject_id: subjectId,
          },
          select: {
            id: true,
            topic: true,
          },
        }),
        tx.subjectUnit.findMany({
          where: {
            id: { in: unitIds },
            subject_id: subjectId,
          },
          select: {
            id: true,
            name: true,
          },
        }),
      ])

      const groupById = new Map(groups.map((group) => [group.id, group]))
      const unitById = new Map(units.map((unit) => [unit.id, unit]))

      for (const mapping of mappings) {
        const group = groupById.get(mapping.groupId)
        const unit = unitById.get(mapping.unitId)

        if (!group || !unit) {
          continue
        }

        const oldTopic = group.topic

        await tx.questionGroup.update({
          where: { id: mapping.groupId },
          data: {
            unit_id: mapping.unitId,
            topic: unit.name,
            ai_unit_mapping_status: "COMPLETED" as AiUnitMappingStatus,
            ai_unit_mapping_note: `自動對應 (信心度: ${mapping.confidence.toFixed(2)}) - ${mapping.reason}`,
            ai_unit_mapping_at: new Date(),
          },
        })

        await tx.question.updateMany({
          where: { group_id: mapping.groupId },
          data: {
            unit_id: mapping.unitId,
            topic: unit.name,
          },
        })

        if (oldTopic !== unit.name) {
          const normalizedAlias = normalizeUnitAlias(oldTopic)
          await tx.subjectUnitAlias.upsert({
            where: {
              subject_id_normalized_alias: {
                subject_id: subjectId,
                normalized_alias: normalizedAlias,
              },
            },
            create: {
              subject_id: subjectId,
              subject_unit_id: mapping.unitId,
              alias: oldTopic,
              normalized_alias: normalizedAlias,
            },
            update: {
              subject_unit_id: mapping.unitId,
            },
          })
        }

        updatedCount++
      }
    })

    revalidatePath("/practice")
    revalidatePath("/import")

    return { success: true, updatedCount }
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知錯誤"
    return { success: false, error: message }
  }
}

/**
 * 生成跨科目 AI 弱點診斷報告
 */
export async function generateAIWeaknessDiagnosis(): Promise<{
  success: boolean
  diagnosis?: string
  error?: string
}> {
  try {
    const user = await getCurrentUserOrThrow()

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [subjects, wrongGroups, carelessGroups, practiceGroups] = await Promise.all([
      prisma.subject.findMany({
        where: { user_id: user.id },
        select: { id: true, name: true },
      }),
      prisma.wrongQuestion.groupBy({
        by: ["subject_id", "topic"],
        where: { user_id: user.id, status: { in: ["ACTIVE", "CORRECTED"] } },
        _sum: { wrong_count: true },
        orderBy: { _sum: { wrong_count: "desc" } },
        take: 15,
      }),
      prisma.wrongQuestion.groupBy({
        by: ["subject_id", "topic"],
        where: { user_id: user.id, is_careless: true, status: { in: ["ACTIVE", "CORRECTED"] } },
        _count: { id: true },
      }),
      prisma.practiceLog.groupBy({
        by: ["subject_id", "topic"],
        where: { user_id: user.id, practice_date: { gte: thirtyDaysAgo } },
        _sum: { total_questions: true, correct_questions: true },
        having: { total_questions: { _sum: { gte: 5 } } },
      }),
    ])

    const subjectMap = new Map(subjects.map((s) => [s.id, s.name]))
    const carelessMap = new Map(
      carelessGroups.map((g) => [`${g.subject_id}::${g.topic}`, g._count.id])
    )
    const practiceMap = new Map(
      practiceGroups.map((g) => [
        `${g.subject_id}::${g.topic}`,
        { total: g._sum.total_questions ?? 0, correct: g._sum.correct_questions ?? 0 },
      ])
    )

    const topicKeys = new Set<string>()
    const stats: WeakTopicStat[] = []

    for (const g of wrongGroups) {
      const key = `${g.subject_id}::${g.topic}`
      topicKeys.add(key)
      const practice = practiceMap.get(key)
      stats.push({
        subjectName: subjectMap.get(g.subject_id) ?? g.subject_id,
        topic: g.topic,
        wrongCount: g._sum.wrong_count ?? 0,
        carelessCount: carelessMap.get(key) ?? 0,
        practiceTotal: practice?.total ?? null,
        practiceCorrect: practice?.correct ?? null,
      })
    }

    // Include practice-only topics with low accuracy that have no wrong questions yet
    for (const [key, practice] of practiceMap.entries()) {
      if (topicKeys.has(key)) continue
      const accuracy = practice.total > 0 ? practice.correct / practice.total : 1
      if (accuracy >= 0.6) continue
      const [subjectId, topic] = key.split("::")
      stats.push({
        subjectName: subjectMap.get(subjectId) ?? subjectId,
        topic,
        wrongCount: 0,
        carelessCount: 0,
        practiceTotal: practice.total,
        practiceCorrect: practice.correct,
      })
    }

    if (stats.length === 0) {
      return { success: false, error: "資料不足，請先累積更多練習紀錄再試。" }
    }

    const diagnosis = await generateWeaknessDiagnosis(stats)
    return { success: true, diagnosis }
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知錯誤"
    return { success: false, error: message }
  }
}
