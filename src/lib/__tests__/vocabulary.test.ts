import { describe, expect, it } from "vitest"

import {
  formatVocabularyStatus,
  formatVocabularyTaskTopic,
  getVocabularySchedule,
} from "@/lib/vocabulary"

const baseState = {
  status: "NEW" as const,
  easeFactor: 2.5,
  intervalDays: 0,
  reviewCount: 0,
  lapseCount: 0,
  averageResponseMs: null,
  averageConfidence: null,
  lastReviewedAt: null,
  nextReviewDate: null,
}

const NOW = new Date("2026-04-27T00:00:00Z")

describe("getVocabularySchedule", () => {
  it("hard rating: drops ease factor by 0.2, resets interval to 1 day, increments lapse count", () => {
    const result = getVocabularySchedule({
      ...baseState,
      rating: "hard",
      confidence: 2,
      responseMs: 5000,
      now: NOW,
    })
    expect(result.easeFactor).toBeCloseTo(2.3, 5)
    expect(result.intervalDays).toBe(1)
    expect(result.lapseCount).toBe(1)
    expect(result.nextStatus).toBe("LEARNING")
    expect(result.quality).toBe(2)
  })

  it("easy rating with no prior reviews: schedules 3 days out and bumps ease", () => {
    const result = getVocabularySchedule({
      ...baseState,
      rating: "easy",
      confidence: 5,
      responseMs: 1500,
      now: NOW,
    })
    expect(result.intervalDays).toBe(3)
    expect(result.easeFactor).toBeCloseTo(2.65, 5)
    expect(result.quality).toBe(5)
  })

  it("easy rating after established interval: scales by ease factor", () => {
    const result = getVocabularySchedule({
      ...baseState,
      status: "LEARNING",
      intervalDays: 4,
      reviewCount: 3,
      easeFactor: 2.5,
      rating: "easy",
      confidence: 5,
      responseMs: 1500,
      now: NOW,
    })
    // 4 * 2.5 = 10
    expect(result.intervalDays).toBe(10)
    expect(result.nextStatus).toBe("FAMILIAR")
  })

  it("okay rating after established interval: grows at ~75% of easy rate", () => {
    const result = getVocabularySchedule({
      ...baseState,
      status: "LEARNING",
      intervalDays: 4,
      reviewCount: 3,
      easeFactor: 2.5,
      rating: "okay",
      confidence: 4,
      responseMs: 3000,
      now: NOW,
    })
    // 4 * 2.5 * 0.75 = 7.5
    expect(result.intervalDays).toBe(7.5)
    expect(result.nextStatus).toBe("LEARNING")
    expect(result.quality).toBe(3)
  })

  it("clamps ease factor to [1.3, 3.4]", () => {
    const lowResult = getVocabularySchedule({
      ...baseState,
      easeFactor: 1.4,
      rating: "hard",
      confidence: 1,
      responseMs: 8000,
      now: NOW,
    })
    expect(lowResult.easeFactor).toBeCloseTo(1.3, 5)

    const highResult = getVocabularySchedule({
      ...baseState,
      easeFactor: 3.3,
      reviewCount: 5,
      intervalDays: 5,
      rating: "easy",
      confidence: 5,
      responseMs: 1000,
      now: NOW,
    })
    expect(highResult.easeFactor).toBeCloseTo(3.4, 5)
  })

  it("nextReviewDate is intervalDays after now", () => {
    const result = getVocabularySchedule({
      ...baseState,
      rating: "easy",
      confidence: 5,
      responseMs: 1500,
      now: NOW,
    })
    const expected = new Date("2026-04-30T00:00:00Z")
    expect(result.nextReviewDate.toISOString()).toBe(expected.toISOString())
  })

  it("response time and confidence are recorded as rolling averages", () => {
    const first = getVocabularySchedule({
      ...baseState,
      rating: "okay",
      confidence: 4,
      responseMs: 4000,
      now: NOW,
    })
    expect(first.averageResponseMs).toBe(4000)
    expect(first.averageConfidence).toBe(4)

    const second = getVocabularySchedule({
      ...baseState,
      reviewCount: 1,
      averageResponseMs: 4000,
      averageConfidence: 4,
      rating: "okay",
      confidence: 2,
      responseMs: 8000,
      now: NOW,
    })
    expect(second.averageResponseMs).toBe(6000)
    expect(second.averageConfidence).toBe(3)
  })
})

describe("formatVocabularyStatus", () => {
  it("returns Chinese labels", () => {
    expect(formatVocabularyStatus("NEW")).toBe("新單字")
    expect(formatVocabularyStatus("LEARNING")).toBe("學習中")
    expect(formatVocabularyStatus("FAMILIAR")).toBe("已熟悉")
  })
})

describe("formatVocabularyTaskTopic", () => {
  it("prefixes the word with task label", () => {
    expect(formatVocabularyTaskTopic("hello")).toBe("英文單字：hello")
  })
})
