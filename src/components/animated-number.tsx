"use client"

import { useEffect, useRef, useState } from "react"

type AnimatedNumberProps = {
  value: number
  durationMs?: number
  format?: (value: number) => string
  className?: string
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
  return <span className={className}>{format ? format(rounded) : rounded}</span>
}
