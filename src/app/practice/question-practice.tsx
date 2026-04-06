"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, CheckCircle2, CircleHelp, Clock3, PlayCircle, RotateCcw, Target, X } from "lucide-react"
import { toast } from "sonner"

import {
  getPracticeQuestions,
  getPracticeQuestionsWeakFirst,
  getPracticeQuestionUnits,
  submitPracticeQuestionSession,
} from "@/app/actions/practice-log"
import { addToWrongBook, removeFromWrongBook } from "@/app/actions/wrong-questions"
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
  initialSubjectId?: string
}

type SessionState = {
  questions: PracticeQuestionItem[]
  startedAt: number
  currentIndex: number
  selectedAnswer: number | null   // MC only
  textAnswer: string              // FIB only
  userCorrectOverride: boolean | null  // FIB: null = not yet checked, true/false = result
  answers: PracticeQuestionAnswerInput[]
  isAnswerChecked: boolean
}

type PracticeCompletionSummary = {
  subjectId: string
  subjectName: string
  accuracy: number
  strongestTopics: Array<{ topic: string; count: number }>
  weakTopics: Array<{ topic: string; count: number }>
}

const QUESTION_COUNT_OPTIONS = [5, 10, 20] as const

export function QuestionPractice({ questionBank, initialSubjectId }: QuestionPracticeProps) {
  const router = useRouter()
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    initialSubjectId ?? questionBank[0]?.subject_id ?? ""
  )
  const [selectedUnitId, setSelectedUnitId] = useState("")
  const [units, setUnits] = useState<{ unitId: string; unitName: string; count: number }[]>([])
  const [requestedCount, setRequestedCount] = useState<string>("10")
  const [quizMode, setQuizMode] = useState<"random" | "weak_first">("random")
  const [session, setSession] = useState<SessionState | null>(null)
  const [result, setResult] = useState<PracticeQuestionSessionResult | null>(null)
  const [completionSummary, setCompletionSummary] = useState<PracticeCompletionSummary | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Track per-question wrong-book states after submission (question_id -> wrongQuestionId | null | "removed")
  const [wqStates, setWqStates] = useState<Record<string, string | null | "removed">>({})

  const selectedSubject = useMemo(
    () => questionBank.find((item) => item.subject_id === selectedSubjectId) ?? null,
    [questionBank, selectedSubjectId]
  )

  useEffect(() => {
    if (!selectedSubjectId) return
    setSelectedUnitId("")
    setUnits([])
    getPracticeQuestionUnits(selectedSubjectId).then(setUnits).catch(() => {})
  }, [selectedSubjectId])

  const effectiveQuestionCount = useMemo(() => {
    if (selectedUnitId) {
      return units.find((u) => u.unitId === selectedUnitId)?.count ?? 0
    }
    return selectedSubject?.question_count ?? 0
  }, [selectedUnitId, units, selectedSubject])

  const questionCountOptions = useMemo(() => {
    const availableCount = effectiveQuestionCount
    const baseOptions: number[] = QUESTION_COUNT_OPTIONS.filter(
      (count) => count < availableCount
    )

    if (availableCount > 0) {
      baseOptions.push(availableCount)
    }

    return [...new Set(baseOptions)].sort((a, b) => a - b)
  }, [effectiveQuestionCount])

  const currentQuestion = session ? session.questions[session.currentIndex] : null
  const previousQuestion = session && session.currentIndex > 0 ? session.questions[session.currentIndex - 1] : null
  const showGroupContext = Boolean(
    currentQuestion?.group_id &&
    currentQuestion.group_context &&
    currentQuestion.group_id !== previousQuestion?.group_id
  )
  const currentAnswer = currentQuestion
    ? session?.answers.find((answer) => answer.question_id === currentQuestion.id) ?? null
    : null
  const selectedAnswerValue = session?.selectedAnswer ?? currentAnswer?.selected_answer ?? null
  const isFibQuestion = currentQuestion?.question_type === "fill_in_blank"
  const isLastQuestion = session ? session.currentIndex === session.questions.length - 1 : false
  const correctCount = result ? result.correctQuestions : 0
  const answeredCount = session?.answers.length ?? 0
  const estimatedMinutes = useMemo(() => {
    if (!selectedSubject) {
      return null
    }

    const count = requestedCount === "all"
      ? effectiveQuestionCount
      : Number.parseInt(requestedCount, 10)

    if (!Number.isFinite(count) || count <= 0) {
      return null
    }

    return Math.max(5, count * 1.5)
  }, [effectiveQuestionCount, requestedCount, selectedSubject])

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
      const questions = quizMode === "weak_first"
        ? await getPracticeQuestionsWeakFirst(selectedSubjectId, count)
        : await getPracticeQuestions(selectedSubjectId, count, selectedUnitId || undefined)

      if (questions.length === 0) {
        toast.error("這個科目目前沒有可用題目。")
        return
      }

      setResult(null)
      setCompletionSummary(null)
      setSession({
        questions,
        startedAt: Date.now(),
        currentIndex: 0,
        selectedAnswer: null,
        textAnswer: "",
        userCorrectOverride: null,
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
    if (!session || !currentQuestion) return

    if (isFibQuestion) {
      if (!session.textAnswer.trim()) {
        toast.error("請先輸入答案。")
        return
      }
      const autoCorrect = checkFibAnswer(session.textAnswer, currentQuestion.text_answer ?? "")
      const nextAnswers = session.answers.filter((a) => a.question_id !== currentQuestion.id)
      nextAnswers.push({
        question_id: currentQuestion.id,
        selected_answer: null,
        text_answer: session.textAnswer,
        is_user_correct: autoCorrect,
      })
      setSession({
        ...session,
        userCorrectOverride: autoCorrect,
        answers: nextAnswers,
        isAnswerChecked: true,
      })
      return
    }

    if (selectedAnswerValue === null) {
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

  const overrideFibResult = (isCorrect: boolean) => {
    if (!session || !currentQuestion) return
    const nextAnswers = session.answers.filter((a) => a.question_id !== currentQuestion.id)
    nextAnswers.push({
      question_id: currentQuestion.id,
      selected_answer: null,
      text_answer: session.textAnswer,
      is_user_correct: isCorrect,
    })
    setSession({ ...session, userCorrectOverride: isCorrect, answers: nextAnswers })
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

        setCompletionSummary(buildCompletionSummary(session.questions, session.answers, submissionResult))
        setResult(submissionResult)
        // Initialize wqStates from returned questionResults
        if (submissionResult.questionResults) {
          const initial: Record<string, string | null | "removed"> = {}
          for (const qr of submissionResult.questionResults) {
            initial[qr.question_id] = qr.wrongQuestionId
          }
          setWqStates(initial)
        }
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
      textAnswer: savedNextAnswer?.text_answer ?? "",
      userCorrectOverride: savedNextAnswer?.is_user_correct ?? null,
      isAnswerChecked: false,
    })
  }

  const restartPractice = () => {
    setSession(null)
    setResult(null)
    setCompletionSummary(null)
    setWqStates({})
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">出題模式</label>
                <Select value={quizMode} onValueChange={(v) => setQuizMode(v as "random" | "weak_first")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {quizMode === "weak_first" ? "弱點優先" : "隨機抽題"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">隨機抽題</SelectItem>
                    <SelectItem value="weak_first">弱點優先</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                <label className="text-sm font-medium">單元</label>
                <Select
                  value={selectedUnitId || "__all__"}
                  onValueChange={(value) => setSelectedUnitId(value === "__all__" ? "" : (value ?? ""))}
                  disabled={units.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {selectedUnitId
                        ? `${units.find((u) => u.unitId === selectedUnitId)?.unitName ?? selectedUnitId} (${units.find((u) => u.unitId === selectedUnitId)?.count ?? 0} 題)`
                        : "全部單元"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">全部單元</SelectItem>
                    {units.map((u) => (
                      <SelectItem key={u.unitId} value={u.unitId}>
                        {u.unitName} ({u.count} 題)
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
                  <div className="mt-1 font-medium text-foreground">
                    {selectedSubject.subject_name}{selectedUnitId ? ` · ${units.find((u) => u.unitId === selectedUnitId)?.unitName ?? selectedUnitId}` : ""}
                  </div>
                  <div className="mt-1 text-muted-foreground">共 {effectiveQuestionCount} 題</div>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <div className="text-muted-foreground">練習模式</div>
                  <div className="mt-1 font-medium text-foreground">
                    {quizMode === "weak_first" ? "弱點優先" : "隨機抽題"}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {quizMode === "weak_first"
                      ? "優先出現有錯題紀錄的單元"
                      : "依照目前科目題庫隨機出題"}
                  </div>
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
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${((session.currentIndex + 1) / session.questions.length) * 100}%` }}
                  />
                </div>
                <span className="flex-shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                  {session.currentIndex + 1} / {session.questions.length}
                </span>
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
            {showGroupContext ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm dark:border-sky-900/50 dark:bg-sky-950/20">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
                  {currentQuestion.group_title || "共同題幹"}
                </p>
                <div className="mt-2 leading-7 text-foreground">
                  <MathText text={currentQuestion.group_context ?? ""} className="leading-7" />
                </div>
              </div>
            ) : null}
            {currentQuestion.image_url && (
              <div>
                <Image
                  src={currentQuestion.image_url}
                  alt="題目圖片"
                  width={960}
                  height={540}
                  unoptimized
                  className="max-w-full rounded-lg border"
                />
              </div>
            )}
            <CardTitle className="text-xl font-medium leading-8">
              <MathText text={currentQuestion.question} className="leading-8" />
            </CardTitle>
            <CardDescription>先做完一輪，再回頭看哪個單元最需要補強。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isFibQuestion ? (
              /* ── Fill-in-the-blank UI ── */
              <div className="space-y-3">
                <input
                  type="text"
                  className="w-full rounded-xl border-2 border-border bg-background px-4 py-4 text-base outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                  placeholder="輸入你的答案，按 Enter 確認…"
                  value={session.textAnswer}
                  disabled={session.isAnswerChecked}
                  onChange={(e) => setSession({ ...session, textAnswer: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && !session.isAnswerChecked && checkAnswer()}
                />
                {session.isAnswerChecked && (
                  <div className={[
                    "rounded-xl border-2 p-4",
                    session.userCorrectOverride
                      ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                      : "border-amber-400 bg-amber-50 dark:bg-amber-950/30",
                  ].join(" ")}>
                    <div className="flex items-start gap-3">
                      <div className={[
                        "mt-0.5 rounded-full p-1 flex-shrink-0",
                        session.userCorrectOverride ? "bg-green-500" : "bg-amber-500",
                      ].join(" ")}>
                        {session.userCorrectOverride ? (
                          <Check className="h-3.5 w-3.5 text-white" />
                        ) : (
                          <CircleHelp className="h-3.5 w-3.5 text-white" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1.5 text-sm">
                        <p className={[
                          "font-semibold",
                          session.userCorrectOverride
                            ? "text-green-700 dark:text-green-400"
                            : "text-amber-700 dark:text-amber-400",
                        ].join(" ")}>
                          {session.userCorrectOverride ? "答對了！" : "系統判斷為答錯"}
                        </p>
                        <p className="text-muted-foreground">
                          參考答案：
                          <span className="font-medium text-foreground">
                            {currentQuestion.text_answer?.replace(/\|/g, " / ") ?? ""}
                          </span>
                        </p>
                        {currentQuestion.explanation ? (
                          <p className="break-words text-muted-foreground">
                            解析：<MathText text={currentQuestion.explanation} className="inline" />
                          </p>
                        ) : null}
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            className={[
                              "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                              session.userCorrectOverride
                                ? "border-green-500 bg-green-50 text-green-700"
                                : "border-border text-muted-foreground hover:border-green-400 hover:text-green-700",
                            ].join(" ")}
                            onClick={() => overrideFibResult(true)}
                          >
                            ✓ 標記為答對
                          </button>
                          <button
                            type="button"
                            className={[
                              "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                              !session.userCorrectOverride
                                ? "border-destructive bg-destructive/5 text-destructive"
                                : "border-border text-muted-foreground hover:border-destructive/60 hover:text-destructive",
                            ].join(" ")}
                            onClick={() => overrideFibResult(false)}
                          >
                            ✗ 標記為答錯
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ── Multiple-choice UI ── */
              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = selectedAnswerValue === index
                  const isCorrect = currentQuestion.answer === index
                  const isWrongSelection =
                    session.isAnswerChecked && isSelected && !isCorrect
                  const isUnrelatedAfterCheck =
                    session.isAnswerChecked && !isCorrect && !isWrongSelection

                  return (
                    <button
                      key={`${currentQuestion.id}-${index}`}
                      type="button"
                      className={[
                        "w-full rounded-xl border-2 px-4 py-4 text-left transition-all flex items-center gap-3",
                        !session.isAnswerChecked && isSelected
                          ? "border-primary bg-primary/10"
                          : "",
                        !session.isAnswerChecked && !isSelected
                          ? "border-border bg-background hover:bg-muted/50 hover:border-muted-foreground/40"
                          : "",
                        session.isAnswerChecked && isCorrect
                          ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                          : "",
                        session.isAnswerChecked && isWrongSelection
                          ? "border-destructive bg-destructive/10"
                          : "",
                        isUnrelatedAfterCheck
                          ? "border-border/50 opacity-50"
                          : "",
                      ].join(" ")}
                      disabled={session.isAnswerChecked}
                      onClick={() => setSession({ ...session, selectedAnswer: index })}
                    >
                      <div className={[
                        "w-7 h-7 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold transition-all",
                        !session.isAnswerChecked && isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "",
                        !session.isAnswerChecked && !isSelected
                          ? "border-muted-foreground/40 text-muted-foreground"
                          : "",
                        session.isAnswerChecked && isCorrect
                          ? "border-green-500 bg-green-500 text-white"
                          : "",
                        session.isAnswerChecked && isWrongSelection
                          ? "border-destructive bg-destructive text-white"
                          : "",
                        isUnrelatedAfterCheck
                          ? "border-muted-foreground/30 text-muted-foreground/40"
                          : "",
                      ].join(" ")}>
                        {session.isAnswerChecked && isCorrect ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : session.isAnswerChecked && isWrongSelection ? (
                          <X className="w-3.5 h-3.5" />
                        ) : (
                          String.fromCharCode(65 + index)
                        )}
                      </div>
                      <MathText text={option} className="inline break-words" />
                    </button>
                  )
                })}

                {session.isAnswerChecked ? (
                  <div className={[
                    "rounded-xl border-2 p-4 mt-2",
                    selectedAnswerValue === currentQuestion.answer
                      ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                      : "border-destructive bg-destructive/10",
                  ].join(" ")}>
                    <div className="flex items-start gap-3">
                      <div className={[
                        "mt-0.5 rounded-full p-1 flex-shrink-0",
                        selectedAnswerValue === currentQuestion.answer
                          ? "bg-green-500"
                          : "bg-destructive",
                      ].join(" ")}>
                        {selectedAnswerValue === currentQuestion.answer ? (
                          <Check className="h-3.5 w-3.5 text-white" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-white" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1.5 text-sm">
                        <p className={[
                          "font-semibold",
                          selectedAnswerValue === currentQuestion.answer
                            ? "text-green-700 dark:text-green-400"
                            : "text-destructive",
                        ].join(" ")}>
                          {selectedAnswerValue === currentQuestion.answer ? "答對了！" : "這題答錯了"}
                        </p>
                        {selectedAnswerValue !== currentQuestion.answer && (
                          <p className="text-muted-foreground">
                            正確答案：
                            <span className="font-medium text-foreground">
                              {String.fromCharCode(65 + currentQuestion.answer)}.
                            </span>{" "}
                            <MathText
                              text={currentQuestion.options[currentQuestion.answer]}
                              className="inline"
                            />
                          </p>
                        )}
                        {currentQuestion.explanation ? (
                          <p className="break-words text-muted-foreground">
                            解析：<MathText text={currentQuestion.explanation} className="inline" />
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" size="sm" onClick={restartPractice}>
                <RotateCcw className="mr-2 h-4 w-4" />
                重新選題
              </Button>
              {!session.isAnswerChecked ? (
                <Button
                  type="button"
                  size="lg"
                  className="w-full sm:w-auto sm:min-w-[160px]"
                  disabled={isFibQuestion ? !session.textAnswer.trim() : selectedAnswerValue === null}
                  onClick={checkAnswer}
                >
                  確認答案
                </Button>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  className="w-full sm:w-auto sm:min-w-[160px]"
                  disabled={isSubmitting}
                  onClick={moveToNextQuestion}
                >
                  {isSubmitting
                    ? "儲存中..."
                    : isLastQuestion
                      ? "完成並儲存結果"
                      : "下一題 →"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!session && result && completionSummary ? (
        <Card>
          <CardHeader>
            <CardTitle>本次練習結果</CardTitle>
            <CardDescription>結果已同步寫入最近練習紀錄，接下來直接做下一步就好。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ResultStatCard label="正確題數" value={`${correctCount}`} helper="答對題目" />
              <ResultStatCard label="總題數" value={`${result.totalQuestions}`} helper="本輪題量" />
              <ResultStatCard label="正確率" value={`${completionSummary.accuracy}%`} helper={getAccuracyMessage(completionSummary.accuracy)} />
              <ResultStatCard label="新增錯題" value={`${result.wrongQuestionCount}`} helper={result.wrongQuestionCount > 0 ? "已排進後續複習" : "這輪沒有新增錯題"} />
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm">
              <p className="font-medium text-foreground">
                {result.wrongQuestionCount > 0
                  ? `這輪最需要回頭補的是 ${completionSummary.weakTopics[0]?.topic ?? completionSummary.subjectName}。`
                  : "這輪手感不錯，適合趁熱再做一組或切去別的流程。"}
              </p>
              <p className="mt-2 leading-6 text-muted-foreground">
                {result.wrongQuestionCount > 0
                  ? `已經幫你把 ${result.wrongQuestionCount} 題錯題接進複習流程，現在先處理新鮮記憶最划算。`
                  : "沒有新增錯題，代表這科目前穩定度不差；可以續刷同科，或回 Dashboard 看今天下一步。"}
              </p>

              {completionSummary.weakTopics.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {completionSummary.weakTopics.slice(0, 3).map((item) => (
                    <Badge key={`${item.topic}-${item.count}`} variant="outline">
                      {item.topic} · 錯 {item.count} 題
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <ResultActionTile
                href={result.wrongQuestionCount > 0 ? "/review" : "/dashboard"}
                title={result.wrongQuestionCount > 0 ? "先去清這輪複習" : "回 Dashboard 看總體節奏"}
                description={result.wrongQuestionCount > 0 ? "把剛剛新產生的錯題和到期任務先處理掉。" : "確認今天哪一科還需要補強。"}
              />
              <ResultActionTile
                href={completionSummary.weakTopics[0]
                  ? `/practice?subject=${encodeURIComponent(completionSummary.subjectId)}&topic=${encodeURIComponent(completionSummary.weakTopics[0].topic)}`
                  : `/practice?subject=${encodeURIComponent(completionSummary.subjectId)}`}
                title={completionSummary.weakTopics[0] ? `再補 ${completionSummary.weakTopics[0].topic}` : `再刷一輪 ${completionSummary.subjectName}`}
                description={completionSummary.weakTopics[0] ? "直接鎖定最容易失血的單元，再做一次最有感。" : "延續同一科的手感，鞏固剛剛的節奏。"}
              />
              <ResultActionTile
                href="/study-log"
                title="接著開一段專注讀書"
                description="如果剛剛只是測驗，現在很適合順手把觀念補起來。"
              />
            </div>

            {result.questionResults && result.questionResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">每題詳情</p>
                <div className="space-y-2">
                  {result.questionResults.map((qr) => {
                    const wqId = wqStates[qr.question_id]
                    const inWrongBook = wqId !== null && wqId !== "removed"
                    return (
                      <div
                        key={qr.question_id}
                        className={`rounded-xl border p-3 text-sm ${qr.isCorrect ? "border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/20" : "border-destructive/20 bg-destructive/5"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-start gap-2">
                            <span className={`mt-0.5 shrink-0 text-base ${qr.isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                              {qr.isCorrect ? "✓" : "✗"}
                            </span>
                            <div className="min-w-0">
                              <p className="break-words text-foreground">{qr.question}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{qr.topic}</p>
                              {!qr.isCorrect && qr.explanation && (
                                <p className="mt-1 break-words text-xs text-muted-foreground">解析：{qr.explanation}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col gap-1">
                            {qr.isCorrect && !inWrongBook && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  onClick={async () => {
                                    const res = await addToWrongBook(qr.question_id, completionSummary.subjectId, "manual_add")
                                    if (res.success && res.wrongQuestionId) {
                                      setWqStates((prev) => ({ ...prev, [qr.question_id]: res.wrongQuestionId! }))
                                      toast.success(res.message)
                                    } else {
                                      toast.error(res.message)
                                    }
                                  }}
                                >
                                  加入錯題本
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  onClick={async () => {
                                    const res = await addToWrongBook(qr.question_id, completionSummary.subjectId, "guessed_correct")
                                    if (res.success && res.wrongQuestionId) {
                                      setWqStates((prev) => ({ ...prev, [qr.question_id]: res.wrongQuestionId! }))
                                      toast.success(res.message)
                                    } else {
                                      toast.error(res.message)
                                    }
                                  }}
                                >
                                  猜對不熟
                                </Button>
                              </>
                            )}
                            {!qr.isCorrect && inWrongBook && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={async () => {
                                  const res = await addToWrongBook(qr.question_id, completionSummary.subjectId, "careless_mistake")
                                  if (res.success) {
                                    toast.success(res.message)
                                  } else {
                                    toast.error(res.message)
                                  }
                                }}
                              >
                                標記粗心
                              </Button>
                            )}
                            {inWrongBook && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-muted-foreground"
                                onClick={async () => {
                                  if (!wqId || typeof wqId !== "string") return
                                  const res = await removeFromWrongBook(wqId)
                                  if (res.success) {
                                    setWqStates((prev) => ({ ...prev, [qr.question_id]: "removed" }))
                                    toast.success(res.message)
                                  } else {
                                    toast.error(res.message)
                                  }
                                }}
                              >
                                移除
                              </Button>
                            )}
                            {wqId === "removed" && (
                              <span className="text-xs text-muted-foreground">已移除</span>
                            )}
                            {inWrongBook && <span className="text-center text-xs text-muted-foreground">已在錯題本</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function ResultStatCard({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
    </div>
  )
}

function ResultActionTile({
  href,
  title,
  description,
}: {
  href: string
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-border/70 bg-background/70 p-4 transition-all duration-200 hover:border-primary/30 hover:bg-background"
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </Link>
  )
}

function buildCompletionSummary(
  questions: PracticeQuestionItem[],
  answers: PracticeQuestionAnswerInput[],
  result: PracticeQuestionSessionResult
): PracticeCompletionSummary {
  const answerMap = new Map(answers.map((answer) => [answer.question_id, answer]))
  const wrongTopicCount = new Map<string, number>()
  const correctTopicCount = new Map<string, number>()

  for (const question of questions) {
    const answer = answerMap.get(question.id)
    const isCorrect =
      question.question_type === "fill_in_blank"
        ? answer?.is_user_correct === true
        : answer?.selected_answer === question.answer
    const targetMap = isCorrect ? correctTopicCount : wrongTopicCount
    const label = question.unit_name ?? question.topic
    targetMap.set(label, (targetMap.get(label) ?? 0) + 1)
  }

  return {
    subjectId: questions[0]?.subject_id ?? "",
    subjectName: questions[0]?.subject_name ?? "",
    accuracy: Math.round((result.correctQuestions / result.totalQuestions) * 100),
    strongestTopics: mapTopicCounts(correctTopicCount),
    weakTopics: mapTopicCounts(wrongTopicCount),
  }
}

function mapTopicCounts(topicCount: Map<string, number>) {
  return Array.from(topicCount.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((left, right) => right.count - left.count || left.topic.localeCompare(right.topic, "zh-Hant"))
}

function getAccuracyMessage(accuracy: number) {
  if (accuracy >= 85) return "這輪手感很穩"
  if (accuracy >= 70) return "有抓到主線，但還能再補"
  if (accuracy >= 60) return "還行，但需要回頭整理"
  return "先補觀念再硬刷會更划算"
}

function normalizeFib(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ")
}

function checkFibAnswer(userAnswer: string, acceptedAnswer: string): boolean {
  const normalized = normalizeFib(userAnswer)
  return acceptedAnswer
    .split("|")
    .map((s) => normalizeFib(s))
    .some((s) => s === normalized)
}
