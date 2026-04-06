import type { Metadata, Viewport } from "next"

import "./globals.css"
import "katex/dist/katex.min.css"
import { auth } from "@/auth"
import { AppShell } from "@/components/app-shell"
import { PwaInstallHint } from "@/components/pwa-install-hint"
import { Toaster } from "@/components/ui/sonner"
import { resolveCurrentUserContext, toCurrentUserSummary } from "@/lib/current-user"

export const metadata: Metadata = {
  title: "學習追蹤器",
  description: "追蹤你的學習時間、學習成果與複習任務。",
  applicationName: "學習追蹤器",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icon-192.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "學習追蹤器",
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: "#6D54E8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await auth()

  if (!session?.user) {
    return (
      <html lang="zh-Hant">
        <body>
          {children}
          <PwaInstallHint />
          <Toaster />
        </body>
      </html>
    )
  }

  const { user } = await resolveCurrentUserContext()

  return (
    <html lang="zh-Hant">
      <body>
        <AppShell currentUser={toCurrentUserSummary(user)}>
          {children}
        </AppShell>
        <PwaInstallHint />
        <Toaster />
      </body>
    </html>
  )
}
