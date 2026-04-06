"use client"

import { LogOut } from "lucide-react"
import { useTransition } from "react"

import { Button } from "@/components/ui/button"

export function SignOutButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        startTransition(async () => {
          const { signOut } = await import("next-auth/react")
          await signOut({ callbackUrl: "/login" })
        })
      }}
      disabled={isPending}
    >
      <LogOut className="h-4 w-4" />
      {isPending ? "登出中..." : "登出"}
    </Button>
  )
}
