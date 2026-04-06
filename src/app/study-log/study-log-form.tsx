"use client"

import { useMemo, useRef, useState, useEffect, useCallback } from "react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"
import {
  Bell,
  BellRing,
  CheckCircle2,
  Coffee,
  Pause,
  Play,
  RotateCcw,
  Square,
  TimerReset,
} from "lucide-react"

import { createStudyLog } from "@/app/actions/study-log"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { Subject } from "@/types"

const STUDY_TYPES = ["看書", "做題", "複習", "上課"] as const
const POMODORO_PRESETS = [
  { label: "25 / 5", focusMinutes: 25, breakMinutes: 5 },
  { label: "50 / 10", focusMinutes: 50, breakMinutes: 10 },
  { label: "90 / 15", focusMinutes: 90, breakMinutes: 15 },
] as const
const FOCUS_OPTIONS = [1, 2, 3, 4, 5] as const
const TOPIC_SUGGESTIONS: Record<(typeof STUDY_TYPES)[number], string[]> = {
  看書: ["章節精讀", "觀念整理", "公式 / 定義整理"],
  做題: ["單元題組", "計時刷題", "考古題演練"],
  複習: ["錯題回顧", "間隔複習", "重點快掃"],
  上課: ["課堂筆記整理", "課後例題", "老師補充觀念"],
}
const STORAGE_KEY = "study-tracker-focus-session-v1"

type Mode = "focus" | "manual"
type TimerPhase = "focus" | "break"

type PersistedSession = {
  selectedSubjectId: string
  topic: string
  studyType: (typeof STUDY_TYPES)[number]
  focusScore: string
  plannedDone: boolean
  notes: string
  presetIndex: number
  customFocusMinutes: string
  customBreakMinutes: string
  useCustomPreset: boolean
  isRunning: boolean
  phase: TimerPhase
  remainingSeconds: number
  elapsedFocusSeconds: number
  completedPomodoros: number
  endAt: number | null
  lastUpdatedAt: number
}

export function StudyLogForm({
  subjects,
  todayStudyMinutes,
}: {
  subjects: Subject[]
  todayStudyMinutes: number
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const finishFormRef = useRef<HTMLFormElement>(null)
  const hydratedRef = useRef(false)
  const permissionRequestedRef = useRef(false)
  const phaseRef = useRef<TimerPhase>("focus")
  const endAtRef = useRef<number | null>(null)
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null)

  const [mode, setMode] = useState<Mode>("focus")
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id ?? "")
  const [manualSubjectId, setManualSubjectId] = useState("")
  const [topic, setTopic] = useState("")
  const [studyType, setStudyType] = useState<(typeof STUDY_TYPES)[number]>("看書")
  const [focusScore, setFocusScore] = useState("4")
  const [plannedDone, setPlannedDone] = useState(true)
  const [notes, setNotes] = useState("")

  const [presetIndex, setPresetIndex] = useState(0)
  const [customFocusMinutes, setCustomFocusMinutes] = useState("30")
  const [customBreakMinutes, setCustomBreakMinutes] = useState("5")
  const [useCustomPreset, setUseCustomPreset] = useState(false)

  const [isRunning, setIsRunning] = useState(false)
  const [phase, setPhase] = useState<TimerPhase>("focus")
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60)
  const [elapsedFocusSeconds, setElapsedFocusSeconds] = useState(0)
  const [completedPomodoros, setCompletedPomodoros] = useState(0)
  const [manualDuration, setManualDuration] = useState("")
  const [endAt, setEndAt] = useState<number | null>(null)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default")
  const [showFinishDetails, setShowFinishDetails] = useState(false)

  const timerSettings = useMemo(() => {
    if (useCustomPreset) {
      return {
        label: `${clampMinutes(Number(customFocusMinutes), 30)} / ${clampMinutes(Number(customBreakMinutes), 5)}`,
        focusMinutes: clampMinutes(Number(customFocusMinutes), 30),
        breakMinutes: clampMinutes(Number(customBreakMinutes), 5),
      }
    }

    return POMODORO_PRESETS[presetIndex]
  }, [customBreakMinutes, customFocusMinutes, presetIndex, useCustomPreset])

  // Register Service Worker for timer notifications
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        swRegistrationRef.current = reg
      })
      .catch(() => {
        // SW registration failed – notifications won't work, but timer still functions
      })
  }, [])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    endAtRef.current = endAt
  }, [endAt])

  useEffect(() => {
    if (typeof window === "undefined" || hydratedRef.current) {
      return
    }

    hydratedRef.current = true
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      if (typeof Notification !== "undefined") {
        window.setTimeout(() => setNotificationPermission(Notification.permission), 0)
      }
      return
    }

    try {
      const saved = JSON.parse(raw) as PersistedSession
      const focusMinutes = saved.useCustomPreset
        ? clampMinutes(Number(saved.customFocusMinutes), 30)
        : POMODORO_PRESETS[saved.presetIndex]?.focusMinutes ?? 25
      const breakMinutes = saved.useCustomPreset
        ? clampMinutes(Number(saved.customBreakMinutes), 5)
        : POMODORO_PRESETS[saved.presetIndex]?.breakMinutes ?? 5

      window.setTimeout(() => {
        setSelectedSubjectId(saved.selectedSubjectId || subjects[0]?.id || "")
        setTopic(saved.topic || "")
        setStudyType(saved.studyType || "看書")
        setFocusScore(saved.focusScore || "4")
        setPlannedDone(saved.plannedDone ?? true)
        setNotes(saved.notes || "")
        setPresetIndex(Number.isFinite(saved.presetIndex) ? saved.presetIndex : 0)
        setCustomFocusMinutes(saved.customFocusMinutes || "30")
        setCustomBreakMinutes(saved.customBreakMinutes || "5")
        setUseCustomPreset(Boolean(saved.useCustomPreset))
        setCompletedPomodoros(saved.completedPomodoros || 0)
        setElapsedFocusSeconds(saved.elapsedFocusSeconds || 0)
        setPhase(saved.phase || "focus")
        setIsRunning(Boolean(saved.isRunning))

        if (saved.isRunning && saved.endAt) {
          const now = Date.now()
          const recalculated = recalculateSession(saved, now, { focusMinutes, breakMinutes })
          phaseRef.current = recalculated.phase
          endAtRef.current = recalculated.endAt
          setPhase(recalculated.phase)
          setRemainingSeconds(recalculated.remainingSeconds)
          setElapsedFocusSeconds(recalculated.elapsedFocusSeconds)
          setCompletedPomodoros(recalculated.completedPomodoros)
          setIsRunning(recalculated.isRunning)
          setEndAt(recalculated.endAt)
        } else {
          phaseRef.current = saved.phase === "break" ? "break" : "focus"
          endAtRef.current = null
          setRemainingSeconds(
            typeof saved.remainingSeconds === "number"
              ? saved.remainingSeconds
              : (saved.phase === "focus" ? focusMinutes : breakMinutes) * 60
          )
          setEndAt(null)
        }
      }, 0)
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    }

    if (typeof Notification !== "undefined") {
      window.setTimeout(() => setNotificationPermission(Notification.permission), 0)
    }
  }, [subjects])

  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") {
      return
    }

    const payload: PersistedSession = {
      selectedSubjectId,
      topic,
      studyType,
      focusScore,
      plannedDone,
      notes,
      presetIndex,
      customFocusMinutes,
      customBreakMinutes,
      useCustomPreset,
      isRunning,
      phase,
      remainingSeconds,
      elapsedFocusSeconds,
      completedPomodoros,
      endAt,
      lastUpdatedAt: Date.now(),
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [
    completedPomodoros,
    customBreakMinutes,
    customFocusMinutes,
    elapsedFocusSeconds,
    endAt,
    focusScore,
    isRunning,
    notes,
    phase,
    plannedDone,
    presetIndex,
    remainingSeconds,
    selectedSubjectId,
    studyType,
    topic,
    useCustomPreset,
  ])

  const pushNotification = useCallback(async (title: string, body: string) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      return
    }

    try {
      if (swRegistrationRef.current) {
        await swRegistrationRef.current.showNotification(title, {
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          requireInteraction: true,
          tag: `pomodoro-phase-${Date.now()}`,
        })
        return
      }
    } catch {
      // fall back to page notification
    }

    new Notification(title, { body })
  }, [])

  const clearTimerNotification = useCallback(() => {
    const sw = navigator.serviceWorker?.controller
    if (sw) {
      sw.postMessage({ type: "HIDE_TIMER" })
    }
  }, [])

  const actualFocusSeconds = useMemo(
    () =>
      getActualFocusSeconds({
        elapsedFocusSeconds,
        phase,
        remainingSeconds,
        focusMinutes: timerSettings.focusMinutes,
      }),
    [elapsedFocusSeconds, phase, remainingSeconds, timerSettings.focusMinutes]
  )

  const actualFocusMinutes = useMemo(
    () => getDisplayMinutesFromSeconds(actualFocusSeconds),
    [actualFocusSeconds]
  )

  const advancePhase = useCallback((now: number) => {
    const currentEndAt = endAtRef.current
    if (!currentEndAt || currentEndAt > now) {
      return
    }

    const currentPhase = phaseRef.current
    endAtRef.current = null

    if (currentPhase === "focus") {
      const focusSeconds = timerSettings.focusMinutes * 60
      const nextBreakSeconds = timerSettings.breakMinutes * 60
      const nextEndAt = now + nextBreakSeconds * 1000

      phaseRef.current = "break"
      endAtRef.current = nextEndAt
      setElapsedFocusSeconds((prev) => prev + focusSeconds)
      setCompletedPomodoros((prev) => prev + 1)
      setPhase("break")
      setRemainingSeconds(nextBreakSeconds)
      setEndAt(nextEndAt)
      setIsRunning(true)
      playChime()
      void pushNotification("完成一顆番茄", `休息 ${timerSettings.breakMinutes} 分鐘，再回來繼續。`)
      toast.success(`完成一顆番茄：${timerSettings.focusMinutes} 分鐘專注`, {
        description: `休息 ${timerSettings.breakMinutes} 分鐘，再回來繼續。`,
      })
      return
    }

    const nextFocusSeconds = timerSettings.focusMinutes * 60
    const nextEndAt = now + nextFocusSeconds * 1000
    phaseRef.current = "focus"
    endAtRef.current = nextEndAt
    setPhase("focus")
    setRemainingSeconds(nextFocusSeconds)
    setEndAt(nextEndAt)
    setIsRunning(true)
    playChime(660)
    void pushNotification("休息結束，回到專注模式", `下一輪 ${timerSettings.focusMinutes} 分鐘。`)
    toast("休息結束，回到專注模式", {
      description: `下一輪 ${timerSettings.focusMinutes} 分鐘。`,
    })
  }, [pushNotification, timerSettings.breakMinutes, timerSettings.focusMinutes])

  useEffect(() => {
    if (!isRunning) {
      return
    }

    const interval = window.setInterval(() => {
      const now = Date.now()

      setRemainingSeconds((current) => {
        if (!endAt) {
          return current
        }

        const next = Math.max(0, Math.ceil((endAt - now) / 1000))
        if (next <= 0) {
          window.setTimeout(() => advancePhase(Date.now()), 0)
        }
        return next
      })
    }, 1000)

    const handleVisibility = () => {
      if (!document.hidden && endAt) {
        const now = Date.now()
        const next = Math.max(0, Math.ceil((endAt - now) / 1000))
        setRemainingSeconds(next)
        if (next <= 0) {
          advancePhase(now)
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [advancePhase, endAt, isRunning])

  const sessionMinutes = actualFocusMinutes
  const currentPresetLabel = timerSettings.label
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? null
  const isSessionConfigLocked =
    isRunning || actualFocusSeconds > 0 || completedPomodoros > 0 || phase === "break"

  async function handleManualSubmit(formData: FormData) {
    const subject_id = formData.get("subject_id") as string
    const submittedTopic = (formData.get("topic") as string)?.trim()
    const duration_minutes = Number(formData.get("duration_minutes"))
    const submittedStudyType = formData.get("study_type") as string
    const submittedFocusScore = Number(formData.get("focus_score"))
    const submittedNotes = (formData.get("notes") as string) || ""
    const submittedPlannedDone = formData.get("planned_done") === "on"

    if (!subject_id || !submittedTopic || !duration_minutes || !submittedStudyType || !submittedFocusScore) {
      toast.error("請先把必填欄位補齊。")
      return
    }

    try {
      await createStudyLog({
        subject_id,
        topic: submittedTopic,
        study_date: new Date(),
        duration_minutes,
        study_type: submittedStudyType,
        focus_score: submittedFocusScore,
        planned_done: submittedPlannedDone,
        source_type: "manual",
        notes: submittedNotes,
      })
      toast.success(`已記錄 ${duration_minutes} 分鐘 ${submittedStudyType}`)
      formRef.current?.reset()
      setManualDuration("")
      setMode("focus")
    } catch {
      toast.error("儲存失敗，稍後再試一次。")
    }
  }

  async function handleFinishSession(formData: FormData) {
    const subject_id = formData.get("subject_id") as string
    const submittedTopic = (formData.get("topic") as string)?.trim()
    const submittedStudyType = formData.get("study_type") as string
    const submittedFocusScore = Number(formData.get("focus_score"))
    const submittedNotes = (formData.get("notes") as string) || ""
    const submittedPlannedDone = formData.get("planned_done") === "on"

    const totalMinutes = actualFocusMinutes

    if (!subject_id || !submittedTopic) {
      toast.error("先選科目並填寫主題，才能結束本次專注。")
      return
    }

    if (totalMinutes <= 0) {
      toast.error("這次專注時間還沒開始累積。")
      return
    }

    try {
      await createStudyLog({
        subject_id,
        topic: submittedTopic,
        study_date: new Date(),
        duration_minutes: totalMinutes,
        study_type: submittedStudyType,
        focus_score: submittedFocusScore || 4,
        planned_done: submittedPlannedDone,
        source_type: "timer",
        notes: submittedNotes,
      })

      toast.success(`已記錄 ${totalMinutes} 分鐘 ${submittedStudyType}`, {
        description: completedPomodoros > 0 ? `完成 ${completedPomodoros} 顆番茄。` : "本次專注已加入學習紀錄。",
      })
      resetSession(true)
    } catch {
      toast.error("儲存本次專注失敗。")
    }
  }

  function startTimer() {
    maybeRequestNotificationPermission()
    const nextEndAt = window.performance.timeOrigin + window.performance.now() + remainingSeconds * 1000
    endAtRef.current = nextEndAt
    setIsRunning(true)
    setEndAt(nextEndAt)
  }

  function pauseTimer() {
    clearTimerNotification()
    const currentEndAt = endAtRef.current
    if (!currentEndAt) {
      setIsRunning(false)
      return
    }
    const next = Math.max(0, Math.ceil((currentEndAt - Date.now()) / 1000))
    endAtRef.current = null
    setRemainingSeconds(next)
    setIsRunning(false)
    setEndAt(null)
  }

  function switchPhaseManually(nextPhase: TimerPhase) {
    if (phaseRef.current === "focus" && nextPhase === "break") {
      const partialFocusSeconds = Math.max(0, timerSettings.focusMinutes * 60 - remainingSeconds)
      if (partialFocusSeconds > 0) {
        setElapsedFocusSeconds((prev) => prev + partialFocusSeconds)
      }
    }

    phaseRef.current = nextPhase
    endAtRef.current = null
    setPhase(nextPhase)
    setIsRunning(false)
    setEndAt(null)
    setRemainingSeconds(nextPhase === "focus" ? timerSettings.focusMinutes * 60 : timerSettings.breakMinutes * 60)
  }

  function resetSession(clearForm = false) {
    clearTimerNotification()
    phaseRef.current = "focus"
    endAtRef.current = null
    setIsRunning(false)
    setPhase("focus")
    setRemainingSeconds(timerSettings.focusMinutes * 60)
    setElapsedFocusSeconds(0)
    setCompletedPomodoros(0)
    setEndAt(null)
    setShowFinishDetails(false)
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY)
    }
    if (clearForm) {
      setTopic("")
      setNotes("")
      setFocusScore("4")
      setPlannedDone(true)
      finishFormRef.current?.reset()
      if (subjects[0]) {
        setSelectedSubjectId(subjects[0].id)
      }
      setStudyType("看書")
    }
  }

  function maybeRequestNotificationPermission() {
    if (permissionRequestedRef.current || typeof Notification === "undefined") {
      return
    }
    permissionRequestedRef.current = true
    if (Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        setNotificationPermission(permission)
      })
      return
    }
    setNotificationPermission(Notification.permission)
  }

  return (
    <div className="space-y-6">
      <div className="surface-subtle p-4 sm:p-5">
        <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
          <TabsList className="mb-4 rounded-2xl bg-muted/70 p-1">
            <TabsTrigger value="focus" className="rounded-xl px-4">專注計時</TabsTrigger>
            <TabsTrigger value="manual" className="rounded-xl px-4">手動補登</TabsTrigger>
          </TabsList>

          <TabsContent value="focus" className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">已累積 {todayStudyMinutes} 分鐘</Badge>
              <Badge variant="outline">{completedPomodoros} 顆番茄</Badge>
              <Badge variant="outline">
                {notificationPermission === "granted" ? <BellRing className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
                {notificationPermission === "granted" ? "已開提醒" : "可開提醒"}
              </Badge>
            </div>

            <div className="space-y-4">
                {/* Timer */}
                <div className="rounded-3xl border border-border/70 bg-card/90 p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <Badge variant={phase === "focus" ? "default" : "secondary"}>
                      {phase === "focus" ? "專注中" : "休息中"}
                    </Badge>
                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {currentPresetLabel}
                    </span>
                  </div>

                  <div className="mt-6 text-center">
                    <div className="text-[3.25rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[4.5rem]">
                      {formatClock(remainingSeconds)}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {phase === "focus"
                        ? `專注 ${timerSettings.focusMinutes} 分鐘 · 已累積 ${sessionMinutes} 分鐘`
                        : `休息 ${timerSettings.breakMinutes} 分鐘`}
                    </p>
                  </div>

                  <div className="mt-6 grid gap-2 sm:grid-cols-3">
                    <Button type="button" size="lg" onClick={() => (isRunning ? pauseTimer() : startTimer())}>
                      {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {isRunning ? "暫停" : "開始"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={() => switchPhaseManually(phase === "focus" ? "break" : "focus")}
                    >
                      <Coffee className="h-4 w-4" />
                      切換階段
                    </Button>
                    <Button type="button" variant="ghost" size="lg" onClick={() => resetSession(false)}>
                      <RotateCcw className="h-4 w-4" />
                      重設
                    </Button>
                  </div>
                </div>

                {/* Timer settings — collapsible */}
                <details className="rounded-2xl border border-border/70 bg-background/70">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground select-none">
                    番茄鐘設定（目前 {currentPresetLabel}）
                  </summary>
                  <div className="space-y-3 border-t border-border/50 px-4 py-4">
                    <div className="grid gap-2 sm:grid-cols-3">
                      {POMODORO_PRESETS.map((preset, index) => (
                        <button
                          key={preset.label}
                          type="button"
                          disabled={isSessionConfigLocked}
                          onClick={() => {
                            setUseCustomPreset(false)
                            setPresetIndex(index)
                            if (!isRunning) {
                              setPhase("focus")
                              setRemainingSeconds(preset.focusMinutes * 60)
                              setEndAt(null)
                            }
                          }}
                          className={cn(
                            "rounded-xl border px-3 py-2.5 text-left text-sm transition-all disabled:cursor-not-allowed disabled:opacity-50",
                            !useCustomPreset && presetIndex === index
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-border/70 bg-background/80 hover:border-primary/20"
                          )}
                        >
                          <span className="font-medium">{preset.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="custom_focus" className="text-xs">專注</Label>
                        <Input
                          id="custom_focus"
                          type="number"
                          min="1"
                          value={customFocusMinutes}
                          onChange={(event) => setCustomFocusMinutes(event.target.value)}
                          disabled={isSessionConfigLocked}
                          className="h-9 w-20"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="custom_break" className="text-xs">休息</Label>
                        <Input
                          id="custom_break"
                          type="number"
                          min="1"
                          value={customBreakMinutes}
                          onChange={(event) => setCustomBreakMinutes(event.target.value)}
                          disabled={isSessionConfigLocked}
                          className="h-9 w-20"
                        />
                      </div>
                      <Button
                        type="button"
                        variant={useCustomPreset ? "default" : "outline"}
                        size="sm"
                        disabled={isSessionConfigLocked}
                        onClick={() => {
                          setUseCustomPreset(true)
                          if (!isRunning) {
                            setPhase("focus")
                            setRemainingSeconds(clampMinutes(Number(customFocusMinutes), 30) * 60)
                            setEndAt(null)
                          }
                        }}
                      >
                        套用自訂
                      </Button>
                    </div>

                    {isSessionConfigLocked ? (
                      <p className="text-xs text-muted-foreground">
                        Session 進行中，設定先鎖定。重設後才能調整。
                      </p>
                    ) : null}
                  </div>
                </details>
              </div>

              <form ref={finishFormRef} action={handleFinishSession} className="space-y-4 rounded-3xl border border-border/70 bg-background/70 p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">結束這輪 session</h4>
                    <p className="mt-1 text-sm text-muted-foreground">先填科目、主題、模式就能直接存；專注度和備註改成選填，少一點摩擦。</p>
                  </div>
                  <Badge variant="outline">預計儲存 {sessionMinutes} 分鐘</Badge>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="focus_subject">科目</Label>
                    <Select
                      name="subject_id"
                      value={selectedSubjectId}
                      onValueChange={(value) => setSelectedSubjectId(value ?? "")}
                      required
                    >
                      <SelectTrigger id="focus_subject" className="h-11 w-full rounded-2xl bg-background/85 px-3">
                        <SelectValue placeholder="選擇科目">
                          {selectedSubject?.name ?? "選擇科目"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="focus_topic">單元 / 主題</Label>
                    <Input
                      id="focus_topic"
                      name="topic"
                      value={topic}
                      onChange={(event) => setTopic(event.target.value)}
                      placeholder="例如：個體需求彈性、總體 IS-LM、英單 Unit 3"
                      className="h-11 rounded-2xl bg-background/85 px-3"
                      required
                    />
                    <div className="flex flex-wrap gap-2 pt-1">
                      {TOPIC_SUGGESTIONS[studyType].map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setTopic(item)}
                          className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>學習模式</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {STUDY_TYPES.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setStudyType(item)}
                        className={cn(
                          "rounded-2xl border px-3 py-3 text-sm font-medium transition-all duration-200",
                          studyType === item
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border/70 bg-background/80 text-foreground hover:border-primary/20 hover:bg-background"
                        )}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" name="study_type" value={studyType} />
                </div>

                <div className="rounded-2xl border border-dashed border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  預設會以 <span className="font-medium text-foreground">專注度 {focusScore} / 5</span> 儲存；如果想補備註或調整完成度，再展開下面的選填欄位就好。
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <SubmitButton label="直接儲存本次專注" icon={Square} />
                  <Button type="button" variant="outline" size="lg" onClick={() => setShowFinishDetails((value) => !value)}>
                    {showFinishDetails ? "收起補充欄位" : "補充專注度 / 備註（選填）"}
                  </Button>
                </div>

                <div className={cn("space-y-4", !showFinishDetails && "hidden")}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="focus_score">專注度</Label>
                      <Select
                        name="focus_score"
                        value={focusScore}
                        onValueChange={(value) => setFocusScore(value ?? "4")}
                        required
                      >
                        <SelectTrigger id="focus_score" className="h-11 w-full rounded-2xl bg-background/85 px-3">
                          <SelectValue placeholder="選擇專注度" />
                        </SelectTrigger>
                        <SelectContent>
                          {FOCUS_OPTIONS.map((score) => (
                            <SelectItem key={score} value={score.toString()}>{score} / 5</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="focus_notes">備註</Label>
                      <Input
                        id="focus_notes"
                        name="notes"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="例如：今天狀態不錯，第二輪後進入心流"
                        className="h-11 rounded-2xl bg-background/85 px-3"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/70 px-4 py-3">
                    <input
                      type="checkbox"
                      name="planned_done"
                      checked={plannedDone}
                      onChange={(event) => setPlannedDone(event.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-sm font-medium text-foreground">這次有完成原本預定的進度</span>
                  </label>
                </div>

                <Button type="button" variant="ghost" size="lg" onClick={() => resetSession(false)}>
                  <TimerReset className="h-4 w-4" />
                  只重置計時，不儲存
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="manual">
              <form ref={formRef} action={handleManualSubmit} className="space-y-4 rounded-3xl border border-border/70 bg-background/70 p-4 sm:p-5">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">手動補登</h3>
                  <p className="mt-1 text-sm text-muted-foreground">如果剛剛沒有用計時器，也可以直接補一筆進來。</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="manual_subject">科目</Label>
                    <Select name="subject_id" value={manualSubjectId} onValueChange={(value) => setManualSubjectId(value ?? "")} required>
                      <SelectTrigger id="manual_subject" className="h-11 w-full rounded-2xl bg-background/85 px-3">
                        <SelectValue placeholder="選擇科目">
                          {subjects.find((s) => s.id === manualSubjectId)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual_topic">單元 / 主題</Label>
                    <Input id="manual_topic" name="topic" list="manual-topic-suggestions" placeholder="例如：經濟學考古題、英文克漏字練習" className="h-11 rounded-2xl bg-background/85 px-3" required />
                    <datalist id="manual-topic-suggestions">
                      <option value="考古題演練" />
                      <option value="錯題訂正" />
                      <option value="觀念整理" />
                      <option value="章節複習" />
                      <option value="公式 / 定義整理" />
                    </datalist>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="manual_duration">時長（分鐘）</Label>
                    <Input
                      id="manual_duration"
                      name="duration_minutes"
                      type="number"
                      min="1"
                      placeholder="45"
                      value={manualDuration}
                      onChange={(event) => setManualDuration(event.target.value)}
                      className="h-11 rounded-2xl bg-background/85 px-3"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual_study_type">學習模式</Label>
                    <Select name="study_type" required>
                      <SelectTrigger id="manual_study_type" className="h-11 w-full rounded-2xl bg-background/85 px-3">
                        <SelectValue placeholder="選擇模式" />
                      </SelectTrigger>
                      <SelectContent>
                        {STUDY_TYPES.map((item) => (
                          <SelectItem key={item} value={item}>{item}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="manual_focus_score">專注度</Label>
                    <Select name="focus_score" required>
                      <SelectTrigger id="manual_focus_score" className="h-11 w-full rounded-2xl bg-background/85 px-3">
                        <SelectValue placeholder="選擇專注度" />
                      </SelectTrigger>
                      <SelectContent>
                        {FOCUS_OPTIONS.map((score) => (
                          <SelectItem key={score} value={score.toString()}>{score} / 5</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual_notes">備註</Label>
                    <Input id="manual_notes" name="notes" placeholder="例如：有點分心，但還是把題目做完" className="h-11 rounded-2xl bg-background/85 px-3" />
                  </div>
                </div>

                <label className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/70 px-4 py-3">
                  <input type="checkbox" name="planned_done" defaultChecked className="h-4 w-4 rounded border-border" />
                  <span className="text-sm font-medium text-foreground">這次有完成原本預定的進度</span>
                </label>

                <SubmitButton label="儲存手動紀錄" icon={CheckCircle2} />
              </form>
            </TabsContent>
          </Tabs>
        </div>
    </div>
  )
}

function SubmitButton({
  label,
  icon: Icon,
}: {
  label: string
  icon: typeof CheckCircle2
}) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      <Icon className="h-4 w-4" />
      {pending ? "儲存中..." : label}
    </Button>
  )
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function getActualFocusSeconds({
  elapsedFocusSeconds,
  phase,
  remainingSeconds,
  focusMinutes,
}: {
  elapsedFocusSeconds: number
  phase: TimerPhase
  remainingSeconds: number
  focusMinutes: number
}) {
  if (phase !== "focus") {
    return elapsedFocusSeconds
  }

  const focusWindowSeconds = focusMinutes * 60
  const partialFocusSeconds = Math.max(0, focusWindowSeconds - remainingSeconds)
  return elapsedFocusSeconds + partialFocusSeconds
}

function getDisplayMinutesFromSeconds(totalSeconds: number) {
  if (totalSeconds <= 0) {
    return 0
  }

  return Math.max(1, Math.floor(totalSeconds / 60))
}

function clampMinutes(value: number, fallback: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback
  }

  return Math.min(Math.max(Math.round(value), 1), 180)
}

function recalculateSession(
  saved: PersistedSession,
  now: number,
  settings: { focusMinutes: number; breakMinutes: number }
) {
  let phase = saved.phase
  let elapsedFocusSeconds = saved.elapsedFocusSeconds || 0
  let completedPomodoros = saved.completedPomodoros || 0
  let cursorEndAt = saved.endAt ?? now
  let guard = 0

  while (cursorEndAt <= now && guard < 20) {
    if (phase === "focus") {
      elapsedFocusSeconds += settings.focusMinutes * 60
      completedPomodoros += 1
      phase = "break"
      cursorEndAt += settings.breakMinutes * 60 * 1000
    } else {
      phase = "focus"
      cursorEndAt += settings.focusMinutes * 60 * 1000
    }
    guard += 1
  }

  return {
    phase,
    elapsedFocusSeconds,
    completedPomodoros,
    remainingSeconds: Math.max(0, Math.ceil((cursorEndAt - now) / 1000)),
    isRunning: true,
    endAt: cursorEndAt,
  }
}

function playChime(frequency = 880) {
  if (typeof window === "undefined") {
    return
  }

  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) {
    return
  }

  const context = new AudioContextClass()
  const oscillator = context.createOscillator()
  const gainNode = context.createGain()

  oscillator.type = "sine"
  oscillator.frequency.value = frequency
  gainNode.gain.value = 0.0001

  oscillator.connect(gainNode)
  gainNode.connect(context.destination)

  const currentTime = context.currentTime
  gainNode.gain.exponentialRampToValueAtTime(0.12, currentTime + 0.02)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, currentTime + 0.5)

  oscillator.start(currentTime)
  oscillator.stop(currentTime + 0.55)
  oscillator.onended = () => {
    context.close().catch(() => undefined)
  }
}
