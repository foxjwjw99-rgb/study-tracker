"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type AppNotification = {
  id: string
  title: string
  body: string
  timestamp: string
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const esRef = useRef<EventSource | null>(null)
  const retryDelayRef = useRef(2000)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showBrowserNotification = useCallback((title: string, body: string) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return
    try {
      new Notification(title, { body, icon: "/icon-192.png" })
    } catch {
      // some browsers restrict Notification outside SW context
    }
  }, [])

  const playSound = useCallback(() => {
    try {
      const audio = new Audio("/notification.mp3")
      audio.play().catch(() => {})
    } catch {
      // audio not available
    }
  }, [])

  const updateBadge = useCallback((count: number) => {
    if ("setAppBadge" in navigator) {
      if (count > 0) {
        ;(navigator as Navigator & { setAppBadge(n: number): void }).setAppBadge(count)
      } else {
        ;(navigator as Navigator & { clearAppBadge(): void }).clearAppBadge()
      }
    }
  }, [])

  const handleNotification = useCallback(
    (title: string, body: string) => {
      const notif: AppNotification = {
        id: `${Date.now()}-${Math.random()}`,
        title,
        body,
        timestamp: new Date().toISOString(),
      }
      setNotifications((prev) => [notif, ...prev].slice(0, 20))
      setUnreadCount((prev) => {
        const next = prev + 1
        updateBadge(next)
        return next
      })
      showBrowserNotification(title, body)
      playSound()
    },
    [showBrowserNotification, playSound, updateBadge]
  )

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
    }

    const es = new EventSource("/api/notifications/stream")
    esRef.current = es

    es.onopen = () => {
      retryDelayRef.current = 2000
    }

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type: string; title?: string; body?: string }
        if (data.type === "notification" && data.title) {
          handleNotification(data.title, data.body ?? "")
        }
      } catch {
        // malformed event
      }
    }

    es.onerror = () => {
      es.close()
      esRef.current = null

      const delay = Math.min(retryDelayRef.current, 30000)
      retryDelayRef.current = Math.min(delay * 2, 30000)

      retryTimeoutRef.current = setTimeout(() => {
        connect()
      }, delay)
    }
  }, [handleNotification])

  useEffect(() => {
    connect()
    return () => {
      esRef.current?.close()
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
    }
  }, [connect])

  const markAllRead = useCallback(() => {
    setUnreadCount(0)
    updateBadge(0)
  }, [updateBadge])

  return { notifications, unreadCount, markAllRead }
}
