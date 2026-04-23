"use client"

import { useRouter } from "next/navigation"
import { useOptimistic, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { toggleRewardRedeemed } from "@/app/actions/rewards"
import { Button } from "@/components/ui/button"
import { DrawRewardDialogButton } from "@/components/reward-draw-dialog"
import type { RewardDrawItem } from "@/types"

export function DrawRewardButton({
  availableDraws,
}: {
  availableDraws: number
}) {
  return <DrawRewardDialogButton availableDraws={availableDraws} />
}

export function RewardRedeemButton({
  reward,
}: {
  reward: RewardDrawItem
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [redeemed, setOptimisticRedeemed] = useOptimistic(
    reward.redeemed,
    (_state, next: boolean) => next,
  )

  return (
    <Button
      variant={redeemed ? "outline" : "secondary"}
      size="sm"
      disabled={isPending}
      onClick={() => {
        const next = !redeemed
        startTransition(async () => {
          setOptimisticRedeemed(next)
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
      {redeemed ? "改回未兌換" : "標記已兌換"}
    </Button>
  )
}
