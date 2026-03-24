import { getAnalyticsData } from "@/app/actions/analytics"
import { AccuracyChart } from "@/components/analytics-charts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { HighEffortLowReturnItem, SubjectStatsItem } from "@/types"

export default async function AnalyticsPage() {
  const data = await getAnalyticsData()

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold tracking-tight">數據分析</h1>
        <p className="text-muted-foreground">專注看你的讀書投入、刷題表現與整體學習效率。</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>科目表現</CardTitle>
            <CardDescription>各科目的整體正確率</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 md:hidden">
              {data.subjectStats.map((subject: SubjectStatsItem) => (
                <div key={subject.id} className="rounded-md border p-3">
                  <div className="font-medium">{subject.name}</div>
                  <div className="mt-2 text-sm text-muted-foreground">練習總題數：{subject.totalQuestions}</div>
                  <div className="text-sm text-muted-foreground">
                    正確率：{subject.accuracy !== null ? `${subject.accuracy}%` : "-"}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>科目</TableHead>
                    <TableHead className="text-right">練習總題數</TableHead>
                    <TableHead className="text-right">正確率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.subjectStats.map((subject: SubjectStatsItem) => (
                    <TableRow key={subject.id}>
                      <TableCell className="font-medium">{subject.name}</TableCell>
                      <TableCell className="text-right">{subject.totalQuestions}</TableCell>
                      <TableCell className="text-right">
                        {subject.accuracy !== null ? `${subject.accuracy}%` : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>高投入 / 低回報 單元</CardTitle>
            <CardDescription>投入時間較長但正確率低於平均的單元。</CardDescription>
          </CardHeader>
          <CardContent>
            {data.highEffortLowReturn.length === 0 ? (
              <div className="py-4 text-sm text-muted-foreground">目前沒有異常單元。學習效率很棒！</div>
            ) : (
              <div className="space-y-4">
                {data.highEffortLowReturn.map((item: HighEffortLowReturnItem, idx: number) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">
                        {item.subject} - {item.topic}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">時長：{item.timeSpent} 分鐘 (高於平均)</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-red-600">{item.accuracy}%</div>
                      <div className="text-xs text-muted-foreground">平均：{item.avgAccuracy}%</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>正確率趨勢（7 日）</CardTitle>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[280px] sm:h-[350px]">
              <AccuracyChart data={data.accuracyTrend} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
