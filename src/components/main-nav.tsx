"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarCheck,
  FileUp,
  Gift,
  Home,
  Languages,
  Settings,
  Trophy,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export const NAV_ITEMS = [
  {
    title: "儀表板",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "學習紀錄",
    href: "/study-log",
    icon: BookOpen,
  },
  {
    title: "練習歷程",
    href: "/practice",
    icon: Brain,
  },
  {
    title: "英文單字",
    href: "/vocabulary",
    icon: Languages,
  },
  {
    title: "單字分析",
    href: "/vocabulary/insights",
    icon: BarChart3,
  },
  {
    title: "複習與錯題",
    href: "/review",
    icon: CalendarCheck,
  },
  {
    title: "數據分析",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    title: "讀書排行",
    href: "/leaderboard",
    icon: Trophy,
  },
  {
    title: "獎勵抽獎",
    href: "/rewards",
    icon: Gift,
  },
  {
    title: "匯入題目",
    href: "/import",
    icon: FileUp,
  },
  {
    title: "設定",
    href: "/settings",
    icon: Settings,
  },
] as const

export function getPageTitle(pathname: string) {
  return NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  )?.title || "學習追蹤器"
}

export function MainNav({
  className,
  onNavigate,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  return (
    <nav
      className={cn("flex flex-col space-y-2 lg:space-y-4", className)}
      {...props}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              buttonVariants({ variant: isActive ? "secondary" : "ghost" }),
              "justify-start rounded-2xl px-3 py-2 text-sm",
              isActive && "bg-primary/10 text-primary hover:bg-primary/12"
            )}
          >
            <item.icon className="mr-2 h-4 w-4" />
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}
