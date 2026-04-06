import type { Metadata } from "next"

import { MathGraph } from "@/components/math-graph"

export const metadata: Metadata = {
  title: "函數圖形 | 學習追蹤器",
}

export default function MathGraphPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">函數圖形</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          輸入數學函數，即時繪製圖形。支援同時顯示最多 5 條曲線。
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <MathGraph />
      </div>
    </div>
  )
}
