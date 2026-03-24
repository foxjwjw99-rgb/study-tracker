"use client"

import { useEffect, useRef } from "react"

import { ensureCurrentUserCookie } from "@/app/actions/user"

export function CurrentUserCookieSync({ userId }: { userId: string }) {
  const hasSynced = useRef(false)

  useEffect(() => {
    if (hasSynced.current) {
      return
    }

    hasSynced.current = true
    void ensureCurrentUserCookie(userId)
  }, [userId])

  return null
}
