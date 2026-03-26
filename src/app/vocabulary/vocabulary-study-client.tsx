"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { format } from "date-fns"
import { BookOpenText, Check, CheckCircle2, Sparkles, Trash2, X, XCircle } from "lucide-react"
import { toast } from "sonner"

import { deleteVocabularyWord, getVocabularySession, updateVocabularyReviewStatus } from "@/app/actions/vocabulary"
import { VocabularyPronunciationButton } from "@/components/vocabulary-pronunciation-button"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatVocabularyStatus } from "@/lib/vocabulary"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type {
  VocabularyBankItem,
  VocabularyQueueItem,
  VocabularyReviewRating,
  VocabularyStatusFilter,
} from "@/types"

type VocabularyStudyClientProps = {
  bank: VocabularyBankItem[]
  initialWords: VocabularyQueueItem[]
}

type VocabularySessionState = {
  words: VocabularyQueueItem[]
  currentIndex: number
  isFlipped: boolean
  reviewedCount: number
  cardStartedAt: number
  choices: VocabularyQueueItem[]
  selectedOptionId: string | null
  pendingRating: VocabularyReviewRating | null
}

const STATUS_FILTER_OPTIONS: Array<{ value: VocabularyStatusFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "due", label: "待複習" },
  { value: "new", label: "新單字" },
  { value: "learning", label: "學習中" },
  { value: "familiar", label: "已熟悉" },
]

const SESSION_LIMIT_OPTIONS = [5, 10, 20] as const

function generateChoices(
  allWords: VocabularyQueueItem[],
  currentWord: VocabularyQueueItem
): VocabularyQueueItem[] {
  const pool = allWords.filter((w) => w.id !== currentWord.id && w.meaning.trim().length > 0)
  const distractors = [...pool].sort(() => Math.random() - 0.5).slice(0, 2)
  return [currentWord, ...distractors].sort(() => Math.random() - 0.5)
}

export function VocabularyStudyClient({
  bank,
  initialWords,
}: VocabularyStudyClientProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<VocabularyStatusFilter>("all")
  const [sessionLimit, setSessionLimit] = useState<string>("10")
  const [words, setWords] = useState<VocabularyQueueItem[]>(initialWords)
  const [session, setSession] = useState<VocabularySessionState | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleDeleteWord = async (id: string, wordStr: string) => {
    if (!confirm(`確定要刪除單字「${wordStr}」嗎？`)) {
      return
    }

    try {
      await deleteVocabularyWord(id)
      setWords((currentWords) => currentWords.filter((word) => word.id !== id))
      toast.success("單字已刪除。")
    } catch {
      toast.error("刪除單字失敗。")
    }
  }

  const filteredWords = useMemo(() => {
    return words.filter((word) => {
      const matchesSubject =
        selectedSubjectId === "all" || word.subject_id === selectedSubjectId
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "due"
            ? word.next_review_date !== null && word.next_review_date <= new Date()
            : word.status.toLowerCase() === statusFilter

      return matchesSubject && matchesStatus
    })
  }, [selectedSubjectId, statusFilter, words])

  const currentWord = session ? session.words[session.currentIndex] : null
  const isLastCard = session
    ? session.currentIndex === session.words.length - 1
    : false
  const selectedSubject = bank.find((item) => item.subject_id === selectedSubjectId) ?? null

  const startSession = async () => {
    setIsStarting(true)

    try {
      const result = await getVocabularySession(
        selectedSubjectId === "all" ? undefined : selectedSubjectId,
        Number.parseInt(sessionLimit, 10),
        statusFilter
      )

      if (result.length === 0) {
        toast.error("目前沒有符合條件的單字可供背誦。")
        return
      }

      setSession({
        words: result,
        currentIndex: 0,
        isFlipped: false,
        reviewedCount: 0,
        cardStartedAt: Date.now(),
        choices: generateChoices(words, result[0]),
        selectedOptionId: null,
        pendingRating: null,
      })
    } catch {
      toast.error("載入單字卡失敗。")
    } finally {
      setIsStarting(false)
    }
  }

  const rateCurrentWord = async (rating: VocabularyReviewRating) => {
    if (!currentWord || !session) {
      return
    }

    setIsUpdating(true)

    try {
      const responseMs = Math.max(800, Date.now() - session.cardStartedAt)
      const result = await updateVocabularyReviewStatus(currentWord.id, {
        rating,
        confidence: rating === "hard" ? 2 : rating === "easy" ? 5 : 3,
        response_ms: responseMs,
      })
      if (!result.success) {
        toast.error(result.message)
        return
      }

      setWords((currentWords) =>
        currentWords.map((word) => (word.id === result.word.id ? result.word : word))
      )

      const nextIndex = session.currentIndex + 1
      const nextWord = session.words[nextIndex]

      setSession({
        ...session,
        reviewedCount: session.reviewedCount + 1,
        currentIndex: nextIndex,
        isFlipped: false,
        cardStartedAt: Date.now(),
        choices: nextWord ? generateChoices(words, nextWord) : [],
        selectedOptionId: null,
        pendingRating: null,
      })

      toast.success(result.message)
    } catch {
      toast.error("更新單字狀態失敗。")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleOptionSelect = (option: VocabularyQueueItem) => {
    if (!session || session.selectedOptionId !== null || !currentWord) return
    const isCorrect = option.id === currentWord.id
    setSession({
      ...session,
      selectedOptionId: option.id,
      pendingRating: isCorrect ? "easy" : "hard",
    })
  }

  const handleNextWord = async () => {
    if (!session?.pendingRating) return
    await rateCurrentWord(session.pendingRating)
  }

  const endSession = () => {
    setSession(null)
  }

  if (bank.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>英文單字</CardTitle>
          <CardDescription>你還沒有匯入任何英文單字。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            先到匯入頁上傳英文單字 JSON，之後就能在這裡背單字。
          </p>
          <Link href="/import" className={buttonVariants({ className: "w-full sm:w-auto" })}>
            前往匯入資料
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {!session ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpenText className="h-4 w-4" />
              單字卡背誦
            </CardTitle>
            <CardDescription>選科目、篩選熟悉度後開始背單字。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">科目</label>
                <Select value={selectedSubjectId} onValueChange={(value) => setSelectedSubjectId(value ?? "all")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{selectedSubject?.subject_name ?? "全部科目"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部科目</SelectItem>
                    {bank.map((item) => (
                      <SelectItem key={item.subject_id} value={item.subject_id}>
                        {item.subject_name} ({item.word_count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">篩選</label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter((value as VocabularyStatusFilter | null) ?? "all")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {STATUS_FILTER_OPTIONS.find((option) => option.value === statusFilter)?.label ?? "全部"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">張數</label>
                <Select value={sessionLimit} onValueChange={(value) => setSessionLimit(value ?? "10")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{sessionLimit} 張</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_LIMIT_OPTIONS.map((limit) => (
                      <SelectItem key={limit} value={limit.toString()}>
                        {limit} 張
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              符合目前篩選條件的單字共有 {filteredWords.length} 個。
            </div>

            <Button type="button" disabled={isStarting} onClick={startSession}>
              {isStarting ? "載入中..." : "開始背單字"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {session && currentWord ? (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={endSession}
                aria-label="結束練習"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{
                    width: `${(session.currentIndex / session.words.length) * 100}%`,
                  }}
                />
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {session.currentIndex + 1} / {session.words.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Definition card */}
            <div className="flex min-h-[120px] items-center justify-center rounded-2xl border bg-card p-6 shadow-sm">
              <p className="text-center text-xl font-medium leading-relaxed">
                {currentWord.meaning}
              </p>
            </div>

            {/* Multiple choice buttons */}
            <div className="space-y-3">
              {session.choices.map((option) => {
                const isSelected = session.selectedOptionId === option.id
                const isCorrect = option.id === currentWord.id
                const hasAnswered = session.selectedOptionId !== null

                let extraClass = ""
                if (hasAnswered) {
                  if (isCorrect) {
                    extraClass =
                      "border-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  } else if (isSelected) {
                    extraClass =
                      "border-red-400 bg-red-50 text-red-800 hover:bg-red-50 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300"
                  }
                }

                return (
                  <Button
                    key={option.id}
                    type="button"
                    variant="outline"
                    disabled={hasAnswered || isUpdating}
                    onClick={() => handleOptionSelect(option)}
                    className={cn("h-12 w-full justify-start text-left font-medium", extraClass)}
                  >
                    {hasAnswered && isCorrect && (
                      <CheckCircle2 className="mr-2 h-4 w-4 shrink-0 text-emerald-600" />
                    )}
                    {hasAnswered && isSelected && !isCorrect && (
                      <XCircle className="mr-2 h-4 w-4 shrink-0 text-red-500" />
                    )}
                    {option.word}
                  </Button>
                )
              })}
            </div>

            {/* Feedback area */}
            {session.selectedOptionId !== null ? (
              <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
                <p
                  className={cn(
                    "font-semibold",
                    session.pendingRating === "easy"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-red-700 dark:text-red-400"
                  )}
                >
                  {session.pendingRating === "easy" ? "✓ That's correct!" : "✗ That's incorrect!"}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  {currentWord.part_of_speech ? (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-mono font-semibold text-primary">
                      {currentWord.part_of_speech}
                    </span>
                  ) : null}
                  <span className="text-lg font-semibold">{currentWord.word}</span>
                  <VocabularyPronunciationButton text={currentWord.word} />
                </div>

                {currentWord.example_sentence ? (
                  <div>
                    <div className="mb-1 text-sm font-medium text-muted-foreground">
                      Used in a sentence:
                    </div>
                    <div className="text-sm">
                      <HighlightedExample
                        sentence={currentWord.example_sentence}
                        word={currentWord.word}
                      />
                    </div>
                    {currentWord.example_sentence_translation ? (
                      <div className="mt-1 text-xs italic text-muted-foreground">
                        {currentWord.example_sentence_translation}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Next word button */}
            {session.selectedOptionId !== null ? (
              <Button
                type="button"
                disabled={isUpdating}
                onClick={handleNextWord}
                className="w-full"
              >
                {isUpdating ? "更新中..." : isLastCard ? "完成本輪" : "Next word →"}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {session && !currentWord ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              本輪完成
            </CardTitle>
            <CardDescription>你已完成這一輪單字卡背誦。</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={endSession}>
              <Sparkles className="mr-2 h-4 w-4" />
              回到單字列表
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>單字清單</CardTitle>
          <CardDescription>查看目前單字狀態與下次複習時間。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredWords.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              目前沒有符合條件的單字。
            </div>
          ) : (
            filteredWords.map((word) => (
              <div key={word.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold">{word.word}</div>
                      {word.part_of_speech ? (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-mono font-semibold text-primary">
                          {word.part_of_speech}
                        </span>
                      ) : null}
                      <VocabularyPronunciationButton
                        text={word.word}
                        label="發音"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">{word.meaning}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{word.subject_name}</Badge>
                    <Badge variant={word.status === "FAMILIAR" ? "default" : word.status === "LEARNING" ? "secondary" : "outline"}>
                      {formatVocabularyStatus(word.status)}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteWord(word.id, word.word)}
                      className="ml-2 h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title="刪除"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">刪除</span>
                    </Button>
                  </div>
                </div>
                <div className="mt-3 space-y-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm text-muted-foreground">
                      {word.example_sentence}
                    </div>
                    <VocabularyPronunciationButton
                      text={word.example_sentence}
                      label="朗讀"
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0 px-2"
                    />
                  </div>
                  {word.example_sentence_translation ? (
                    <div className="text-xs italic text-muted-foreground">
                      {word.example_sentence_translation}
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  下次複習：
                  {" "}
                  {word.next_review_date ? format(word.next_review_date, "PP") : "尚未安排"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  SRS：間隔 {word.interval_days.toFixed(1)} 天 • EF {word.ease_factor.toFixed(2)} • 累計 {word.review_count} 次
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function HighlightedExample({ sentence, word }: { sentence: string; word: string }) {
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const parts = sentence.split(new RegExp(`(${escapedWord})`, "ig"))

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === word.toLowerCase() ? (
          <span key={`${part}-${index}`} className="font-semibold text-primary">
            {part}
          </span>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  )
}
