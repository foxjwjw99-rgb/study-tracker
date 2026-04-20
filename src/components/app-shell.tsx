"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu } from "lucide-react"
import { usePathname } from "next/navigation"

import { SignOutButton } from "@/components/auth/sign-out-button"
import { NotificationCenter } from "@/components/notification-center"
import { MainNav, BOTTOM_NAV_ITEMS, getPageTitle } from "@/components/main-nav"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { CurrentUserSummary } from "@/types"

type AppShellProps = {
  children: React.ReactNode
  currentUser: CurrentUserSummary
}

function UserAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase()
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-sm font-bold text-primary-foreground shadow-sm">
      {initial}
    </div>
  )
}

export function AppShell({ children, currentUser }: AppShellProps) {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const currentPageTitle = getPageTitle(pathname)

  return (
    <div className="flex min-h-screen bg-transparent">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-brand-mid focus:outline-none focus:ring-3 focus:ring-ring/50"
      >
        跳到主要內容
      </a>
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        {/* Sidebar Header */}
        <div className="flex h-18 items-center gap-3 border-b border-sidebar-border px-5 py-4">
          <UserAvatar name={currentUser.name} />
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-tight">
              {currentUser.name}
            </span>
            <span className="block text-xs text-muted-foreground">Study Tracker</span>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-auto py-4">
          <MainNav className="px-3" aria-label="主要導覽" />
        </div>

        {/* Sign Out */}
        <div className="border-t border-sidebar-border px-4 py-4">
          <SignOutButton />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex min-h-screen w-full flex-col md:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-5">
            {/* Mobile hamburger */}
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger render={<Button variant="ghost" size="icon" className="-ml-1 md:hidden" />}>
                <Menu className="h-5 w-5" />
                <span className="sr-only">開啟導覽</span>
              </SheetTrigger>
              <SheetContent side="left" className="w-[80vw] max-w-xs p-0">
                <SheetHeader className="border-b px-5 py-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={currentUser.name} />
                    <div className="min-w-0">
                      <SheetTitle className="truncate text-sm">{currentUser.name}</SheetTitle>
                      <SheetDescription className="text-xs">Study Tracker</SheetDescription>
                    </div>
                  </div>
                </SheetHeader>
                <div className="space-y-4 overflow-auto px-3 py-4">
                  <MainNav onNavigate={() => setIsMenuOpen(false)} aria-label="主要導覽" />
                  <div className="border-t pt-4">
                    <SignOutButton />
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Page title */}
            <p className="truncate text-base font-semibold">{currentPageTitle}</p>

            {/* Desktop user info */}
            <div className="ml-auto flex items-center gap-2">
              <NotificationCenter />
              <div className="hidden min-w-0 text-right md:block">
                <p className="truncate text-sm font-medium leading-tight">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground">目前登入</p>
              </div>
              <SignOutButton />
            </div>
          </div>
        </header>

        {/* Page content — bottom padding accounts for mobile bottom nav */}
        <main id="main" className="flex-1 p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-center border-t border-border/60 bg-background/90 backdrop-blur-xl [padding-bottom:env(safe-area-inset-bottom)] md:hidden"
        aria-label="主要導覽"
      >
        {BOTTOM_NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 py-3.5 text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary"
                />
              )}
              <item.icon
                className={cn(
                  "h-5 w-5 transition-transform duration-150",
                  isActive && "scale-110"
                )}
              />
              <span className="leading-none">{item.title}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
