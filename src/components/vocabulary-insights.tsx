import Link from "next/link"

import {
  VocabularyStatusChart,
  VocabularyTrendChart,
} from "@/components/analytics-charts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type {
  AnalyticsData,
  VocabularyDifficultyItem,
  VocabularyStatusDistributionItem,
  VocabularySubjectProgressItem,
} from "@/types"

export function VocabularyInsights({
  data,
  showBackToVocabulary = false,
}: {
  data: AnalyticsData
  showBackToVocabulary?: boolean
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewCard title="單字總數" value={data.vocabularyOverview.totalWords} description="目前已匯入並可追蹤的英文單字" />
        <OverviewCard title="已學會單字" value={data.vocabularyOverview.masteredWords} description={`約占全部 ${data.vocabularyOverview.masteredRate}%`} />
        <OverviewCard title="今日已複習" value={data.vocabularyOverview.reviewedToday} description={`本週累計 ${data.vocabularyOverview.reviewedThisWeek} 次 review`} />
        <OverviewCard title="待複習數" value={data.vocabularyOverview.dueWords} description="下次複習日期已到期或今天到期" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>單字狀態分布</CardTitle>
            <CardDescription>看看 NEW / LEARNING / FAMILIAR 目前各有多少。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] sm:h-[320px]">
              <VocabularyStatusChart data={data.vocabularyStatusDistribution} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {data.vocabularyStatusDistribution.map((item: VocabularyStatusDistributionItem) => (
                <div key={item.key} className="rounded-xl border p-3">
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="mt-1 text-2xl font-semibold">{item.count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>單字複習趨勢（7 日）</CardTitle>
            <CardDescription>每天複習了幾個單字，以及完成了幾次 review。</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[320px] sm:h-[360px]">
              <VocabularyTrendChart data={data.vocabularyTrend} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>最難單字 Top 10</CardTitle>
            <CardDescription>只列要優先補弱的單字，手機上更好掃。</CardDescription>
          </CardHeader>
          <CardContent>
            {data.vocabularyDifficultWords.length === 0 ? (
              <div className="py-4 text-sm text-muted-foreground">目前還沒有足夠的單字資料可分析。</div>
            ) : (
              <div className="space-y-2">
                {data.vocabularyDifficultWords.map((word: VocabularyDifficultyItem, index: number) => (
                  <div key={word.id} className="flex items-start gap-3 rounded-xl border p-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold leading-tight">{word.word}</div>
                      <div className="mt-1 text-sm text-muted-foreground break-words">{word.meaning}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{word.subjectName}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showBackToVocabulary ? (
              <div className="mt-4">
                <Link href="/vocabulary" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                  回英文單字頁
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>科目別單字進度</CardTitle>
            <CardDescription>看每個英文分類目前累積多少字、待複習多少，以及熟悉率。</CardDescription>
          </CardHeader>
          <CardContent>
            {data.vocabularySubjectProgress.length === 0 ? (
              <div className="py-4 text-sm text-muted-foreground">目前還沒有科目別單字資料。</div>
            ) : (
              <div className="space-y-3">
                {data.vocabularySubjectProgress.map((item: VocabularySubjectProgressItem) => (
                  <div key={item.subjectId} className="rounded-xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{item.subjectName}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          總數 {item.totalWords} ・ 待複習 {item.dueWords} ・ 本週 review {item.reviewedThisWeek}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{item.familiarRate}%</div>
                        <div className="text-xs text-muted-foreground">熟悉率</div>
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${item.familiarRate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function OverviewCard({ title, value, description }: { title: string; value: string | number; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
