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

const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { title: "儀表板", href: "/dashboard", icon: Home },
      { title: "學習紀錄", href: "/study-log", icon: BookOpen },
      { title: "練習歷程", href: "/practice", icon: Brain },
      { title: "英文單字", href: "/vocabulary", icon: Languages },
      { title: "複習與錯題", href: "/review", icon: CalendarCheck },
    ],
  },
  {
    label: "追蹤",
    items: [
      { title: "數據分析", href: "/analytics", icon: BarChart3 },
      { title: "讀書排行", href: "/leaderboard", icon: Trophy },
      { title: "獎勵抽獎", href: "/rewards", icon: Gift },
    ],
  },
  {
    label: "其他",
    items: [
      { title: "匯入題目", href: "/import", icon: FileUp },
      { title: "設定", href: "/settings", icon: Settings },
    ],
  },
]

export const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items)

// First 5 items used for the mobile bottom navigation bar
export const BOTTOM_NAV_ITEMS = NAV_SECTIONS[0].items

export function getPageTitle(pathname: string) {
  return (
    NAV_ITEMS.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    )?.title ?? "學習追蹤器"
  )
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
    <nav className={cn("space-y-4", className)} {...props}>
      {NAV_SECTIONS.map((section, i) => (
        <div key={i} className="space-y-0.5">
          {section.label ? (
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              {section.label}
            </p>
          ) : null}
          {section.items.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <item.icon className="h-4 w-4 shrink-0" />
                {item.title}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
