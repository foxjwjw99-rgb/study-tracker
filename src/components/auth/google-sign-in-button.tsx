"use client"

import { useState, useTransition } from "react"
import { Chrome } from "lucide-react"

import { Button } from "@/components/ui/button"

export function GoogleSignInButton() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="space-y-3">
      <Button
        type="button"
        className="w-full"
        size="lg"
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const { signIn } = await import("next-auth/react")
            const result = await signIn("google", { callbackUrl: "/dashboard", redirect: true })

            if (result?.error) {
              setError("Google 登入失敗，請稍後再試一次。")
            }
          })
        }}
        disabled={isPending}
      >
        <Chrome className="h-4 w-4" />
        {isPending ? "前往 Google 中..." : "使用 Google 登入"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
