"use client"

import { Bell } from "lucide-react"
import { useRef, useState } from "react"
import { useNotifications } from "@/hooks/use-notifications"
import { cn } from "@/lib/utils"

export function NotificationCenter() {
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const handleToggle = () => {
    if (!open) markAllRead()
    setOpen((prev) => !prev)
  }

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!panelRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={panelRef} onBlur={handleBlur} tabIndex={-1}>
      <button
        onClick={handleToggle}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="通知"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-lg border border-border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">通知</span>
            {notifications.length > 0 && (
              <button
                onClick={() => setOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                關閉
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">暫無通知</p>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    "border-b px-4 py-3 last:border-b-0",
                    "hover:bg-accent/50 transition-colors"
                  )}
                >
                  <p className="text-sm font-medium leading-tight">{notif.title}</p>
                  {notif.body && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{notif.body}</p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground/60">
                    {new Date(notif.timestamp).toLocaleTimeString("zh-TW", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
