"use client"

import { useCallback, useMemo, useReducer, useState, type CSSProperties } from "react"
import { Gift, Loader2, PartyPopper, RotateCcw, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { performRewardDraw } from "@/app/actions/rewards"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { REWARD_POOL } from "@/lib/rewards"
import { cn } from "@/lib/utils"
import type { RewardDrawItem } from "@/types"

const REEL_DURATION_MS = 2200
const REEL_ROW_HEIGHT = 72
const REEL_REPEATS = 16

type DrawState =
  | { phase: "idle" }
  | { phase: "spinning" }
  | { phase: "revealing"; reward: RewardDrawItem; remainingDraws?: number }
  | { phase: "error"; message: string }

type Action =
  | { type: "start" }
  | { type: "reveal"; reward: RewardDrawItem; remainingDraws?: number }
  | { type: "error"; message: string }
  | { type: "reset" }

function reducer(state: DrawState, action: Action): DrawState {
  switch (action.type) {
    case "start":
      return { phase: "spinning" }
    case "reveal":
      return { phase: "revealing", reward: action.reward, remainingDraws: action.remainingDraws }
    case "error":
      return { phase: "error", message: action.message }
    case "reset":
      return { phase: "idle" }
    default:
      return state
  }
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
}

type ReelItem = { key: string; label: string; tone: "cash" | "item" }

function buildReel(targetKey?: string): ReelItem[] {
  const base: ReelItem[] = REWARD_POOL.map((p) => ({ key: p.key, label: p.label, tone: p.type }))
  const items: ReelItem[] = []
  for (let i = 0; i < REEL_REPEATS; i += 1) {
    for (const prize of base) {
      items.push({ key: `${prize.key}-${i}`, label: prize.label, tone: prize.tone })
    }
  }
  const target = base.find((p) => p.key === targetKey) ?? base[0]
  items.push({ key: `${target.key}-final`, label: target.label, tone: target.tone })
  return items
}

type Confetti = {
  id: number
  left: number
  hue: number
  dx: number
  dy: number
  rotate: number
  delay: number
  duration: number
}

function makeConfetti(count: number): Confetti[] {
  const hues = [145, 85, 27, 165]
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    hue: hues[Math.floor(Math.random() * hues.length)] + Math.random() * 20 - 10,
    dx: (Math.random() - 0.5) * 280,
    dy: 220 + Math.random() * 100,
    rotate: (Math.random() - 0.5) * 1080,
    delay: Math.random() * 120,
    duration: 900 + Math.random() * 600,
  }))
}

export function DrawRewardDialogButton({ availableDraws }: { availableDraws: number }) {
  const router = useRouter()
  const [state, dispatch] = useReducer(reducer, { phase: "idle" } as DrawState)
  const [open, setOpen] = useState(false)
  const [confetti, setConfetti] = useState<Confetti[]>([])
  const [spinKey, setSpinKey] = useState(0)

  const draw = useCallback(async () => {
    dispatch({ type: "start" })
    setConfetti([])
    setSpinKey((k) => k + 1)
    const reduced = prefersReducedMotion()
    const minDuration = reduced ? 0 : REEL_DURATION_MS
    const startedAt = Date.now()
    try {
      const result = await performRewardDraw()
      if (!result.success || !result.reward) {
        dispatch({ type: "error", message: result.message })
        toast.error(result.message)
        return
      }
      const elapsed = Date.now() - startedAt
      if (elapsed < minDuration) {
        await new Promise((r) => setTimeout(r, minDuration - elapsed))
      }
      dispatch({ type: "reveal", reward: result.reward, remainingDraws: result.remainingDraws })
      if (!reduced) setConfetti(makeConfetti(28))
      router.refresh()
    } catch {
      dispatch({ type: "error", message: "抽獎失敗，稍後再試一次。" })
      toast.error("抽獎失敗，稍後再試一次。")
    }
  }, [router])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      dispatch({ type: "reset" })
      setConfetti([])
    }
  }

  const handleTriggerClick = () => {
    if (availableDraws <= 0) return
    setOpen(true)
    void draw()
  }

  const isPending = state.phase === "spinning"
  const isRevealing = state.phase === "revealing"
  const targetKey = isRevealing ? state.reward.prize_key : undefined
  const reelItems = useMemo(() => buildReel(targetKey), [targetKey])
  const reelDistance = (reelItems.length - 2) * REEL_ROW_HEIGHT

  return (
    <>
      <Button
        size="lg"
        disabled={isPending || availableDraws <= 0}
        onClick={handleTriggerClick}
        className="w-full sm:w-auto"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
        {isPending ? "抽獎中..." : availableDraws > 0 ? `立即抽獎（${availableDraws} 次）` : "暫時還不能抽"}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-primary" />
              讀書獎勵抽獎
            </DialogTitle>
            <DialogDescription>
              {isPending ? "轉盤轉動中，請稍候..." : isRevealing ? "恭喜！結果揭曉" : "準備開獎..."}
            </DialogDescription>
          </DialogHeader>

          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-muted/40">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-background/90 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-background/90 to-transparent" />
            <div className="pointer-events-none absolute inset-x-3 top-1/2 z-10 -translate-y-1/2">
              <div
                className={cn(
                  "h-[72px] rounded-xl ring-2 ring-primary/40 transition-all duration-300",
                  isRevealing && "ring-primary shadow-[0_0_40px_color-mix(in_oklab,var(--primary)_45%,transparent)]",
                )}
              />
            </div>

            <div className="relative h-[216px]">
              <div
                key={spinKey}
                className="flex flex-col"
                style={
                  {
                    animationName: isPending || isRevealing ? "reel-spin" : undefined,
                    animationDuration: `${REEL_DURATION_MS}ms`,
                    animationTimingFunction: "cubic-bezier(0.16, 0.84, 0.28, 1)",
                    animationFillMode: "forwards",
                    "--reel-distance": `-${reelDistance}px`,
                  } as CSSProperties
                }
              >
                {reelItems.map((item) => (
                  <div
                    key={item.key}
                    className={cn(
                      "flex h-[72px] shrink-0 items-center justify-center px-4 text-lg font-semibold tracking-tight",
                      item.tone === "cash" ? "text-foreground" : "text-primary",
                    )}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {isRevealing ? (
            <div
              className="relative flex flex-col items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center"
              style={{ animation: "reward-reveal 0.55s cubic-bezier(.2,.9,.2,1) both" }}
            >
              {confetti.length > 0 ? (
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  {confetti.map((c) => (
                    <span
                      key={c.id}
                      className="absolute top-4 block h-2 w-2 rounded-sm"
                      style={
                        {
                          left: `${c.left}%`,
                          backgroundColor: `oklch(0.7 0.2 ${c.hue})`,
                          animation: `confetti-burst ${c.duration}ms ease-out ${c.delay}ms forwards`,
                          "--cx": `${c.dx}px`,
                          "--cy": `${c.dy}px`,
                          "--cr": `${c.rotate}deg`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </div>
              ) : null}
              <PartyPopper className="h-8 w-8 text-primary" />
              <p className="text-xs text-muted-foreground">你抽到了</p>
              <p className="text-3xl font-semibold tracking-tight text-foreground">
                {state.reward.prize_label}
              </p>
              <p className="text-xs text-muted-foreground">
                價值 ${state.reward.prize_value}
                {typeof state.remainingDraws === "number" ? `・剩 ${state.remainingDraws} 次可抽` : ""}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
              <X className="h-4 w-4" />
              關閉
            </Button>
            <Button
              onClick={() => void draw()}
              disabled={
                isPending ||
                (state.phase === "revealing" &&
                  typeof state.remainingDraws === "number" &&
                  state.remainingDraws <= 0)
              }
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {isPending ? "轉盤轉動中..." : "再抽一次"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
