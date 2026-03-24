import { getAnalyticsData } from "@/app/actions/analytics"
import { getVocabularyBank, getVocabularyWords } from "@/app/actions/vocabulary"
import { VocabularyInsights } from "@/components/vocabulary-insights"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VocabularyStudyClient } from "./vocabulary-study-client"

export default async function VocabularyPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>
}) {
  const params = (await searchParams) ?? {}
  const activeTab = params.tab === "insights" ? "insights" : "study"

  const [bank, words, analyticsData] = await Promise.all([
    getVocabularyBank(),
    getVocabularyWords(),
    getAnalyticsData(),
  ])

  return (
    <div className="max-w-6xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">英文單字</h1>
        <p className="text-muted-foreground">把背單字、複習趨勢與補弱分析收在同一頁，不用再跳來跳去。</p>
      </div>

      <Tabs defaultValue={activeTab} className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="study">單字卡背誦</TabsTrigger>
          <TabsTrigger value="insights">單字分析</TabsTrigger>
        </TabsList>

        <TabsContent value="study" className="space-y-6">
          <VocabularyStudyClient
            bank={bank}
            initialWords={words.map((word) => ({
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
            }))}
          />
        </TabsContent>

        <TabsContent value="insights">
          <VocabularyInsights data={analyticsData} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
