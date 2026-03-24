"use client"

import { useState } from "react"
import { Menu } from "lucide-react"
import { usePathname } from "next/navigation"

import { MainNav, getPageTitle } from "@/components/main-nav"
import { CurrentUserCookieSync } from "@/components/current-user-cookie-sync"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { CurrentUserSummary } from "@/types"

type AppShellProps = {
  children: React.ReactNode
  currentUser: CurrentUserSummary
  shouldSyncCookie: boolean
}

export function AppShell({
  children,
  currentUser,
  shouldSyncCookie,
}: AppShellProps) {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const currentPageTitle = getPageTitle(pathname)

  return (
    <>
      {shouldSyncCookie ? <CurrentUserCookieSync userId={currentUser.id} /> : null}
      <div className="flex min-h-screen bg-transparent">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar/85 backdrop-blur md:flex">
          <div className="flex h-18 flex-col justify-center border-b border-sidebar-border px-6 py-4">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Study Tracker</span>
            <span className="mt-1 truncate text-base font-semibold">{currentUser.name}</span>
          </div>
          <div className="flex-1 overflow-auto py-4">
            <MainNav className="px-3" />
          </div>
        </aside>

        <div className="flex min-h-screen w-full flex-col md:pl-64">
          <header className="sticky top-0 z-30 border-b border-border/60 bg-background/75 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                  <SheetTrigger render={<Button variant="outline" size="icon" className="md:hidden" />}>
                    <Menu className="h-4 w-4" />
                    <span className="sr-only">開啟導覽</span>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
                    <SheetHeader className="border-b">
                      <SheetTitle>學習追蹤器</SheetTitle>
                      <SheetDescription className="truncate">
                        目前使用者：{currentUser.name}
                      </SheetDescription>
                    </SheetHeader>
                    <div className="px-3 py-4">
                      <MainNav className="space-y-2" onNavigate={() => setIsMenuOpen(false)} />
                    </div>
                  </SheetContent>
                </Sheet>

                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{currentPageTitle}</p>
                  <p className="truncate text-xs text-muted-foreground md:hidden">
                    {currentUser.name}
                  </p>
                </div>
              </div>

              <div className="hidden min-w-0 text-right md:block">
                <p className="truncate text-sm font-medium">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground">目前使用者</p>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </>
  )
}
