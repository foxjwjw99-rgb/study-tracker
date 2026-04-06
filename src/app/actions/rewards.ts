"use server"

import { revalidatePath } from "next/cache"

import prisma from "@/lib/prisma"
import { getCurrentUserOrThrow } from "@/lib/current-user"
import {
  pickRewardPrize,
  REWARD_DRAW_COST_MINUTES,
  REWARD_EXPECTED_VALUE,
} from "@/lib/rewards"
import type {
  RewardDrawActionResult,
  RewardsData,
} from "@/types"

export async function getRewardsData(): Promise<RewardsData> {
  const user = await getCurrentUserOrThrow()

  const [studyAgg, recentDraws, usedDraws, allDraws] = await Promise.all([
    prisma.studyLog.aggregate({
      where: {
        user_id: user.id,
      },
      _sum: {
        duration_minutes: true,
      },
    }),
    prisma.rewardDraw.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: "desc" },
      take: 30,
    }),
    prisma.rewardDraw.count({
      where: { user_id: user.id },
    }),
    prisma.rewardDraw.findMany({
      where: { user_id: user.id },
      select: {
        prize_value: true,
        redeemed: true,
      },
    }),
  ])

  const totalStudyMinutes = studyAgg._sum.duration_minutes || 0
  const earnedDraws = Math.floor(totalStudyMinutes / REWARD_DRAW_COST_MINUTES)
  const availableDraws = Math.max(0, earnedDraws - usedDraws)
  const carryMinutes = Math.max(0, totalStudyMinutes - usedDraws * REWARD_DRAW_COST_MINUTES)
  const totalRewardValue = allDraws.reduce((sum, draw) => sum + draw.prize_value, 0)
  const redeemedValue = allDraws
    .filter((draw) => draw.redeemed)
    .reduce((sum, draw) => sum + draw.prize_value, 0)

  return {
    overview: {
      totalStudyMinutes,
      earnedDraws,
      usedDraws,
      availableDraws,
      carryMinutes,
      totalRewardValue,
      redeemedValue,
      pendingRedeemValue: totalRewardValue - redeemedValue,
      expectedValuePerHour: REWARD_EXPECTED_VALUE,
    },
    recentDraws,
  }
}

export async function performRewardDraw(): Promise<RewardDrawActionResult> {
  const user = await getCurrentUserOrThrow()

  const result = await prisma.$transaction(
    async (tx) => {
    const [studyAgg, usedDraws] = await Promise.all([
      tx.studyLog.aggregate({
        where: {
          user_id: user.id,
        },
        _sum: {
          duration_minutes: true,
        },
      }),
      tx.rewardDraw.count({
        where: { user_id: user.id },
      }),
    ])

    const totalStudyMinutes = studyAgg._sum.duration_minutes || 0
    const earnedDraws = Math.floor(totalStudyMinutes / REWARD_DRAW_COST_MINUTES)
    const availableDraws = Math.max(0, earnedDraws - usedDraws)

    if (availableDraws <= 0) {
      return {
        success: false,
        message: `還不能抽，先再累積 ${REWARD_DRAW_COST_MINUTES - (totalStudyMinutes % REWARD_DRAW_COST_MINUTES || 0)} 分鐘讀書時間。`,
      } satisfies RewardDrawActionResult
    }

    const prize = pickRewardPrize()
    const reward = await tx.rewardDraw.create({
      data: {
        user_id: user.id,
        prize_key: prize.key,
        prize_label: prize.label,
        prize_type: prize.type,
        prize_value: prize.value,
        probability_label: prize.probabilityLabel,
        draw_cost_minutes: REWARD_DRAW_COST_MINUTES,
      },
    })

    return {
      success: true,
      message: `抽到了 ${prize.label}！`,
      reward,
      remainingDraws: availableDraws - 1,
    } satisfies RewardDrawActionResult
  },
  { isolationLevel: "Serializable" }
  )

  revalidatePath("/rewards")
  revalidatePath("/dashboard")
  return result
}

export async function toggleRewardRedeemed(id: string): Promise<RewardDrawActionResult> {
  const user = await getCurrentUserOrThrow()

  const reward = await prisma.rewardDraw.findFirst({
    where: {
      id,
      user_id: user.id,
    },
  })

  if (!reward) {
    return {
      success: false,
      message: "找不到這筆獎勵紀錄。",
    }
  }

  const updated = await prisma.rewardDraw.update({
    where: { id: reward.id },
    data: {
      redeemed: !reward.redeemed,
      redeemed_at: reward.redeemed ? null : new Date(),
    },
  })

  revalidatePath("/rewards")

  return {
    success: true,
    message: updated.redeemed ? "已標記為已兌換。" : "已改回未兌換。",
    reward: updated,
  }
}
