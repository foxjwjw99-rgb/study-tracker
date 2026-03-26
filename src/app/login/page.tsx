import { redirect } from "next/navigation"
import { BookOpen, LockKeyhole, ShieldCheck } from "lucide-react"

import { auth } from "@/auth"
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const features = [
  {
    title: "你的學習資料只給你自己看",
    description: "Dashboard、練習紀錄、單字與複習資料都改成登入後才能存取。",
    icon: ShieldCheck,
  },
  {
    title: "Google 一鍵登入",
    description: "不用自己記一組新密碼，先用最穩的登入方式把站保護起來。",
    icon: LockKeyhole,
  },
  {
    title: "專心回到備考流程",
    description: "登入後會直接回到 dashboard，繼續看今天該讀什麼、該補什麼。",
    icon: BookOpen,
  },
] as const

export default async function LoginPage() {
  const session = await auth()

  if (session?.user) {
    redirect("/dashboard")
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
        <section className="surface-subtle space-y-6 rounded-3xl p-6 sm:p-8">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <ShieldCheck className="h-4 w-4" />
            Study Tracker 安全登入
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              先登入，再看你的 dashboard 與學習進度。
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              這次先把最重要的保護補上：改成 Google 登入後才能看個人資料與操作紀錄，避免外部路人直接看到你的備考資訊。
            </p>
          </div>

          <div className="grid gap-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-border/70 bg-background/85 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <feature.icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{feature.title}</p>
                    <p className="text-sm leading-6 text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center">
          <Card className="w-full rounded-3xl border-border/70 shadow-sm">
            <CardHeader className="space-y-3">
              <CardTitle className="text-2xl">登入學習追蹤器</CardTitle>
              <CardDescription>
                目前先開放 Google 登入。登入成功後，會直接帶你回到 dashboard。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <GoogleSignInButton />
              <p className="text-xs leading-6 text-muted-foreground">
                如果按下去沒有反應，通常是因為 Google OAuth 的環境變數或 redirect URI 還沒設定完成。
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
