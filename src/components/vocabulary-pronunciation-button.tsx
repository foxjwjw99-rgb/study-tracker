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

  const getVoicesAsync = (synthesis: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> => {
    return new Promise((resolve) => {
      const voices = synthesis.getVoices()
      if (voices.length > 0) {
        resolve(voices)
        return
      }
      const onVoicesChanged = () => {
        synthesis.removeEventListener("voiceschanged", onVoicesChanged)
        resolve(synthesis.getVoices())
      }
      synthesis.addEventListener("voiceschanged", onVoicesChanged)
    })
  }

  const handleSpeak = async () => {
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

    const voices = await getVoicesAsync(synthesis)
    const enUSVoices = voices.filter((v) => v.lang === "en-US")
    const matchedVoice =
      enUSVoices.find((v) => v.name.includes("Aria")) ??
      enUSVoices.find((v) => v.name.includes("Natural")) ??
      enUSVoices.find((v) => v.name.includes("Google US English")) ??
      enUSVoices.find((v) => v.name.includes("Online")) ??
      enUSVoices[0] ??
      voices.find((v) => v.lang.startsWith("en")) ??
      null

    const utterance = new window.SpeechSynthesisUtterance(trimmedText)
    utterance.lang = matchedVoice?.lang ?? "en-US"
    utterance.voice = matchedVoice
    utterance.rate = 0.88
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
