"use client"

import { Bell } from "lucide-react"
import { useNotifications } from "@/hooks/use-notifications"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function NotificationCenter() {
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const triggerLabel =
    unreadCount > 0 ? `通知，${unreadCount} 則未讀` : "通知"

  return (
    <Popover>
      <PopoverTrigger
        aria-label={triggerLabel}
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        aria-label="通知列表"
        align="end"
        sideOffset={8}
        className="w-80 gap-0 overflow-hidden p-0"
      >
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="text-sm font-semibold">通知</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="rounded text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              全部標為已讀
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
                  "transition-colors hover:bg-accent/50"
                )}
              >
                <p className="text-sm font-medium leading-tight">{notif.title}</p>
                {notif.body && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{notif.body}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground/70">
                  {new Date(notif.timestamp).toLocaleTimeString("zh-TW", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
