"use client"

import { useEffect, useRef, useState } from "react"
import { Languages, Volume2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

type VocabularyPronunciationButtonProps = {
  text: string
  label?: string
  size?: "sm" | "default"
  variant?: "outline" | "ghost" | "secondary"
  className?: string
}

export function VocabularyPronunciationButton({
  text,
  label = "播放發音",
  size = "sm",
  variant = "outline",
  className,
}: VocabularyPronunciationButtonProps) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const [supportsSpeech] = useState(
    () =>
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof window.SpeechSynthesisUtterance !== "undefined"
  )
  const [isSpeaking, setIsSpeaking] = useState(false)

  useEffect(() => {
    return () => {
      if (utteranceRef.current && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const handleSpeak = () => {
    if (!supportsSpeech) {
      toast.error("這個瀏覽器目前不支援內建語音。")
      return
    }

    const trimmedText = text.trim()
    if (!trimmedText) {
      return
    }

    const synthesis = window.speechSynthesis
    synthesis.cancel()

    const utterance = new window.SpeechSynthesisUtterance(trimmedText)
    const voices = synthesis.getVoices()
    const matchedVoice =
      voices.find((voice) => voice.lang === "en-US") ??
      voices.find((voice) => voice.lang.startsWith("en")) ??
      null

    utterance.lang = matchedVoice?.lang ?? "en-US"
    utterance.voice = matchedVoice
    utterance.rate = 0.92
    utterance.pitch = 1
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => {
      setIsSpeaking(false)
      toast.error("播放發音失敗，請稍後再試。")
    }

    utteranceRef.current = utterance
    synthesis.speak(utterance)
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={handleSpeak}
      disabled={!supportsSpeech}
      className={className}
    >
      {isSpeaking ? <Languages className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}
      {isSpeaking ? "播放中..." : label}
    </Button>
  )
}
