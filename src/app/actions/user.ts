"use server"

import type { ActionResult } from "@/types"

const AUTH_MANAGED_MESSAGE = "已改用 Google 登入管理帳號，不再支援站內切換或建立使用者。"

export async function ensureCurrentUserCookie(_userId: string) {
  return
}

export async function switchCurrentUser(_userId: string): Promise<ActionResult> {
  return {
    success: false,
    message: AUTH_MANAGED_MESSAGE,
  }
}

export async function createUser(_name: string): Promise<ActionResult> {
  return {
    success: false,
    message: AUTH_MANAGED_MESSAGE,
  }
}

export async function deleteUser(_userId: string): Promise<ActionResult> {
  return {
    success: false,
    message: AUTH_MANAGED_MESSAGE,
  }
}
