"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, CircleHelp, Clock3, PlayCircle, RotateCcw, Target } from "lucide-react"
import { toast } from "sonner"

import {
  getPracticeQuestions,
  submitPracticeQuestionSession,
} from "@/app/actions/practice-log"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MathText } from "@/components/math-text"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  PracticeQuestionAnswerInput,
  PracticeQuestionBankSummary,
  PracticeQuestionItem,
  PracticeQuestionSessionResult,
} from "@/types"

type QuestionPracticeProps = {
  questionBank: PracticeQuestionBankSummary[]
}

type SessionState = {
  questions: PracticeQuestionItem[]
  startedAt: number
  currentIndex: number
  selectedAnswer: number | null
  answers: PracticeQuestionAnswerInput[]
  isAnswerChecked: boolean
}

const QUESTION_COUNT_OPTIONS = [5, 10, 20] as const

export function QuestionPractice({ questionBank }: QuestionPracticeProps) {
  const router = useRouter()
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    questionBank[0]?.subject_id ?? ""
  )
  const [requestedCount, setRequestedCount] = useState<string>("10")
  const [session, setSession] = useState<SessionState | null>(null)
  const [result, setResult] = useState<PracticeQuestionSessionResult | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedSubject = useMemo(
    () => questionBank.find((item) => item.subject_id === selectedSubjectId) ?? null,
    [questionBank, selectedSubjectId]
  )

  const questionCountOptions = useMemo(() => {
    const availableCount = selectedSubject?.question_count ?? 0
    const baseOptions: number[] = QUESTION_COUNT_OPTIONS.filter(
      (count) => count < availableCount
    )

    if (availableCount > 0) {
      baseOptions.push(availableCount)
    }

    return [...new Set(baseOptions)].sort((a, b) => a - b)
  }, [selectedSubject])

  const currentQuestion = session ? session.questions[session.currentIndex] : null
  const currentAnswer = currentQuestion
    ? session?.answers.find((answer) => answer.question_id === currentQuestion.id) ?? null
    : null
  const selectedAnswerValue = session?.selectedAnswer ?? currentAnswer?.selected_answer ?? null
  const isLastQuestion = session ? session.currentIndex === session.questions.length - 1 : false
  const correctCount = result ? result.correctQuestions : 0
  const answeredCount = session?.answers.length ?? 0
  const estimatedMinutes = useMemo(() => {
    if (!selectedSubject) {
      return null
    }

    const count = requestedCount === "all"
      ? selectedSubject.question_count
      : Number.parseInt(requestedCount, 10)

    if (!Number.isFinite(count) || count <= 0) {
      return null
    }

    return Math.max(5, count * 1.5)
  }, [requestedCount, selectedSubject])

  useEffect(() => {
    if (!selectedSubject) {
      return
    }

    const nextValue = requestedCount === "all"
      ? "all"
      : questionCountOptions.some((count) => count.toString() === requestedCount)
        ? requestedCount
        : questionCountOptions[questionCountOptions.length - 1]?.toString() ?? "all"

    if (nextValue !== requestedCount) {
      setRequestedCount(nextValue)
    }
  }, [questionCountOptions, requestedCount, selectedSubject])

  const startPractice = async () => {
    if (!selectedSubjectId) {
      toast.error("請先選擇要練習的科目。")
      return
    }

    setIsStarting(true)

    try {
      const count = requestedCount === "all"
        ? selectedSubject?.question_count ?? 0
        : Number.parseInt(requestedCount, 10)
      const questions = await getPracticeQuestions(selectedSubjectId, count)

      if (questions.length === 0) {
        toast.error("這個科目目前沒有可用題目。")
        return
      }

      setResult(null)
      setSession({
        questions,
        startedAt: Date.now(),
        currentIndex: 0,
        selectedAnswer: null,
        answers: [],
        isAnswerChecked: false,
      })
    } catch {
      toast.error("載入題目失敗。")
    } finally {
      setIsStarting(false)
    }
  }

  const checkAnswer = () => {
    if (!session || !currentQuestion || selectedAnswerValue === null) {
      toast.error("請先選擇答案。")
      return
    }

    const nextAnswers = session.answers.filter(
      (answer) => answer.question_id !== currentQuestion.id
    )
    nextAnswers.push({
      question_id: currentQuestion.id,
      selected_answer: selectedAnswerValue,
    })

    setSession({
      ...session,
      answers: nextAnswers,
      isAnswerChecked: true,
    })
  }

  const moveToNextQuestion = async () => {
    if (!session || !currentQuestion) {
      return
    }

    if (!session.isAnswerChecked) {
      toast.error("請先確認本題答案。")
      return
    }

    if (isLastQuestion) {
      setIsSubmitting(true)

      try {
        const durationSeconds = Math.max(
          1,
          Math.round((Date.now() - session.startedAt) / 1000)
        )
        const submissionResult = await submitPracticeQuestionSession({
          subject_id: currentQuestion.subject_id,
          duration_seconds: durationSeconds,
          answers: session.answers,
        })

        if (!submissionResult.success) {
          toast.error(submissionResult.message)
          return
        }

        setResult(submissionResult)
        setSession(null)
        toast.success(submissionResult.message)
        router.refresh()
      } catch {
        toast.error("儲存題庫練習失敗。")
      } finally {
        setIsSubmitting(false)
      }

      return
    }

    const nextQuestion = session.questions[session.currentIndex + 1]
    const savedNextAnswer =
      session.answers.find((answer) => answer.question_id === nextQuestion.id) ?? null

    setSession({
      ...session,
      currentIndex: session.currentIndex + 1,
      selectedAnswer: savedNextAnswer?.selected_answer ?? null,
      isAnswerChecked: false,
    })
  }

  const restartPractice = () => {
    setSession(null)
    setResult(null)
  }

  if (questionBank.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>題庫練習</CardTitle>
          <CardDescription>先匯入題目，這裡才能開始作答。</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {!session ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-4 w-4" />
              題庫練習
            </CardTitle>
            <CardDescription>從自己的題目與讀書房共享題目中抽題作答，完成後會自動寫入個人練習紀錄。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">科目</label>
                <Select
                  value={selectedSubjectId}
                  onValueChange={(value) => setSelectedSubjectId(value ?? questionBank[0]?.subject_id ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {selectedSubject
                        ? `${selectedSubject.subject_name} (${selectedSubject.question_count} 題)`
                        : "選擇科目"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {questionBank.map((item) => (
                      <SelectItem key={item.subject_id} value={item.subject_id}>
                        {item.subject_name} ({item.question_count} 題)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">題數</label>
                <Select
                  value={requestedCount}
                  onValueChange={(value) => setRequestedCount(value ?? "10")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {requestedCount === "all" ? "全部題目" : `${requestedCount} 題`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {questionCountOptions.map((count) => (
                      <SelectItem key={count} value={count.toString()}>
                        {count} 題
                      </SelectItem>
                    ))}
                    <SelectItem value="all">全部題目</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedSubject ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <div className="text-muted-foreground">目前題庫</div>
                  <div className="mt-1 font-medium text-foreground">{selectedSubject.subject_name}</div>
                  <div className="mt-1 text-muted-foreground">共 {selectedSubject.question_count} 題</div>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <div className="text-muted-foreground">練習模式</div>
                  <div className="mt-1 font-medium text-foreground">單科隨機抽題</div>
                  <div className="mt-1 text-muted-foreground">依照目前科目題庫隨機出題</div>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <div className="text-muted-foreground">預估時間</div>
                  <div className="mt-1 font-medium text-foreground">
                    {estimatedMinutes ? `約 ${Math.round(estimatedMinutes)} 分鐘` : "未估算"}
                  </div>
                  <div className="mt-1 text-muted-foreground">用來安排一個完整專注 session</div>
                </div>
              </div>
            ) : null}

            {result ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                上次練習結果：{result.correctQuestions}/{result.totalQuestions} 題正確，
                新增 {result.wrongQuestionCount} 筆錯題追蹤。
              </div>
            ) : null}

            <Button type="button" className="w-full sm:w-auto" disabled={isStarting} onClick={startPractice}>
              {isStarting ? "載入題目中..." : "開始題庫練習"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {session && currentQuestion ? (
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                第 {session.currentIndex + 1} / {session.questions.length} 題
              </Badge>
              <Badge variant="outline">{currentQuestion.subject_name}</Badge>
              <Badge variant="outline">{currentQuestion.topic}</Badge>
            </div>
            <div className="space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${((session.currentIndex + 1) / session.questions.length) * 100}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Target className="h-3.5 w-3.5" />
                  已確認 {answeredCount} / {session.questions.length} 題
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  做完會自動寫入練習紀錄
                </span>
              </div>
            </div>
            {currentQuestion.image_url && (
              <div>
                <img
                  src={currentQuestion.image_url}
                  alt="題目圖片"
                  className="max-w-full rounded-lg border"
                />
              </div>
            )}
            <CardTitle className="text-lg leading-7">
              <MathText text={currentQuestion.question} className="leading-8" />
            </CardTitle>
            <CardDescription>先做完一輪，再回頭看哪個單元最需要補強。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswerValue === index
                const isCorrect = currentQuestion.answer === index
                const isWrongSelection =
                  session.isAnswerChecked && isSelected && !isCorrect

                return (
                  <button
                    key={`${currentQuestion.id}-${index}`}
                    type="button"
                    className={[
                      "w-full rounded-lg border px-4 py-3 text-left transition-colors",
                      isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                      session.isAnswerChecked && isCorrect ? "border-green-500 bg-green-50" : "",
                      isWrongSelection ? "border-destructive bg-destructive/5" : "",
                    ].join(" ")}
                    disabled={session.isAnswerChecked}
                    onClick={() => setSession({ ...session, selectedAnswer: index })}
                  >
                    <span className="font-medium">{String.fromCharCode(65 + index)}.</span>{" "}
                    <MathText text={option} className="inline break-words" />
                  </button>
                )
              })}
            </div>

            {session.isAnswerChecked ? (
              <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
                <div className="flex items-start gap-2">
                  {selectedAnswerValue === currentQuestion.answer ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                  ) : (
                    <CircleHelp className="mt-0.5 h-4 w-4 text-amber-600" />
                  )}
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">
                      {selectedAnswerValue === currentQuestion.answer ? "答對了" : "這題答錯了"}
                    </p>
                    <p className="text-muted-foreground">
                      正確答案：{String.fromCharCode(65 + currentQuestion.answer)}.{" "}
                      <MathText
                        text={currentQuestion.options[currentQuestion.answer]}
                        className="inline"
                      />
                    </p>
                    {currentQuestion.explanation ? (
                      <p className="break-words text-muted-foreground">
                        解析：<MathText text={currentQuestion.explanation} className="inline" />
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" onClick={restartPractice}>
                <RotateCcw className="mr-2 h-4 w-4" />
                重新選題
              </Button>
              {!session.isAnswerChecked ? (
                <Button type="button" className="w-full sm:w-auto" onClick={checkAnswer}>
                  確認答案
                </Button>
              ) : (
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={isSubmitting}
                  onClick={moveToNextQuestion}
                >
                  {isSubmitting
                    ? "儲存中..."
                    : isLastQuestion
                      ? "完成並儲存結果"
                      : "下一題"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!session && result ? (
        <Card>
          <CardHeader>
            <CardTitle>本次練習結果</CardTitle>
            <CardDescription>結果已同步寫入最近練習紀錄。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">正確題數</div>
              <div className="mt-1 text-2xl font-semibold">{correctCount}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">總題數</div>
              <div className="mt-1 text-2xl font-semibold">{result.totalQuestions}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">新增錯題</div>
              <div className="mt-1 text-2xl font-semibold">{result.wrongQuestionCount}</div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
