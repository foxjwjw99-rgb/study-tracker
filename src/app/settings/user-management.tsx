"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { createUser, deleteUser, switchCurrentUser } from "@/app/actions/user"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { CurrentUserSummary } from "@/types"

type UserManagementProps = {
  currentUser: CurrentUserSummary
  users: CurrentUserSummary[]
}

export function UserManagement({
  currentUser,
  users,
}: UserManagementProps) {
  const router = useRouter()
  const [selectedUserId, setSelectedUserId] = useState(currentUser.id)
  const [newUserName, setNewUserName] = useState("")
  const [isSwitching, startSwitching] = useTransition()
  const [isCreating, startCreating] = useTransition()
  const [isDeleting, startDeleting] = useTransition()
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null

  const handleSwitchUser = () => {
    startSwitching(async () => {
      try {
        const result = await switchCurrentUser(selectedUserId)

        if (!result.success) {
          toast.error(result.message)
          return
        }

        toast.success(result.message)
        router.refresh()
      } catch {
        toast.error("切換使用者失敗。")
      }
    })
  }

  const handleCreateUser = () => {
    startCreating(async () => {
      try {
        const result = await createUser(newUserName)

        if (!result.success) {
          toast.error(result.message)
          return
        }

        setNewUserName("")
        toast.success(result.message)
        router.refresh()
      } catch {
        toast.error("建立使用者失敗。")
      }
    })
  }

  const handleDeleteUser = () => {
    if (!selectedUser || selectedUser.id === currentUser.id) {
      toast.error("請先切換到別的使用者，再刪除這個人。")
      return
    }

    if (!window.confirm(`確定要刪除使用者「${selectedUser.name}」嗎？`)) {
      return
    }

    startDeleting(async () => {
      try {
        const result = await deleteUser(selectedUser.id)

        if (!result.success) {
          toast.error(result.message)
          return
        }

        toast.success(result.message)
        setSelectedUserId(currentUser.id)
        router.refresh()
      } catch {
        toast.error("刪除使用者失敗。")
      }
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <Label htmlFor="current-user">目前使用者</Label>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select
              value={selectedUserId}
              onValueChange={(value) => setSelectedUserId(value ?? currentUser.id)}
            >
              <SelectTrigger id="current-user" className="w-full min-w-0">
                <SelectValue>
                  {selectedUser?.name ?? "選擇使用者"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={isSwitching || selectedUserId === currentUser.id}
              onClick={handleSwitchUser}
            >
              {isSwitching ? "切換中..." : "切換"}
            </Button>
          </div>

          <Button
            type="button"
            variant="destructive"
            className="w-full sm:w-auto"
            disabled={isDeleting || selectedUserId === currentUser.id}
            onClick={handleDeleteUser}
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? "刪除中..." : "刪除選取的使用者"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          目前資料會綁定到你選取的使用者。刪除功能目前採保守規則：有資料或已加入讀書房的使用者不能直接刪除。
        </p>
      </div>

      <div className="space-y-3">
        <Label htmlFor="new-user-name">新增使用者</Label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="new-user-name"
            value={newUserName}
            onChange={(event) => setNewUserName(event.target.value)}
            placeholder="例如：國考衝刺班"
          />
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={isCreating}
            onClick={handleCreateUser}
          >
            {isCreating ? "建立中..." : "建立並切換"}
          </Button>
        </div>
      </div>
    </div>
  )
}
