import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '第二大腦 • Second Brain',
  description: '整合筆記、對話和記憶的個人知識系統',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body>
        {children}
      </body>
    </html>
  )
}
