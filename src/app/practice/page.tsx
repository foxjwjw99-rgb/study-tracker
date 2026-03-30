import { getSubjects } from "@/app/actions/subject"
import {
  addWrongQuestion,
  deletePracticeLog,
  getPracticeLogs,
  getPracticeQuestionBank,
} from "@/app/actions/practice-log"
import { PracticeLogForm } from "./practice-log-form"
import { QuestionPractice } from "./question-practice"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { PracticeLogListItem } from "@/types"

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; topic?: string }>
}) {
  const { subject: initialSubjectId, topic: initialTopic } = await searchParams
  const subjects = await getSubjects()
  const logs = await getPracticeLogs()
  const questionBank = await getPracticeQuestionBank()
  const hasAnyPracticeEntryPoint = subjects.length > 0 || questionBank.length > 0

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">練習歷程</h1>
        <p className="text-muted-foreground">在此記錄你的測驗結果與正確題數。</p>
      </div>

      {!hasAnyPracticeEntryPoint ? (
        <Card>
          <CardContent className="p-6 text-center">
            <h3 className="font-semibold text-lg mb-2">歡迎！</h3>
            <p className="text-muted-foreground mb-4">在開始記錄練習之前，請先在「設定」中新增科目，或加入讀書房並取得共享題庫。</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="question-bank" className="space-y-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="question-bank">題庫練習</TabsTrigger>
            <TabsTrigger value="manual-log">手動紀錄</TabsTrigger>
          </TabsList>

          <TabsContent value="question-bank" className="space-y-4">
            {questionBank.length > 0 ? (
              <QuestionPractice
                questionBank={questionBank}
                initialSubjectId={initialSubjectId}
                initialTopic={initialTopic}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>題庫練習</CardTitle>
                  <CardDescription>目前還沒有可作答的匯入題目。</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    先到「匯入題目」上傳 JSON 題庫，或請讀書房成員分享題目，之後就可以在這裡直接練習。
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="manual-log">
            {subjects.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>手動新增練習紀錄</CardTitle>
                  <CardDescription>如果這次不是從匯入題庫作答，也可以直接手動記錄。</CardDescription>
                </CardHeader>
                <CardContent>
                  <PracticeLogForm subjects={subjects} />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>手動新增練習紀錄</CardTitle>
                  <CardDescription>要手動記錄練習，仍需要先建立至少一個自己的科目。</CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Card>
        <CardHeader>
          <CardTitle>最近練習紀錄</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <div className="grid grid-cols-1 divide-y">
              {logs.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">目前尚無練習紀錄。</div>
              ) : (
                logs.map((log: PracticeLogListItem) => {
                  const accuracy = Math.round((log.correct_questions / log.total_questions) * 100)
                  return (
                    <div key={log.id} className="p-4 flex flex-col sm:flex-row justify-between gap-4">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 font-semibold">
                          {log.subject.name} - {log.topic}
                          <span className={`text-xs px-2 py-0.5 rounded-full inline-block ${accuracy >= 80 ? "bg-green-100 text-green-700" : accuracy >= 60 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                            {accuracy}% ({log.correct_questions}/{log.total_questions})
                          </span>
                        </div>
                        <div className="break-words text-sm text-muted-foreground">
                          {format(log.practice_date, "PP")} • {log.duration_minutes} 分鐘
                          {log.source && ` • 來源: ${log.source}`}
                          {log.error_type && ` • 主要錯誤: ${log.error_type}`}
                        </div>
                        {log.notes && <div className="rounded-md bg-muted p-2 text-sm break-words">{log.notes}</div>}

                        {log.total_questions > log.correct_questions && log.source !== "共享題庫" && log.source !== "匯入題庫" && (
                          <form action={async () => {
                            "use server"
                            await addWrongQuestion({
                              subject_id: log.subject_id,
                              topic: log.topic,
                              source: log.source || undefined,
                              error_reason: log.error_type || undefined,
                              first_wrong_date: new Date(),
                              notes: `來自練習紀錄：${log.notes || ""}`,
                            })
                          }} className="w-full sm:w-auto">
                            <Button variant="outline" size="sm" type="submit" className="w-full sm:w-auto">追蹤錯題</Button>
                          </form>
                        )}
                      </div>

                      <form action={async () => {
                        "use server"
                        await deletePracticeLog(log.id)
                      }} className="flex-shrink-0">
                        <button className="w-full text-left text-sm text-destructive hover:underline sm:w-auto sm:text-right">刪除</button>
                      </form>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
