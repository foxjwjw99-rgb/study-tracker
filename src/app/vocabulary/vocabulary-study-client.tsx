"use client"

import Link from "next/link"
import { createPortal } from "react-dom"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { BookOpenText, Check, CheckCircle2, Keyboard, Sparkles, Trash2, X, XCircle } from "lucide-react"
import { toast } from "sonner"

import { deleteVocabularyWord, getVocabularySession, updateVocabularyReviewStatus } from "@/app/actions/vocabulary"
import { VocabularyPronunciationButton } from "@/components/vocabulary-pronunciation-button"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  initialListId?: string
}

type StudyMode = "flashcard" | "quiz" | "spelling"

type VocabularySessionState = {
  words: VocabularyQueueItem[]
  currentIndex: number
  reviewedCount: number
  cardStartedAt: number
  mode: StudyMode
  choices: VocabularyQueueItem[]
  selectedOptionId: string | null
  pendingRating: VocabularyReviewRating | null
  spellingInput: string
  spellingSubmitted: boolean
  flashcardRevealed: boolean
  requeuedWordIds: string[]
  correctCount: number
  hardCount: number
}

const STATUS_FILTER_OPTIONS: Array<{ value: VocabularyStatusFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "due", label: "待複習" },
  { value: "new", label: "新單字" },
  { value: "learning", label: "學習中" },
  { value: "familiar", label: "已熟悉" },
]

const SESSION_LIMIT_OPTIONS = [5, 10, 20] as const

function shuffleWords(words: VocabularyQueueItem[]) {
  return [...words].sort(() => Math.random() - 0.5)
}

function generateChoices(
  sessionWords: VocabularyQueueItem[],
  currentWord: VocabularyQueueItem
): VocabularyQueueItem[] {
  const pool = sessionWords.filter(
    (word) => word.id !== currentWord.id && word.word.trim().length > 0
  )
  const distractors = shuffleWords(pool).slice(0, 3)
  return shuffleWords([currentWord, ...distractors])
}

function buildSessionState(words: VocabularyQueueItem[], mode: StudyMode): VocabularySessionState {
  const firstWord = words[0]

  return {
    words,
    currentIndex: 0,
    reviewedCount: 0,
    cardStartedAt: Date.now(),
    mode,
    choices: firstWord && mode === "quiz" ? generateChoices(words, firstWord) : [],
    selectedOptionId: null,
    pendingRating: null,
    spellingInput: "",
    spellingSubmitted: false,
    flashcardRevealed: false,
    requeuedWordIds: [],
    correctCount: 0,
    hardCount: 0,
  }
}

export function VocabularyStudyClient({
  bank,
  initialWords,
  initialListId,
}: VocabularyStudyClientProps) {
  const [selectedListId, setSelectedListId] = useState<string>(initialListId ?? "all")
  const [statusFilter, setStatusFilter] = useState<VocabularyStatusFilter>("all")
  const [sessionLimit, setSessionLimit] = useState<string>("10")
  const [studyMode, setStudyMode] = useState<StudyMode>("flashcard")
  const [words, setWords] = useState<VocabularyQueueItem[]>(initialWords)
  const [session, setSession] = useState<VocabularySessionState | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [wordListPage, setWordListPage] = useState(1)
  const WORDS_PER_PAGE = 20
  const spellingInputRef = useRef<HTMLInputElement>(null)
  const sessionStartedAtRef = useRef<number | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

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
      const matchesList =
        selectedListId === "all" || word.list_id === selectedListId
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "due"
            ? word.next_review_date !== null && word.next_review_date <= new Date()
            : word.status.toLowerCase() === statusFilter
      const q = searchQuery.trim().toLowerCase()
      const matchesSearch =
        q === "" ||
        word.word.toLowerCase().includes(q) ||
        word.meaning.includes(q)

      return matchesList && matchesStatus && matchesSearch
    })
  }, [selectedListId, statusFilter, searchQuery, words])

  const totalWordPages = Math.max(1, Math.ceil(filteredWords.length / WORDS_PER_PAGE))
  const pagedWords = filteredWords.slice((wordListPage - 1) * WORDS_PER_PAGE, wordListPage * WORDS_PER_PAGE)

  useEffect(() => {
    setWordListPage(1)
  }, [selectedListId, statusFilter, searchQuery])

  const currentWord = session ? session.words[session.currentIndex] : null
  const isLastCard = session
    ? session.currentIndex === session.words.length - 1
    : false
  const selectedList = bank.find((item) => item.list_id === selectedListId) ?? null

  const startSession = async () => {
    setIsStarting(true)

    try {
      const result = await getVocabularySession(
        selectedListId === "all" ? undefined : selectedListId,
        Number.parseInt(sessionLimit, 10),
        statusFilter
      )

      if (result.length === 0) {
        toast.error("目前沒有符合條件的單字可供背誦。")
        return
      }

      sessionStartedAtRef.current = Date.now()
      setSession(buildSessionState(result, studyMode))
    } catch {
      toast.error("載入單字卡失敗。")
    } finally {
      setIsStarting(false)
    }
  }

  const rateCurrentWord = useCallback(async (rating: VocabularyReviewRating) => {
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

      const isHard = rating === "hard"
      const alreadyRequeued = session.requeuedWordIds.includes(currentWord.id)
      const updatedWords =
        isHard && !alreadyRequeued
          ? [...session.words, currentWord]
          : session.words
      const updatedRequeuedIds =
        isHard && !alreadyRequeued
          ? [...session.requeuedWordIds, currentWord.id]
          : session.requeuedWordIds

      const nextIndex = session.currentIndex + 1
      const nextWord = updatedWords[nextIndex]

      setSession({
        ...session,
        words: updatedWords,
        requeuedWordIds: updatedRequeuedIds,
        reviewedCount: session.reviewedCount + 1,
        correctCount: session.correctCount + (isHard ? 0 : 1),
        hardCount: session.hardCount + (isHard ? 1 : 0),
        currentIndex: nextIndex,
        cardStartedAt: Date.now(),
        choices: nextWord && session.mode === "quiz" ? generateChoices(updatedWords, nextWord) : [],
        selectedOptionId: null,
        pendingRating: null,
        spellingInput: "",
        spellingSubmitted: false,
        flashcardRevealed: false,
      })

      toast.success(result.message)
    } catch {
      toast.error("更新單字狀態失敗。")
    } finally {
      setIsUpdating(false)
    }
  }, [currentWord, session])

  const handleOptionSelect = useCallback((option: VocabularyQueueItem) => {
    if (!session || session.selectedOptionId !== null || !currentWord) {
      return
    }

    const isCorrect = option.id === currentWord.id

    setSession((s) => s ? {
      ...s,
      selectedOptionId: option.id,
      pendingRating: isCorrect ? "easy" : "hard",
    } : s)
  }, [session, currentWord])

  const handleSpellingSubmit = () => {
    if (!session || !currentWord || session.spellingSubmitted) {
      return
    }

    const normalizedInput = session.spellingInput.trim().toLowerCase()
    const normalizedAnswer = currentWord.word.trim().toLowerCase()
    const isCorrect = normalizedInput === normalizedAnswer

    setSession({
      ...session,
      spellingSubmitted: true,
      pendingRating: isCorrect ? "easy" : "hard",
    })
  }

  const handleNextWord = useCallback(async () => {
    if (!session?.pendingRating) {
      return
    }

    await rateCurrentWord(session.pendingRating)
  }, [session, rateCurrentWord])

  const endSession = useCallback(() => {
    sessionStartedAtRef.current = null
    setSession(null)
  }, [])

  useEffect(() => {
    if (session?.mode === "spelling" && !session.spellingSubmitted && spellingInputRef.current) {
      const timer = setTimeout(() => spellingInputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [session?.currentIndex, session?.mode, session?.spellingSubmitted])

  // Keyboard shortcuts for flashcard mode
  useEffect(() => {
    if (!session || session.mode !== "flashcard" || isUpdating) {
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (!session.flashcardRevealed) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault()
          setSession((s) => s ? { ...s, flashcardRevealed: true } : s)
        }
        return
      }

      if (session.pendingRating === null) {
        if (e.key === "1") {
          setSession((s) => s ? { ...s, pendingRating: "hard" } : s)
        } else if (e.key === "2") {
          setSession((s) => s ? { ...s, pendingRating: "okay" } : s)
        } else if (e.key === "3") {
          setSession((s) => s ? { ...s, pendingRating: "easy" } : s)
        }
        return
      }

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        void handleNextWord()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [session, isUpdating, handleNextWord])

  // Keyboard shortcuts for quiz mode
  useEffect(() => {
    if (!session || session.mode !== "quiz" || isUpdating) {
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (session.selectedOptionId === null) {
        const index = ["1", "2", "3", "4"].indexOf(e.key)
        if (index !== -1 && session.choices[index]) {
          e.preventDefault()
          handleOptionSelect(session.choices[index])
        }
        return
      }

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        void handleNextWord()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [session, isUpdating, handleNextWord, handleOptionSelect])

  useEffect(() => {
    if (!session) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [session])

  const hasAnswered = session
    ? session.mode === "quiz"
      ? session.selectedOptionId !== null
      : session.mode === "spelling"
        ? session.spellingSubmitted
        : session.pendingRating !== null
    : false

  const sessionViewKey = session
    ? [
        session.currentIndex,
        session.mode,
        session.flashcardRevealed ? "revealed" : "hidden",
        hasAnswered ? session.pendingRating ?? "answered" : "pending",
      ].join("-")
    : "idle"

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
              單字練習
            </CardTitle>
            <CardDescription>選單字清單、篩選熟悉度與練習模式後開始背單字。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">單字清單</label>
                <Select value={selectedListId} onValueChange={(value) => setSelectedListId(value ?? "all")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{selectedList?.list_name ?? "全部清單"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部清單</SelectItem>
                    {bank.map((item) => (
                      <SelectItem key={item.list_id} value={item.list_id}>
                        {item.list_name} ({item.word_count})
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

            <div className="space-y-2">
              <label className="text-sm font-medium">練習模式</label>
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setStudyMode("flashcard")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                    studyMode === "flashcard"
                      ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                      : "border-border/70 bg-background/80 text-muted-foreground hover:border-primary/20 hover:text-foreground"
                  )}
                >
                  <BookOpenText className="h-4 w-4" />
                  翻卡熟悉度
                </button>
                <button
                  type="button"
                  onClick={() => setStudyMode("quiz")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                    studyMode === "quiz"
                      ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                      : "border-border/70 bg-background/80 text-muted-foreground hover:border-primary/20 hover:text-foreground"
                  )}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  選擇題
                </button>
                <button
                  type="button"
                  onClick={() => setStudyMode("spelling")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                    studyMode === "spelling"
                      ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                      : "border-border/70 bg-background/80 text-muted-foreground hover:border-primary/20 hover:text-foreground"
                  )}
                >
                  <Keyboard className="h-4 w-4" />
                  拼寫練習
                </button>
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

      {session && currentWord && mounted ? createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col bg-background">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,var(--primary)_5%,transparent)_0%,transparent_60%)]" />

          <div className="relative mx-auto flex w-full max-w-lg items-center gap-3 px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => endSession()}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="結束練習"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full rounded-full bg-primary/50 transition-all duration-500 ease-out"
                style={{
                  width: `${Math.min(100, ((session.currentIndex + 1) / session.words.length) * 100)}%`,
                }}
              />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
              {session.currentIndex + 1} / {session.words.length}
            </span>
          </div>

          <div className="relative flex flex-1 flex-col items-center justify-center overflow-auto px-5 py-8">
            <div key={sessionViewKey} className="w-full max-w-lg space-y-6 animate-in fade-in-0 zoom-in-95 duration-200 sm:space-y-8">
              <div className="flex min-h-[124px] items-center justify-center rounded-3xl border border-border/50 bg-card/80 p-6 shadow-sm backdrop-blur-sm transition-all duration-200 sm:min-h-[136px] sm:p-8">
                <p className="text-center text-lg leading-relaxed text-foreground/90 sm:text-2xl">
                  {currentWord.meaning}
                </p>
              </div>

              {session.mode === "flashcard" ? (
                <div className="space-y-4">
                  {session.flashcardRevealed ? (
                    hasAnswered ? (
                      <AnsweredWordCard currentWord={currentWord} rating={session.pendingRating} />
                    ) : (
                      <div className="space-y-4 rounded-2xl border border-border/40 bg-card/50 p-5 backdrop-blur-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          {currentWord.part_of_speech ? (
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                              {currentWord.part_of_speech}
                            </span>
                          ) : null}
                          <span className="text-lg font-semibold">{currentWord.word}</span>
                          <VocabularyPronunciationButton text={currentWord.word} showPhonetic />
                        </div>

                        {currentWord.example_sentence ? (
                          <div>
                            <div className="mb-1 text-xs font-medium text-muted-foreground/70">例句</div>
                            <div className="text-sm leading-relaxed">
                              <HighlightedExample sentence={currentWord.example_sentence} word={currentWord.word} />
                            </div>
                            {currentWord.example_sentence_translation ? (
                              <div className="mt-1.5 text-xs italic text-muted-foreground/60">
                                {currentWord.example_sentence_translation}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  ) : (
                    <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                      先自己回想英文，想好再翻開答案。
                    </div>
                  )}

                  {!session.flashcardRevealed ? (
                    <button
                      type="button"
                      onClick={() => setSession({ ...session, flashcardRevealed: true })}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary/90 text-sm font-medium text-primary-foreground transition-all hover:bg-primary active:scale-[0.98]"
                    >
                      翻開答案
                      <kbd className="rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1.5 text-xs font-mono opacity-70">Space</kbd>
                    </button>
                  ) : null}

                  {session.flashcardRevealed && session.pendingRating === null ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isUpdating}
                        onClick={() => setSession({ ...session, pendingRating: "hard" })}
                        className="h-12 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                      >
                        不熟
                        <kbd className="ml-1.5 rounded border border-red-200/80 bg-red-100/60 px-1 text-xs font-mono opacity-60 dark:border-red-900/50 dark:bg-red-900/20">1</kbd>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isUpdating}
                        onClick={() => setSession({ ...session, pendingRating: "okay" })}
                        className="h-12"
                      >
                        普通
                        <kbd className="ml-1.5 rounded border border-border/80 bg-muted/60 px-1 text-xs font-mono opacity-60">2</kbd>
                      </Button>
                      <Button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => setSession({ ...session, pendingRating: "easy" })}
                        className="h-12 bg-emerald-600 hover:bg-emerald-700"
                      >
                        熟悉
                        <kbd className="ml-1.5 rounded border border-emerald-400/50 bg-emerald-500/30 px-1 text-xs font-mono opacity-70">3</kbd>
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {session.mode === "quiz" ? (
                <div className="space-y-3">
                  {session.choices.length > 0 ? (
                    session.choices.map((option) => {
                      const isSelected = session.selectedOptionId === option.id
                      const isCorrect = option.id === currentWord.id
                      const answered = session.selectedOptionId !== null

                      let extraClass = ""
                      if (answered) {
                        if (isCorrect) {
                          extraClass =
                            "border-emerald-400/60 bg-emerald-50 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                        } else if (isSelected) {
                          extraClass =
                            "border-red-400/60 bg-red-50 text-red-800 hover:bg-red-50 dark:border-red-700/60 dark:bg-red-950/40 dark:text-red-300"
                        }
                      }

                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={answered || isUpdating}
                          onClick={() => handleOptionSelect(option)}
                          className={cn(
                            "flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-5 py-3 text-left text-base font-medium backdrop-blur-sm transition-all",
                            !answered && !isUpdating && "hover:border-primary/30 hover:bg-primary/5 active:scale-[0.98]",
                            answered && !isCorrect && !isSelected && "opacity-40",
                            extraClass
                          )}
                        >
                          {answered && isCorrect ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                          ) : null}
                          {answered && isSelected && !isCorrect ? (
                            <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                          ) : null}
                          <span className="break-words">{option.word}</span>
                        </button>
                      )
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                      這一輪沒有足夠的單字可以產生選項，請先切換成拼寫練習或匯入更多單字。
                    </div>
                  )}
                </div>
              ) : null}

              {session.mode === "spelling" ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground/70">
                    {currentWord.part_of_speech ? (
                      <span className="rounded-full bg-primary/8 px-2.5 py-0.5 text-xs font-medium text-primary/80">
                        {currentWord.part_of_speech}
                      </span>
                    ) : null}
                    <span>{currentWord.word.length} 個字母</span>
                  </div>

                  <div className="flex gap-3">
                    <Input
                      ref={spellingInputRef}
                      type="text"
                      placeholder="輸入英文單字…"
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      value={session.spellingInput}
                      disabled={session.spellingSubmitted}
                      onChange={(e) =>
                        setSession({ ...session, spellingInput: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !session.spellingSubmitted) {
                          handleSpellingSubmit()
                        }
                        if (e.key === "Enter" && session.spellingSubmitted) {
                          void handleNextWord()
                        }
                      }}
                      className={cn(
                        "h-14 rounded-2xl border-border/60 bg-card/60 px-5 text-center text-lg font-medium tracking-wide backdrop-blur-sm transition-all",
                        session.spellingSubmitted && session.pendingRating === "easy" && "border-emerald-400/60 bg-emerald-50 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-300",
                        session.spellingSubmitted && session.pendingRating === "hard" && "border-red-400/60 bg-red-50 text-red-800 dark:border-red-700/60 dark:bg-red-950/40 dark:text-red-300"
                      )}
                    />
                  </div>

                  {!session.spellingSubmitted ? (
                    <button
                      type="button"
                      disabled={session.spellingInput.trim().length === 0}
                      onClick={handleSpellingSubmit}
                      className={cn(
                        "h-12 w-full rounded-2xl bg-primary/90 text-sm font-medium text-primary-foreground transition-all hover:bg-primary active:scale-[0.98]",
                        session.spellingInput.trim().length === 0 && "cursor-not-allowed opacity-40"
                      )}
                    >
                      確認拼寫
                    </button>
                  ) : null}

                  {session.spellingSubmitted && session.pendingRating === "hard" ? (
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">正確拼法</p>
                      <p className="mt-1 text-2xl font-semibold tracking-wide text-foreground">
                        {currentWord.word}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {hasAnswered && session.mode !== "flashcard" ? (
                <AnsweredWordCard currentWord={currentWord} rating={session.pendingRating} />
              ) : null}

              {hasAnswered ? (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => void handleNextWord()}
                  className="h-12 w-full rounded-2xl bg-foreground/90 text-sm font-medium text-background transition-all hover:bg-foreground active:scale-[0.98] disabled:opacity-40 dark:bg-foreground/80 dark:hover:bg-foreground/90"
                >
                  {isUpdating ? "更新中..." : isLastCard ? "完成本輪" : "下一題"}
                </button>
              ) : null}
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {session && !currentWord && mounted ? createPortal(
        <CompletionScreen
          session={session}
          sessionStartedAt={sessionStartedAtRef.current}
          onEnd={() => endSession()}
          onRestart={() => {
            endSession()
            void startSession()
          }}
        />,
        document.body
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>單字清單</CardTitle>
          <CardDescription>查看目前單字狀態與下次複習時間。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="search"
            placeholder="搜尋單字或中文意思…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9"
          />
          {filteredWords.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              目前沒有符合條件的單字。
            </div>
          ) : (
            pagedWords.map((word) => (
              <div key={word.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold">{word.word}</div>
                      {word.part_of_speech ? (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                          {word.part_of_speech}
                        </span>
                      ) : null}
                      <VocabularyPronunciationButton
                        text={word.word}
                        label="發音"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        showPhonetic
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">{word.meaning}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{word.list_name}</Badge>
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
                  下次複習：{" "}
                  {word.next_review_date ? format(new Date(word.next_review_date), "yyyy/MM/dd") : "尚未安排"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  SRS：間隔 {word.interval_days.toFixed(1)} 天 • EF {word.ease_factor.toFixed(2)} • 累計 {word.review_count} 次
                </div>
              </div>
            ))
          )}
          {totalWordPages > 1 ? (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                第 {wordListPage} / {totalWordPages} 頁，共 {filteredWords.length} 個
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={wordListPage <= 1}
                  onClick={() => setWordListPage((p) => p - 1)}
                >
                  上一頁
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={wordListPage >= totalWordPages}
                  onClick={() => setWordListPage((p) => p + 1)}
                >
                  下一頁
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function AnsweredWordCard({
  currentWord,
  rating,
}: {
  currentWord: VocabularyQueueItem
  rating: VocabularyReviewRating | null
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/40 bg-card/50 p-5 backdrop-blur-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
      <p
        className={cn(
          "text-sm font-semibold",
          rating === "easy"
            ? "text-emerald-700 dark:text-emerald-400"
            : rating === "okay"
              ? "text-foreground"
              : "text-red-700 dark:text-red-400"
        )}
      >
        {rating === "easy" ? "答對了 / 很熟" : rating === "okay" ? "普通" : "需要再複習"}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {currentWord.part_of_speech ? (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
            {currentWord.part_of_speech}
          </span>
        ) : null}
        <span className="text-lg font-semibold">{currentWord.word}</span>
        <VocabularyPronunciationButton text={currentWord.word} showPhonetic />
      </div>

      {currentWord.example_sentence ? (
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground/70">例句</div>
          <div className="text-sm leading-relaxed">
            <HighlightedExample sentence={currentWord.example_sentence} word={currentWord.word} />
          </div>
          {currentWord.example_sentence_translation ? (
            <div className="mt-1.5 text-xs italic text-muted-foreground/60">
              {currentWord.example_sentence_translation}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function CompletionScreen({
  session,
  sessionStartedAt,
  onEnd,
  onRestart,
}: {
  session: VocabularySessionState
  sessionStartedAt: number | null
  onEnd: () => void
  onRestart: () => void
}) {
  const totalReviewed = session.reviewedCount
  const correctCount = session.correctCount
  const hardCount = session.hardCount
  const accuracyPct = totalReviewed > 0 ? Math.round((correctCount / totalReviewed) * 100) : 0
  const elapsedMin =
    sessionStartedAt !== null ? Math.round((Date.now() - sessionStartedAt) / 60000) : 0

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,var(--primary)_5%,transparent)_0%,transparent_60%)]" />
      <div className="relative space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
          <Check className="h-8 w-8" />
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">本輪完成</h2>
          <p className="text-sm text-muted-foreground">你已完成 {totalReviewed} 個單字的複習。</p>
          <div className="flex items-center justify-center gap-6 py-1">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{correctCount}</div>
              <div className="text-xs text-muted-foreground">答對</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500 dark:text-red-400">{hardCount}</div>
              <div className="text-xs text-muted-foreground">加強</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <div className="text-2xl font-bold">{accuracyPct}%</div>
              <div className="text-xs text-muted-foreground">正確率</div>
            </div>
          </div>
          {elapsedMin >= 1 ? (
            <p className="text-xs text-muted-foreground/70">學習用時約 {elapsedMin} 分鐘。</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button type="button" onClick={onRestart} variant="outline" className="rounded-2xl px-6">
            再來一輪
          </Button>
          <Button type="button" onClick={onEnd} className="rounded-2xl px-6">
            <Sparkles className="mr-2 h-4 w-4" />
            回到單字列表
          </Button>
        </div>
      </div>
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
