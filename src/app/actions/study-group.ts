"use server"

import { randomBytes } from "crypto"

import { revalidatePath } from "next/cache"
import { endOfDay, startOfDay, subDays } from "date-fns"

import prisma from "@/lib/prisma"
import { getCurrentUserOrThrow } from "@/lib/current-user"
import type {
  ActionResult,
  LeaderboardPeriod,
  StudyGroupSummary,
  StudyLeaderboardData,
  StudyLeaderboardEntry,
} from "@/types"

export async function createStudyGroup(name: string): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()
  const trimmedName = name.trim().replace(/\s+/g, " ")

  if (!trimmedName) {
    return { success: false, message: "請先輸入讀書房名稱。" }
  }

  const group = await prisma.studyGroup.create({
    data: {
      name: trimmedName,
      invite_code: await generateInviteCode(),
      owner_user_id: user.id,
      members: {
        create: {
          user_id: user.id,
        },
      },
    },
  })

  revalidatePath("/leaderboard")
  revalidatePath("/settings")

  return {
    success: true,
    message: `已建立讀書房「${group.name}」。`,
  }
}

export async function joinStudyGroup(inviteCode: string): Promise<ActionResult> {
  const user = await getCurrentUserOrThrow()
  const normalizedCode = inviteCode.trim().toUpperCase()

  if (!normalizedCode) {
    return { success: false, message: "請輸入邀請碼。" }
  }

  const group = await prisma.studyGroup.findUnique({
    where: { invite_code: normalizedCode },
    include: {
      members: {
        where: { user_id: user.id },
        select: { id: true },
      },
    },
  })

  if (!group) {
    return { success: false, message: "找不到這個讀書房邀請碼。" }
  }

  if (group.members.length > 0) {
    return { success: true, message: `你已經在「${group.name}」裡了。` }
  }

  await prisma.studyGroupMember.create({
    data: {
      study_group_id: group.id,
      user_id: user.id,
    },
  })

  revalidatePath("/leaderboard")
  revalidatePath("/settings")

  return {
    success: true,
    message: `已加入讀書房「${group.name}」。`,
  }
}

export async function getStudyGroupsForCurrentUser(): Promise<StudyGroupSummary[]> {
  const user = await getCurrentUserOrThrow()

  const memberships = await prisma.studyGroupMember.findMany({
    where: { user_id: user.id },
    include: {
      study_group: {
        include: {
          _count: {
            select: {
              members: true,
            },
          },
        },
      },
    },
    orderBy: {
      study_group: {
        created_at: "asc",
      },
    },
  })

  return memberships.map((membership) => ({
    id: membership.study_group.id,
    name: membership.study_group.name,
    invite_code: membership.study_group.invite_code,
    memberCount: membership.study_group._count.members,
    isOwner: membership.study_group.owner_user_id === user.id,
  }))
}

export async function getStudyLeaderboardData(input?: {
  groupId?: string
  period?: LeaderboardPeriod
}): Promise<StudyLeaderboardData> {
  const user = await getCurrentUserOrThrow()
  const groups = await getStudyGroupsForCurrentUser()
  const activeGroup = groups.find((group) => group.id === input?.groupId) ?? groups[0] ?? null
  const activePeriod = input?.period ?? "week"

  if (!activeGroup) {
    return {
      groups,
      activeGroup: null,
      activePeriod,
      entries: [],
      currentUserEntry: null,
    }
  }

  const range = getPeriodRange(activePeriod)

  const members = await prisma.studyGroupMember.findMany({
    where: { study_group_id: activeGroup.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  const memberUserIds = members.map((member) => member.user.id)

  const logs = await prisma.studyLog.groupBy({
    by: ["user_id"],
    where: {
      user_id: { in: memberUserIds },
      study_date: {
        gte: range.start,
        lte: range.end,
      },
    },
    _sum: {
      duration_minutes: true,
    },
    _count: {
      _all: true,
    },
  })

  const totals = new Map(
    logs.map((log) => [
      log.user_id,
      {
        totalMinutes: log._sum.duration_minutes ?? 0,
        totalSessions: log._count._all,
      },
    ])
  )

  const entries: StudyLeaderboardEntry[] = members
    .map((member) => {
      const stat = totals.get(member.user.id)
      return {
        userId: member.user.id,
        userName: member.user.name,
        totalMinutes: stat?.totalMinutes ?? 0,
        totalSessions: stat?.totalSessions ?? 0,
        rank: 0,
        isCurrentUser: member.user.id === user.id,
      }
    })
    .sort((a, b) => {
      if (b.totalMinutes !== a.totalMinutes) {
        return b.totalMinutes - a.totalMinutes
      }
      if (b.totalSessions !== a.totalSessions) {
        return b.totalSessions - a.totalSessions
      }
      return a.userName.localeCompare(b.userName, "zh-Hant")
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }))

  return {
    groups,
    activeGroup,
    activePeriod,
    entries,
    currentUserEntry: entries.find((entry) => entry.isCurrentUser) ?? null,
  }
}

async function generateInviteCode() {
  const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // excludes I, O, 0, 1 to avoid confusion
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const bytes = randomBytes(12)
    const code = Array.from(bytes).map((b) => CHARS[b % CHARS.length]).join("")
    const existing = await prisma.studyGroup.findUnique({ where: { invite_code: code } })
    if (!existing) {
      return code
    }
  }

  // Fallback: 16-char hex from crypto
  return randomBytes(8).toString("hex").toUpperCase()
}

function getPeriodRange(period: LeaderboardPeriod) {
  const now = new Date()

  if (period === "today") {
    return {
      start: startOfDay(now),
      end: endOfDay(now),
    }
  }

  return {
    start: startOfDay(subDays(now, 6)),
    end: endOfDay(now),
  }
}
