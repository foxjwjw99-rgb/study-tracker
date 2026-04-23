"use client"

import { useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, XCircle } from "lucide-react"

import Link from "next/link"

import { submitWrongQuestionReview } from "@/app/actions/wrong-questions"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MathText } from "@/components/math-text"
import { cn } from "@/lib/utils"
import type { WrongQuestionWithQuestion } from "@/app/actions/wrong-questions"

type Props = {
  items: WrongQuestionWithQuestion[]
  subjectName?: string
}

type ReviewState = {
  index: number
  selectedAnswer: number | null
  typedAnswer: string
  isAnswerChecked: boolean
}

type SessionResult = {
  total: number
  correct: number
}

function safeParseOptions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed) && parsed.every((o) => typeof o === "string")) return parsed
  } catch {
    // ignore
  }
  return []
}

export function WrongBookReview({ items, subjectName }: Props) {
  const [state, setState] = useState<ReviewState>({
    index: 0,
    selectedAnswer: null,
    typedAnswer: "",
    isAnswerChecked: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null)
  const [results, setResults] = useState<Array<{ correct: boolean; questionText: string }>>([])

  const current = items[state.index]
  const question = current?.question

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="font-semibold">今天沒有到期的錯題</p>
          <p className="mt-1 text-sm text-muted-foreground">繼續保持！明天再回來複習。</p>
        </CardContent>
      </Card>
    )
  }

  if (sessionResult) {
    const accuracy = Math.round((sessionResult.correct / sessionResult.total) * 100)
    return (
      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="font-semibold">複習完成</p>
            <p className="text-sm text-muted-foreground">本輪錯題複習結果</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-center">
              <p className="text-sm text-muted-foreground">複習題數</p>
              <p className="mt-1 text-3xl font-semibold">{sessionResult.total}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-center">
              <p className="text-sm text-muted-foreground">答對</p>
              <p className="mt-1 text-3xl font-semibold text-emerald-600">{sessionResult.correct}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-center">
              <p className="text-sm text-muted-foreground">正確率</p>
              <p className="mt-1 text-3xl font-semibold">{accuracy}%</p>
            </div>
          </div>

          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-lg p-2 text-sm ${r.correct ? "bg-emerald-50/40 dark:bg-emerald-950/20" : "bg-destructive/5"}`}>
                {r.correct
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                <span className="break-words">{r.questionText}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Link href="/wrong-questions" className={cn(buttonVariants({ variant: "outline" }))}>
              回錯題本
            </Link>
            <Link href="/wrong-questions/review" className={cn(buttonVariants())}>
              再複習一輪
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!question) return null

  const isFib = question.question_type === "fill_in_blank"
  const options = safeParseOptions(question.options)

  const checkAnswer = () => {
    if (isFib) {
      if (!state.typedAnswer.trim()) {
        toast.error("請輸入答案。")
        return
      }
    } else {
      if (state.selectedAnswer === null) {
        toast.error("請選擇答案。")
        return
      }
    }
    setState((s) => ({ ...s, isAnswerChecked: true }))
  }

  const isUserCorrect = (): boolean => {
    if (isFib) {
      const accepted = (question.text_answer ?? "").split("|").map((s) => s.trim().toLowerCase())
      return accepted.includes(state.typedAnswer.trim().toLowerCase())
    }
    return state.selectedAnswer === question.answer
  }

  const moveNext = async () => {
    const correct = isUserCorrect()
    setIsSubmitting(true)
    try {
      await submitWrongQuestionReview({
        wrong_question_id: current.id,
        question_id: question.id,
        answered_correctly: correct,
        selected_answer: isFib ? undefined : (state.selectedAnswer ?? undefined),
        typed_answer: isFib ? state.typedAnswer : undefined,
      })
      setResults((prev) => [...prev, { correct, questionText: question.question }])

      const isLast = state.index === items.length - 1
      if (isLast) {
        setSessionResult({
          total: items.length,
          correct: results.filter((r) => r.correct).length + (correct ? 1 : 0),
        })
      } else {
        setState({
          index: state.index + 1,
          selectedAnswer: null,
          typedAnswer: "",
          isAnswerChecked: false,
        })
      }
    } catch {
      toast.error("儲存複習結果失敗，請重試。")
    } finally {
      setIsSubmitting(false)
    }
  }

  const answered = state.isAnswerChecked
  const correct = answered ? isUserCorrect() : null

  return (
    <div className="space-y-4">
      {/* Progress row */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>第 {state.index + 1} / {items.length} 題</span>
        <div className="flex gap-1.5">
          <Badge variant="outline" className="rounded-full px-3 text-xs font-normal">
            {current.subject.name}
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 text-xs font-normal">
            {current.topic}
          </Badge>
          {current.wrong_count > 1 && (
            <Badge variant="destructive" className="rounded-full px-3 text-xs font-normal">
              已錯 {current.wrong_count} 次
            </Badge>
          )}
        </div>
      </div>

      {/* Question card */}
      <Card className="shadow-sm">
        <CardContent className="space-y-4 p-5">
          {/* Question text */}
          <p className="text-base leading-relaxed">
            <MathText text={question.question} />
          </p>

          {isFib ? (
            <div className="space-y-2">
              <Input
                placeholder="輸入答案"
                value={state.typedAnswer}
                onChange={(e) => setState((s) => ({ ...s, typedAnswer: e.target.value }))}
                disabled={answered}
                onKeyDown={(e) => e.key === "Enter" && !answered && checkAnswer()}
                className="rounded-xl"
              />
              {answered && (
                <div className={cn(
                  "rounded-xl p-3 text-sm",
                  correct
                    ? "bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "bg-destructive/10 text-destructive"
                )}>
                  {correct ? "✓ 正確" : `✗ 正確答案：${question.text_answer}`}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {options.map((option, idx) => {
                const isSelected = state.selectedAnswer === idx
                const isCorrectAnswer = answered && idx === question.answer
                const isWrongSelected = answered && idx === state.selectedAnswer && state.selectedAnswer !== question.answer

                return (
                  <button
                    key={idx}
                    disabled={answered}
                    onClick={() => setState((s) => ({ ...s, selectedAnswer: idx }))}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors",
                      isCorrectAnswer
                        ? "border-emerald-400/60 bg-emerald-50/60 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                        : isWrongSelected
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : isSelected
                            ? "border-accent-foreground/20 bg-accent text-accent-foreground"
                            : "border-border bg-card text-foreground hover:bg-muted/40"
                    )}
                  >
                    <span className={cn(
                      "w-5 shrink-0 font-semibold",
                      isSelected && !answered ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {String.fromCharCode(65 + idx)}.
                    </span>
                    <MathText text={option} />
                  </button>
                )
              })}
            </div>
          )}

          {answered && question.explanation && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">解析</p>
              <p className="mt-1">{question.explanation}</p>
            </div>
          )}

          {/* Action button */}
          <div className="flex justify-end">
            {!answered ? (
              <Button onClick={checkAnswer} className="rounded-full px-6">
                確認答案
              </Button>
            ) : (
              <Button onClick={moveNext} disabled={isSubmitting} className="rounded-full px-6">
                {state.index === items.length - 1 ? "完成複習" : "下一題"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
