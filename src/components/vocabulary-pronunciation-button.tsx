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

type PhoneticResult = {
  audioUrl: string | null
  phonetic: string | null
}

// Cache to avoid repeated API calls for the same word
const phoneticCache = new Map<string, PhoneticResult>()

async function fetchDictionaryPhonetic(word: string): Promise<PhoneticResult> {
  const key = word.toLowerCase()
  if (phoneticCache.has(key)) {
    return phoneticCache.get(key)!
  }

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`
    )
    if (!res.ok) {
      phoneticCache.set(key, { audioUrl: null, phonetic: null })
      return { audioUrl: null, phonetic: null }
    }
    const data = await res.json()
    const entry = data[0]
    if (!entry) {
      phoneticCache.set(key, { audioUrl: null, phonetic: null })
      return { audioUrl: null, phonetic: null }
    }

    const phonetics: Array<{ text?: string; audio?: string }> = entry.phonetics ?? []
    // Prefer a phonetic entry that has both audio and text; fall back to audio-only or text-only
    const withBoth = phonetics.find((p) => p.audio?.trim() && p.text?.trim())
    const withAudio = phonetics.find((p) => p.audio?.trim())
    const withText = phonetics.find((p) => p.text?.trim())

    const best = withBoth ?? withAudio
    const result: PhoneticResult = {
      audioUrl: best?.audio ?? null,
      phonetic: withBoth?.text ?? withText?.text ?? null,
    }
    phoneticCache.set(key, result)
    return result
  } catch {
    phoneticCache.set(key, { audioUrl: null, phonetic: null })
    return { audioUrl: null, phonetic: null }
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

export function VocabularyPronunciationButton({
  text,
  label = "播放發音",
  size = "sm",
  variant = "outline",
  className,
  showPhonetic = false,
}: VocabularyPronunciationButtonProps) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
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

  // Prefetch phonetic for single words
  useEffect(() => {
    if (!isSingleWord || !showPhonetic) return
    fetchDictionaryPhonetic(text.trim()).then((result) => {
      setPhonetic(result.phonetic)
    })
  }, [text, isSingleWord, showPhonetic])

  useEffect(() => {
    return () => {
      if (utteranceRef.current && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  const speakWithSynthesis = async (trimmedText: string) => {
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

  const handleSpeak = async () => {
    if (!supportsSpeech) {
      toast.error("這個瀏覽器目前不支援內建語音。")
      return
    }

    const trimmedText = text.trim()
    if (!trimmedText) return

    // For single words, try real dictionary audio first
    if (isSingleWord) {
      const { audioUrl, phonetic: fetchedPhonetic } = await fetchDictionaryPhonetic(trimmedText)

      if (showPhonetic && fetchedPhonetic) {
        setPhonetic(fetchedPhonetic)
      }

      if (audioUrl) {
        if (audioRef.current) {
          audioRef.current.pause()
        }
        const audio = new Audio(audioUrl)
        audioRef.current = audio
        audio.playbackRate = 0.9
        setIsSpeaking(true)
        audio.onended = () => setIsSpeaking(false)
        audio.onerror = async () => {
          // Fall back to synthesis if audio file fails
          await speakWithSynthesis(trimmedText)
        }
        try {
          await audio.play()
        } catch {
          await speakWithSynthesis(trimmedText)
        }
        return
      }
    }

    // Sentences or words without dictionary audio → use synthesis
    await speakWithSynthesis(trimmedText)
  }

  return (
    <span className="inline-flex items-center gap-1.5">
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
      {showPhonetic && phonetic ? (
        <span className="text-xs text-muted-foreground">{phonetic}</span>
      ) : null}
    </span>
  )
}
