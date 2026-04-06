"use client"

import { useEffect, useState } from "react"
import { Share2, Smartphone } from "lucide-react"

export function PwaInstallHint() {
  const [show, setShow] = useState(false)
  const [isIos, setIsIos] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const timer = window.setTimeout(() => {
      const ua = window.navigator.userAgent.toLowerCase()
      const ios = /iphone|ipad|ipod/.test(ua)
      const standalone =
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone

      setIsIos(ios)
      setShow(Boolean(ios && !standalone))
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  if (!show || !isIos) {
    return null
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 rounded-2xl border border-border/80 bg-card/95 p-4 shadow-[0_20px_40px_rgba(76,95,140,0.12)] backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-primary/10 p-2 text-primary">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">加到主畫面，用起來會更像 app</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            在 Safari 點 <Share2 className="mx-1 inline h-4 w-4 align-text-bottom" /> 分享，再選「加入主畫面」。
          </p>
        </div>
        <button
          type="button"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setShow(false)}
        >
          關閉
        </button>
      </div>
    </div>
  )
}
