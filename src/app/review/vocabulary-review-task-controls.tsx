"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { reviewVocabularyTask } from "@/app/actions/review"
import { VocabularyPronunciationButton } from "@/components/vocabulary-pronunciation-button"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { VocabularyConfidenceLevel, VocabularyReviewRating } from "@/types"

const CONFIDENCE_OPTIONS: Array<{ value: VocabularyConfidenceLevel; label: string }> = [
  { value: 1, label: "完全沒把握" },
  { value: 2, label: "有點不確定" },
  { value: 3, label: "普通" },
  { value: 4, label: "蠻有把握" },
  { value: 5, label: "非常確定" },
]

type VocabularyReviewTaskControlsProps = {
  taskId: string
  word: string
  meaning: string
}

export function VocabularyReviewTaskControls({
  taskId,
  word,
  meaning,
}: VocabularyReviewTaskControlsProps) {
  const router = useRouter()
  const [confidence, setConfidence] = useState<VocabularyConfidenceLevel>(3)
  const [isRevealed, setIsRevealed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [startedAt] = useState<number>(Date.now())

  const handleRate = async (rating: VocabularyReviewRating) => {
    setIsSubmitting(true)

    try {
      const result = await reviewVocabularyTask(taskId, {
        rating,
        confidence,
        response_ms: Math.max(800, Date.now() - startedAt),
      })

      if (!result.success) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      router.refresh()
    } catch {
      toast.error("記錄英文單字複習失敗。")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-3">
      {isRevealed ? (
        <div className="space-y-3">
          <VocabularyPronunciationButton text={word} className="w-full sm:w-auto" />
          <div className="text-sm text-muted-foreground">
            中文意思：<span className="text-foreground">{meaning}</span>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">這次回想時的自信度</label>
            <Select
              value={confidence.toString()}
              onValueChange={(value) => setConfidence(Number(value ?? "3") as VocabularyConfidenceLevel)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {CONFIDENCE_OPTIONS.find((option) => option.value === confidence)?.label ?? "普通"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CONFIDENCE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button type="button" variant="destructive" disabled={isSubmitting} onClick={() => handleRate("hard")}>
              不熟
            </Button>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => handleRate("okay")}>
              普通
            </Button>
            <Button type="button" disabled={isSubmitting} onClick={() => handleRate("easy")}>
              熟悉
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">先在腦中回想意思，再翻卡評分。</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <VocabularyPronunciationButton text={word} className="w-full sm:w-auto" />
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRevealed(true)}
            >
              顯示答案並評分
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
