/// <reference lib="webworker" />
// Service Worker for Pomodoro Timer Notifications

const TIMER_TAG = "pomodoro-timer"

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("message", (event) => {
  const { type, payload } = event.data || {}

  switch (type) {
    case "SHOW_TIMER":
    case "UPDATE_TIMER":
      self.registration.showNotification(payload.title, {
        body: payload.body,
        tag: TIMER_TAG,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        silent: true,
        renotify: false,
        requireInteraction: true,
      })
      break

    case "HIDE_TIMER":
      self.registration.getNotifications({ tag: TIMER_TAG }).then((notifications) => {
        notifications.forEach((n) => n.close())
      })
      break
  }
})

// When user taps the notification, focus the app window
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/study-log") && "focus" in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("/study-log")
      }
    })
  )
})
