import type { CurrentUserSummary } from "@/types"

type UserManagementProps = {
  currentUser: CurrentUserSummary
}

export function UserManagement({ currentUser }: UserManagementProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
        <p className="text-sm font-medium text-foreground">目前登入使用者</p>
        <p className="mt-2 text-lg font-semibold">{currentUser.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          正式登入系統已啟用，資料會直接綁定你的 Google 帳號，不再支援站內手動切換使用者。
        </p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
        <p className="text-sm font-medium text-foreground">資料權限</p>
        <ul className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
          <li>• Dashboard、學習紀錄、複習、單字與設定都改成登入後才能看。</li>
          <li>• 後端資料查詢會以目前登入的使用者身分過濾。</li>
          <li>• 如果之後要做多人共享，再另外設計邀請與權限模型。</li>
        </ul>
      </div>
    </div>
  )
}
