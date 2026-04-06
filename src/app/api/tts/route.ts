import { NextRequest, NextResponse } from "next/server"

const GOOGLE_TTS_URL =
  "https://texttospeech.googleapis.com/v1/text:synthesize"

// In-memory cache: text → base64 MP3
const audioCache = new Map<string, string>()

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_TTS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "TTS not configured" }, { status: 503 })
  }

  const text = request.nextUrl.searchParams.get("text")?.trim()
  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 })
  }

  const cached = audioCache.get(text)
  if (cached) {
    const audioBuffer = Buffer.from(cached, "base64")
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    })
  }

  const res = await fetch(`${GOOGLE_TTS_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: {
        languageCode: "en-US",
        name: "en-US-Neural2-F",
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 0.9,
        pitch: 0,
      },
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    console.error("Google TTS error:", error)
    return NextResponse.json({ error: "TTS request failed" }, { status: 502 })
  }

  const data = await res.json()
  const audioContent: string = data.audioContent
  audioCache.set(text, audioContent)

  const audioBuffer = Buffer.from(audioContent, "base64")
  return new NextResponse(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
