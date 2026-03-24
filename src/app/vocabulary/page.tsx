import Link from "next/link"

import { getVocabularyBank, getVocabularyWords } from "@/app/actions/vocabulary"
import { VocabularyStudyClient } from "./vocabulary-study-client"

export default async function VocabularyPage() {
  const bank = await getVocabularyBank()
  const words = await getVocabularyWords()

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight">英文單字</h1>
          <p className="text-muted-foreground">使用單字卡背誦英文單字，並把熟悉度同步到複習待辦。</p>
        </div>
        <Link href="/vocabulary/insights" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          看單字分析
        </Link>
      </div>

      <VocabularyStudyClient bank={bank} initialWords={words.map((word) => ({
        id: word.id,
        word: word.word,
        part_of_speech: (word as typeof word & { part_of_speech?: string | null }).part_of_speech ?? null,
        meaning: word.meaning,
        example_sentence: word.example_sentence,
        example_sentence_translation:
          (word as typeof word & { example_sentence_translation?: string | null }).example_sentence_translation ?? null,
        status: word.status as "NEW" | "LEARNING" | "FAMILIAR",
        subject_id: word.subject_id,
        subject_name: word.subject.name,
        next_review_date: word.next_review_date,
        last_reviewed_at: word.last_reviewed_at,
        ease_factor: word.ease_factor,
        interval_days: word.interval_days,
        review_count: word.review_count,
        lapse_count: word.lapse_count,
        average_response_ms: word.average_response_ms,
        average_confidence: word.average_confidence,
      }))} />
    </div>
  )
}
