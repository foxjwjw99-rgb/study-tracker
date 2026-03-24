"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Gift, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { performRewardDraw, toggleRewardRedeemed } from "@/app/actions/rewards"
import { Button } from "@/components/ui/button"
import type { RewardDrawItem } from "@/types"

export function DrawRewardButton({
  availableDraws,
}: {
  availableDraws: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      size="lg"
      disabled={isPending || availableDraws <= 0}
      onClick={() => {
        startTransition(async () => {
          try {
            const result = await performRewardDraw()
            if (!result.success) {
              toast.error(result.message)
              return
            }

            toast.success(result.message, {
              description:
                typeof result.remainingDraws === "number"
                  ? `目前還剩 ${result.remainingDraws} 次可抽。`
                  : undefined,
            })
            router.refresh()
          } catch {
            toast.error("抽獎失敗，稍後再試一次。")
          }
        })
      }}
      className="w-full sm:w-auto"
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
      {isPending ? "抽獎中..." : availableDraws > 0 ? `立即抽獎（${availableDraws} 次）` : "暫時還不能抽"}
    </Button>
  )
}

export function RewardRedeemButton({
  reward,
}: {
  reward: RewardDrawItem
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant={reward.redeemed ? "outline" : "secondary"}
      size="sm"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          try {
            const result = await toggleRewardRedeemed(reward.id)
            if (!result.success) {
              toast.error(result.message)
              return
            }

            toast.success(result.message)
            router.refresh()
          } catch {
            toast.error("更新兌換狀態失敗。")
          }
        })
      }}
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {reward.redeemed ? "改回未兌換" : "標記已兌換"}
    </Button>
  )
}
