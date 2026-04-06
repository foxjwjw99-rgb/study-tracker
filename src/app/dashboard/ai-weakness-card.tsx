"use client"

import { useState } from "react"
import { Loader2, Brain } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { generateAIWeaknessDiagnosis } from "@/app/actions/ai-generation"

export function AIWeaknessCard() {
  const [diagnosis, setDiagnosis] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const result = await generateAIWeaknessDiagnosis()
      if (result.success && result.diagnosis) {
        setDiagnosis(result.diagnosis)
      } else {
        setError(result.error ?? "診斷失敗，請稍後再試。")
      }
    } catch {
      setError("發生錯誤，請稍後再試。")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-4 w-4" />
          AI 弱點診斷
        </CardTitle>
        <CardDescription>整合所有科目的錯題與練習資料，找出真正需要補強的地方。</CardDescription>
      </CardHeader>
      <CardContent>
        {!diagnosis && !loading && !error && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              AI 將分析你的錯題記錄與近30天的練習表現，給出具體的跨科目弱點診斷。
            </p>
            <Button onClick={handleGenerate} size="sm">
              立即分析
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            AI 正在分析你的學習資料...
          </div>
        )}

        {error && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={handleGenerate} variant="outline" size="sm">
              重新分析
            </Button>
          </div>
        )}

        {diagnosis && !loading && (
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{diagnosis}</p>
            <Button onClick={handleGenerate} variant="outline" size="sm">
              重新分析
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
