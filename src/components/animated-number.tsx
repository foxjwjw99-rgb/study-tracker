"use client"

import { useEffect, useRef, useState } from "react"

type AnimatedNumberProps = {
  value: number
  durationMs?: number
  format?: "minutes"
  className?: string
}

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes))
  const hours = Math.floor(safeMinutes / 60)
  const mins = safeMinutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
}

export function AnimatedNumber({
  value,
  durationMs = 900,
  format,
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value)
  const previousRef = useRef(value)

  useEffect(() => {
    const from = previousRef.current
    const to = value
    if (from === to) return

    let raf = 0
    const reduced = prefersReducedMotion()
    const start = performance.now()
    const effectiveDuration = reduced ? 0 : durationMs

    const step = (now: number) => {
      const t = effectiveDuration === 0 ? 1 : Math.min(1, (now - start) / effectiveDuration)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = from + (to - from) * eased
      setDisplay(current)
      if (t < 1) {
        raf = requestAnimationFrame(step)
      } else {
        previousRef.current = to
      }
    }

    raf = requestAnimationFrame(step)
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [value, durationMs])

  const rounded = Math.round(display)
  const rendered = format === "minutes" ? formatMinutes(rounded) : rounded
  return <span className={className}>{rendered}</span>
}
