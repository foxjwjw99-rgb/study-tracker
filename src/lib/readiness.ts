import type {
  DashboardPlanItem,
  DashboardSubjectReadinessItem,
  DashboardTopicDetailItem,
  DashboardWeakAreaItem,
} from "@/types"

export function readinessLabel(level: DashboardSubjectReadinessItem["level"] | DashboardTopicDetailItem["status"]) {
  switch (level) {
    case "strong":
      return "穩定"
    case "steady":
      return "可控"
    case "warning":
      return "偏危險"
    default:
      return "急救中"
  }
}

export function readinessBadgeClass(level: DashboardSubjectReadinessItem["level"] | DashboardTopicDetailItem["status"]) {
  switch (level) {
    case "strong":
      return "bg-emerald-500/12 text-emerald-700"
    case "steady":
      return "bg-sky-500/12 text-sky-700"
    case "warning":
      return "bg-amber-500/12 text-amber-700"
    default:
      return "bg-rose-500/12 text-rose-700"
  }
}

export function readinessBarClass(level: DashboardSubjectReadinessItem["level"]) {
  switch (level) {
    case "strong":
      return "bg-gradient-to-r from-emerald-400 to-emerald-600"
    case "steady":
      return "bg-gradient-to-r from-sky-400 to-sky-600"
    case "warning":
      return "bg-gradient-to-r from-amber-400 to-amber-600"
    default:
      return "bg-gradient-to-r from-rose-400 to-rose-600"
  }
}

export function readinessScoreColorClass(level: DashboardSubjectReadinessItem["level"]) {
  switch (level) {
    case "strong":
      return "text-emerald-600 dark:text-emerald-400"
    case "steady":
      return "text-sky-600 dark:text-sky-400"
    case "warning":
      return "text-amber-600 dark:text-amber-400"
    default:
      return "text-rose-600 dark:text-rose-400"
  }
}

export function coverageBarClass(rate: number) {
  if (rate >= 80) return "bg-gradient-to-r from-emerald-400 to-emerald-600"
  if (rate >= 60) return "bg-gradient-to-r from-sky-400 to-sky-600"
  if (rate >= 40) return "bg-gradient-to-r from-amber-400 to-amber-600"
  return "bg-gradient-to-r from-rose-400 to-rose-600"
}

export function planStepAccentClass(tone: DashboardPlanItem["tone"]) {
  switch (tone) {
    case "danger":
      return "bg-rose-500"
    case "warning":
      return "bg-amber-500"
    case "success":
      return "bg-emerald-500"
    default:
      return "bg-primary"
  }
}

export function momentumLabel(momentum: DashboardSubjectReadinessItem["momentum"]) {
  switch (momentum) {
    case "up":
      return "狀態往上"
    case "down":
      return "需要拉回"
    default:
      return "先穩住節奏"
  }
}

export function priorityLabel(priority: DashboardWeakAreaItem["priority"]) {
  switch (priority) {
    case "high":
      return "高優先"
    case "medium":
      return "中優先"
    default:
      return "觀察中"
  }
}

export function priorityBadgeClass(priority: DashboardWeakAreaItem["priority"]) {
  switch (priority) {
    case "high":
      return "bg-rose-500/12 text-rose-700"
    case "medium":
      return "bg-amber-500/12 text-amber-700"
    default:
      return "bg-sky-500/12 text-sky-700"
  }
}

export function planStepToneClass(tone: DashboardPlanItem["tone"]) {
  switch (tone) {
    case "danger":
      return "bg-rose-500/12 text-rose-700"
    case "warning":
      return "bg-amber-500/12 text-amber-700"
    case "success":
      return "bg-emerald-500/12 text-emerald-700"
    default:
      return "bg-primary/12 text-primary"
  }
}

export function statusBadgeClass(tone: "success" | "warning" | "normal") {
  if (tone === "success") {
    return "rounded-2xl bg-emerald-500/12 p-2 text-emerald-600"
  }

  if (tone === "warning") {
    return "rounded-2xl bg-amber-500/12 p-2 text-amber-600"
  }

  return "rounded-2xl bg-primary/12 p-2 text-primary"
}
