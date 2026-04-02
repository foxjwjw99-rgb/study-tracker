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
  showPhonetic?: boolean
}

// Cache audio object URLs to avoid repeated API calls
const audioUrlCache = new Map<string, string>()

// Cache IPA phonetics
const phoneticCache = new Map<string, string | null>()

async function fetchPhonetic(word: string): Promise<string | null> {
  const key = word.toLowerCase()
  if (phoneticCache.has(key)) return phoneticCache.get(key)!

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`
    )
    if (!res.ok) {
      phoneticCache.set(key, null)
      return null
    }
    const data = await res.json()
    const phonetics: Array<{ text?: string; audio?: string }> = data[0]?.phonetics ?? []
    const phonetic = phonetics.find((p) => p.text?.trim())?.text ?? null
    phoneticCache.set(key, phonetic)
    return phonetic
  } catch {
    phoneticCache.set(key, null)
    return null
  }
}

async function fetchTTSAudioUrl(text: string): Promise<string | null> {
  if (audioUrlCache.has(text)) return audioUrlCache.get(text)!

  try {
    const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}`)
    if (!res.ok) return null
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    audioUrlCache.set(text, url)
    return url
  } catch {
    return null
  }
}

function getVoicesAsync(synthesis: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
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

async function speakWithSynthesis(text: string, onStart: () => void, onEnd: () => void) {
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

  const utterance = new window.SpeechSynthesisUtterance(text)
  utterance.lang = matchedVoice?.lang ?? "en-US"
  utterance.voice = matchedVoice
  utterance.rate = 0.88
  utterance.pitch = 1
  utterance.onstart = onStart
  utterance.onend = onEnd
  utterance.onerror = () => {
    onEnd()
    toast.error("播放發音失敗，請稍後再試。")
  }

  synthesis.speak(utterance)
}

export function VocabularyPronunciationButton({
  text,
  label = "播放發音",
  size = "sm",
  variant = "outline",
  className,
  showPhonetic = false,
}: VocabularyPronunciationButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [supportsSpeech] = useState(
    () =>
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof window.SpeechSynthesisUtterance !== "undefined"
  )
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [phonetic, setPhonetic] = useState<string | null>(null)

  const isSingleWord = !text.trim().includes(" ")

  useEffect(() => {
    if (!isSingleWord || !showPhonetic) return
    fetchPhonetic(text.trim()).then(setPhonetic)
  }, [text, isSingleWord, showPhonetic])

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const handleSpeak = async () => {
    const trimmedText = text.trim()
    if (!trimmedText) return

    if (audioRef.current) {
      audioRef.current.pause()
    }

    // Try Neural2 TTS first
    const ttsUrl = await fetchTTSAudioUrl(trimmedText)
    if (ttsUrl) {
      const audio = new Audio(ttsUrl)
      audioRef.current = audio
      setIsSpeaking(true)
      audio.onended = () => setIsSpeaking(false)
      audio.onerror = async () => {
        // Invalidate cache and fall back to synthesis
        audioUrlCache.delete(trimmedText)
        if (supportsSpeech) {
          await speakWithSynthesis(trimmedText, () => setIsSpeaking(true), () => setIsSpeaking(false))
        } else {
          setIsSpeaking(false)
        }
      }
      try {
        await audio.play()
      } catch {
        setIsSpeaking(false)
      }
      return
    }

    // Fall back to Web Speech API
    if (!supportsSpeech) {
      toast.error("這個瀏覽器目前不支援內建語音。")
      return
    }
    await speakWithSynthesis(trimmedText, () => setIsSpeaking(true), () => setIsSpeaking(false))
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={handleSpeak}
        className={className}
      >
        {isSpeaking ? <Languages className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}
        {isSpeaking ? "播放中..." : label}
      </Button>
      {showPhonetic && phonetic ? (
        <span className="text-xs text-muted-foreground">{phonetic}</span>
      ) : null}
    </span>
  )
}
