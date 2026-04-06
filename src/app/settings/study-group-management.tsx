"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Copy, Trophy } from "lucide-react"
import { toast } from "sonner"

import { createStudyGroup, joinStudyGroup } from "@/app/actions/study-group"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { StudyGroupSummary } from "@/types"
import Link from "next/link"

type StudyGroupManagementProps = {
  groups: StudyGroupSummary[]
}

export function StudyGroupManagement({ groups }: StudyGroupManagementProps) {
  const router = useRouter()
  const [newGroupName, setNewGroupName] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [isCreating, startCreating] = useTransition()
  const [isJoining, startJoining] = useTransition()

  const handleCreate = () => {
    startCreating(async () => {
      try {
        const result = await createStudyGroup(newGroupName)
        if (!result.success) {
          toast.error(result.message)
          return
        }
        setNewGroupName("")
        toast.success(result.message)
        router.refresh()
      } catch {
        toast.error("建立讀書房失敗。")
      }
    })
  }

  const handleJoin = () => {
    startJoining(async () => {
      try {
        const result = await joinStudyGroup(inviteCode)
        if (!result.success) {
          toast.error(result.message)
          return
        }
        setInviteCode("")
        toast.success(result.message)
        router.refresh()
      } catch {
        toast.error("加入讀書房失敗。")
      }
    })
  }

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success(`已複製邀請碼 ${code}`)
    } catch {
      toast.error("複製邀請碼失敗。")
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-border/70 bg-background/70 p-4">
          <div className="space-y-1">
            <Label htmlFor="study-group-name">建立讀書房</Label>
            <p className="text-sm text-muted-foreground">先建一個房間，再把邀請碼丟給朋友。</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id="study-group-name"
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              placeholder="例如：國考衝刺小隊"
            />
            <Button type="button" className="w-full sm:w-auto" disabled={isCreating} onClick={handleCreate}>
              {isCreating ? "建立中..." : "建立"}
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-border/70 bg-background/70 p-4">
          <div className="space-y-1">
            <Label htmlFor="invite-code">加入朋友的讀書房</Label>
            <p className="text-sm text-muted-foreground">輸入朋友給你的邀請碼，就能一起比賽本週讀書時間。</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id="invite-code"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
              placeholder="例如：AB12CD"
            />
            <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={isJoining} onClick={handleJoin}>
              {isJoining ? "加入中..." : "加入"}
            </Button>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/60 p-5">
          <p className="text-sm font-medium text-foreground">你還沒有任何讀書房</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            先建立一個，或跟朋友拿邀請碼加入。排行榜做完後，就能在裡面比誰讀比較久。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.id} className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{group.name}</p>
                    {group.isOwner ? <Badge variant="secondary">你建立的</Badge> : null}
                    <Badge variant="outline">{group.memberCount} 人</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">邀請碼：<span className="font-medium tracking-[0.2em] text-foreground">{group.invite_code}</span></p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" variant="outline" onClick={() => copyCode(group.invite_code)}>
                    <Copy className="h-4 w-4" />
                    複製邀請碼
                  </Button>
                  <Link
                    href={`/leaderboard?groupId=${group.id}`}
                    className={cn(buttonVariants({ variant: "default" }), "w-full sm:w-auto")}
                  >
                    <Trophy className="h-4 w-4" />
                    看排行榜
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
