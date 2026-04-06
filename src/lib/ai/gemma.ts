/**
 * Google Gemma 4 API 整合層
 * 集中 API 呼叫、token 限制、error handling
 */

interface GemmaResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string
      }>
    }
  }>
}

const GEMMA_API_KEY = process.env.GOOGLE_GEMMA_API_KEY
const GEMMA_MODEL = process.env.GOOGLE_GEMMA_MODEL || 'gemma-4-31b-it'
const GEMMA_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * 呼叫 Gemma 4 API 生成文本
 */
export async function callGemmaAPI(prompt: string): Promise<string> {
  if (!GEMMA_API_KEY) {
    throw new Error('GOOGLE_GEMMA_API_KEY 未設定')
  }

  const url = `${GEMMA_BASE_URL}/${GEMMA_MODEL}:generateContent?key=${GEMMA_API_KEY}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      }),
      timeout: 30000,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Gemma API 錯誤 (${response.status}): ${error}`)
    }

    const data = (await response.json()) as GemmaResponse
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      throw new Error('Gemma API 無回應內容')
    }

    return text
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`呼叫 Gemma 4 失敗: ${error.message}`)
    }
    throw error
  }
}

/**
 * 為單題生成解析
 */
export async function generateQuestionExplanation(
  question: string,
  options: string[] | null,
  correctAnswer: string,
  existingExplanation?: string
): Promise<string> {
  let prompt = `請為以下題目生成簡潔的解析。\n\n`

  if (existingExplanation) {
    prompt += `參考既有解析：${existingExplanation}\n\n`
  }

  prompt += `題目：${question}\n`

  if (options && options.length > 0) {
    prompt += `選項：\n${options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join('\n')}\n`
  }

  prompt += `正確答案：${correctAnswer}\n\n`
  prompt += `請用 200-300 字清楚解釋為什麼這是正確答案。\n\n`
  prompt += `回應格式：直接輸出解析文本，不要添加任何額外的結構、標記或思考過程。`

  return callGemmaAPI(prompt)
}

/**
 * 建議題組應屬的單元
 */
export interface UnitSuggestion {
  unitId: string
  unitName: string
  confidence: number
  reason: string
}

export async function suggestUnitForGroup(
  topic: string,
  context: string,
  availableUnits: Array<{ id: string; name: string; aliases: string[] }>
): Promise<UnitSuggestion | null> {
  if (availableUnits.length === 0) {
    return null
  }

  const unitChoices = availableUnits
    .map((u) => `- ${u.name} (別名: ${u.aliases.join(', ') || '無'})`)
    .join('\n')

  const prompt = `根據以下題組資訊，選擇最合適的學習單元。

題組 topic: ${topic}
題組內容: ${context.substring(0, 200)}...

可選單元：
${unitChoices}

請以 JSON 格式回應，包含：
{
  "unitName": "選中的單元名稱",
  "confidence": 0.75,
  "reason": "為什麼選這個單元的簡短說明"
}

只回應 JSON，不要其他文字。`

  try {
    const response = await callGemmaAPI(prompt)
    const json = JSON.parse(response.trim()) as {
      unitName: string
      confidence: number
      reason: string
    }

    const matched = availableUnits.find((u) => u.name === json.unitName)
    if (!matched) {
      return null
    }

    return {
      unitId: matched.id,
      unitName: json.unitName,
      confidence: Math.min(json.confidence, 1),
      reason: json.reason,
    }
  } catch (error) {
    console.error('AI 單元建議失敗:', error)
    return null
  }
}
