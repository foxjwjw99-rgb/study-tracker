"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { format } from "date-fns"
import { BookOpenText, Check, RotateCcw, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { deleteVocabularyWord, getVocabularySession, updateVocabularyReviewStatus } from "@/app/actions/vocabulary"
import { VocabularyPronunciationButton } from "@/components/vocabulary-pronunciation-button"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatVocabularyStatus } from "@/lib/vocabulary"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type {
  VocabularyBankItem,
  VocabularyConfidenceLevel,
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
}

const STATUS_FILTER_OPTIONS: Array<{ value: VocabularyStatusFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "due", label: "待複習" },
  { value: "new", label: "新單字" },
  { value: "learning", label: "學習中" },
  { value: "familiar", label: "已熟悉" },
]

const SESSION_LIMIT_OPTIONS = [5, 10, 20] as const

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

      if (isLastCard) {
        setSession({
          ...session,
          reviewedCount: session.reviewedCount + 1,
          currentIndex: session.currentIndex + 1,
          isFlipped: false,
          cardStartedAt: Date.now(),
        })
      } else {
        setSession({
          ...session,
          reviewedCount: session.reviewedCount + 1,
          currentIndex: session.currentIndex + 1,
          isFlipped: false,
          cardStartedAt: Date.now(),
        })
      }

      toast.success(result.message)
    } catch {
      toast.error("更新單字狀態失敗。")
    } finally {
      setIsUpdating(false)
    }
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
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                第 {session.currentIndex + 1} / {session.words.length} 張
              </Badge>
              <Badge variant="outline">{currentWord.subject_name}</Badge>
              <Badge variant="outline">{formatVocabularyStatus(currentWord.status)}</Badge>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-3xl tracking-wide">{currentWord.word}</CardTitle>
              <VocabularyPronunciationButton text={currentWord.word} />
            </div>
            {!session.isFlipped ? (
              <CardDescription>
                先試著回想意思，翻卡後再標記熟悉度。
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {session.isFlipped ? (
              <div className="space-y-3 rounded-xl border bg-muted/40 p-5">
                <div>
                  <div className="text-sm text-muted-foreground">中文意思</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {currentWord.part_of_speech ? (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-mono font-semibold text-primary">
                        {currentWord.part_of_speech}
                      </span>
                    ) : null}
                    <span className="text-lg font-medium">{currentWord.meaning}</span>
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">例句</div>
                    <VocabularyPronunciationButton
                      text={currentWord.example_sentence}
                      label="朗讀例句"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                    />
                  </div>
                  <div className="break-words text-base">
                    <HighlightedExample sentence={currentWord.example_sentence} word={currentWord.word} />
                  </div>
                  {currentWord.example_sentence_translation ? (
                    <div className="mt-1 text-sm text-muted-foreground italic">
                      {currentWord.example_sentence_translation}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setSession({ ...session, isFlipped: !session.isFlipped })}>
                {session.isFlipped ? "收起答案" : "翻卡"}
              </Button>
              <button
                type="button"
                onClick={endSession}
                className="self-end text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                結束本輪
              </button>
            </div>

            {session.isFlipped ? (
              <div className="space-y-4 pt-2">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isUpdating}
                    onClick={() => rateCurrentWord("hard")}
                    className="h-12 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                  >
                    不熟
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isUpdating}
                    onClick={() => rateCurrentWord("okay")}
                    className="h-12"
                  >
                    普通
                  </Button>
                  <Button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => rateCurrentWord("easy")}
                    className="h-12 bg-emerald-600 hover:bg-emerald-700"
                  >
                    熟悉
                  </Button>
                </div>
              </div>
            ) : null}

            {isLastCard && session.reviewedCount > 0 ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                目前已完成 {session.reviewedCount} 張。這張評分後，本輪會結束。
              </div>
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
