"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { getCurrentUserOrThrow } from "@/lib/current-user"
import { generateQuestionExplanation, suggestUnitForGroup, type UnitSuggestion } from "@/lib/ai/gemma"
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
  groupIds?: string[]
): Promise<{ success: boolean; data?: MapPreviewResult[]; error?: string }> {
  try {
    const user = await getCurrentUserOrThrow()

    // 取得該科目所有既有單元
    const units = await prisma.subjectUnit.findMany({
      where: { subject_id: subjectId },
      include: {
        aliases: true,
      },
    })

    // 取得題組
    let query: Parameters<typeof prisma.questionGroup.findMany>[0] = {
      where: {
        subject_id: subjectId,
        user_id: user.id,
      },
      include: {
        unit: true,
      },
    }

    if (groupIds && groupIds.length > 0) {
      query.where = { ...query.where, id: { in: groupIds.slice(0, 20) } } // 最多 20 個
    } else {
      query.take = 20
    }

    const groups = await prisma.questionGroup.findMany(query)

    // 為每個題組生成建議
    const results: MapPreviewResult[] = []

    for (const group of groups) {
      const preview: MapPreviewResult = {
        groupId: group.id,
        topic: group.topic,
        currentUnitId: group.unit_id,
        currentUnitName: group.unit?.name,
      }

      // 呼叫 AI 建議
      const suggestion = await suggestUnitForGroup(
        group.topic,
        group.context,
        units.map((u) => ({
          id: u.id,
          name: u.name,
          aliases: u.aliases.map((a) => a.alias),
        }))
      )

      if (suggestion) {
        preview.suggestedUnit = suggestion
      }

      results.push(preview)
    }

    return { success: true, data: results }
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知錯誤"
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
      for (const mapping of mappings) {
        // 驗證題組與單元
        const group = await tx.questionGroup.findUnique({
          where: { id: mapping.groupId },
        })

        if (!group || group.user_id !== user.id || group.subject_id !== subjectId) {
          continue
        }

        const unit = await tx.subjectUnit.findUnique({
          where: { id: mapping.unitId },
        })

        if (!unit || unit.subject_id !== subjectId) {
          continue
        }

        // 取得舊 topic，待會寫成 alias
        const oldTopic = group.topic

        // 更新題組
        await tx.questionGroup.update({
          where: { id: mapping.groupId },
          data: {
            unit_id: mapping.unitId,
            topic: unit.name, // 同步 topic 到單元名稱
            ai_unit_mapping_status: "COMPLETED" as AiUnitMappingStatus,
            ai_unit_mapping_note: `自動對應 (信心度: ${mapping.confidence.toFixed(2)}) - ${mapping.reason}`,
            ai_unit_mapping_at: new Date(),
          },
        })

        // 同時更新子題的 unit_id 和 topic
        await tx.question.updateMany({
          where: { group_id: mapping.groupId },
          data: {
            unit_id: mapping.unitId,
            topic: unit.name,
          },
        })

        // 舊 topic 寫成 alias（未來複用）
        if (oldTopic !== unit.name) {
          const normalizedAlias = oldTopic.toLowerCase().trim()
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
