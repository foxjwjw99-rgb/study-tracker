import { getAnalyticsData } from "@/app/actions/analytics"
import { VocabularyInsights } from "@/components/vocabulary-insights"

export default async function VocabularyInsightsPage() {
  const data = await getAnalyticsData()

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold tracking-tight">單字分析</h1>
        <p className="text-muted-foreground">專門看英文單字的掌握狀況、複習趨勢與補弱清單。</p>
      </div>

      <VocabularyInsights data={data} showBackToVocabulary />
    </div>
  )
}
