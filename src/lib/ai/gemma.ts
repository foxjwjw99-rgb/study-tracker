/**
 * Google Gemma 4 API 整合層
 * 集中 API 呼叫、token 限制、error handling
 */

interface GemmaResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string
        thought?: boolean
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
    const parts = data.candidates?.[0]?.content?.parts ?? []
    const text = parts
      .filter((p) => !p.thought)
      .map((p) => p.text)
      .join('')
      .trim()

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
  existingExplanation?: string,
  subject?: string
): Promise<string> {
  const teacherDesc = subject ? `你是一位${subject}老師` : `你是一位老師`
  let prompt = `${teacherDesc}，請為以下選擇題撰寫一份清晰的解析，幫助學生理解解題思路。\n\n`

  if (existingExplanation) {
    prompt += `參考簡解（請以此為基礎擴展說明）：${existingExplanation}\n\n`
  }

  prompt += `題目：${question}\n`

  if (options && options.length > 0) {
    prompt += `選項：\n${options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join('\n')}\n`
  }

  prompt += `正確答案：${correctAnswer}\n\n`
  prompt += `撰寫要求：\n`
  prompt += `1. 先說明已知條件與解題目標\n`
  prompt += `2. 條理清晰地展示解題步驟（若有多種解法，可簡述第二種方法）\n`
  prompt += `3. 說明每個關鍵步驟的依據（公式、定理、概念、規則）\n`
  prompt += `4. 最後點明正確選項\n`
  prompt += `5. 使用繁體中文，字數 200-300 字\n\n`
  prompt += `直接輸出解析文字，不要加任何標題、標記、或思考過程。`

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

/**
 * 建議單題應屬的單元
 */
export async function suggestUnitForQuestion(
  topic: string,
  questionText: string,
  availableUnits: Array<{ id: string; name: string; aliases: string[] }>
): Promise<UnitSuggestion | null> {
  if (availableUnits.length === 0) {
    return null
  }

  const unitChoices = availableUnits
    .map((u) => `- ${u.name} (別名: ${u.aliases.join(', ') || '無'})`)
    .join('\n')

  const prompt = `根據以下題目資訊，選擇最合適的學習單元。

當前 topic: ${topic}
題目: ${questionText.substring(0, 300)}

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

export interface WeakTopicStat {
  subjectName: string
  topic: string
  wrongCount: number
  carelessCount: number
  practiceTotal: number | null
  practiceCorrect: number | null
}

/**
 * 生成跨科目弱點診斷報告
 */
export async function generateWeaknessDiagnosis(stats: WeakTopicStat[]): Promise<string> {
  const wrongLines = stats
    .filter((s) => s.wrongCount > 0)
    .slice(0, 10)
    .map((s) => {
      const careless = s.carelessCount > 0 ? `（粗心 ${s.carelessCount} 題）` : ''
      return `- ${s.subjectName} ／ ${s.topic}：未解決錯題 ${s.wrongCount} 題${careless}`
    })
    .join('\n')

  const practiceLines = stats
    .filter((s) => s.practiceTotal !== null && s.practiceTotal >= 5)
    .slice(0, 10)
    .map((s) => {
      const accuracy = Math.round(((s.practiceCorrect ?? 0) / (s.practiceTotal ?? 1)) * 100)
      return `- ${s.subjectName} ／ ${s.topic}：準確率 ${accuracy}%（共 ${s.practiceTotal} 題）`
    })
    .join('\n')

  let prompt = `你是一位學習診斷專家。根據以下學習數據，請提供跨科目的弱點診斷報告。\n\n`

  if (wrongLines) {
    prompt += `【未解決的錯題（按主題）】\n${wrongLines}\n\n`
  }

  if (practiceLines) {
    prompt += `【最近30天練習準確率】\n${practiceLines}\n\n`
  }

  prompt += `請診斷：\n`
  prompt += `1. 最需要優先補強的 2-3 個弱點（整合錯題與準確率資料）\n`
  prompt += `2. 每個弱點的根本原因（粗心／概念不清／計算失誤／未複習）\n`
  prompt += `3. 具體可執行的改善建議\n\n`
  prompt += `使用繁體中文，300-400 字，直接輸出診斷報告，不要加標題或標記。`

  return callGemmaAPI(prompt)
}
