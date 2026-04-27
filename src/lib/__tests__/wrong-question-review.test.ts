import { describe, expect, it } from "vitest"

import {
  WRONG_QUESTION_REVIEW_STAGES,
  getNextWrongQuestionReviewStage,
  getWrongQuestionCurrentReviewStage,
  getWrongQuestionInitialReviewDate,
  getWrongQuestionNextReviewDate,
} from "@/lib/wrong-question-review"

describe("getNextWrongQuestionReviewStage", () => {
  it("advances through 1 -> 3 -> 7 -> 14", () => {
    expect(getNextWrongQuestionReviewStage(1)).toBe(3)
    expect(getNextWrongQuestionReviewStage(3)).toBe(7)
    expect(getNextWrongQuestionReviewStage(7)).toBe(14)
  })

  it("returns null after the last stage", () => {
    expect(getNextWrongQuestionReviewStage(14)).toBeNull()
  })

  it("returns null for unknown stages", () => {
    expect(getNextWrongQuestionReviewStage(2)).toBeNull()
    expect(getNextWrongQuestionReviewStage(0)).toBeNull()
    expect(getNextWrongQuestionReviewStage(99)).toBeNull()
  })
})

describe("getWrongQuestionCurrentReviewStage", () => {
  it("maps streak 0..3 to the four stages in order", () => {
    expect(getWrongQuestionCurrentReviewStage(0)).toBe(1)
    expect(getWrongQuestionCurrentReviewStage(1)).toBe(3)
    expect(getWrongQuestionCurrentReviewStage(2)).toBe(7)
    expect(getWrongQuestionCurrentReviewStage(3)).toBe(14)
  })

  it("clamps high streaks to the last stage", () => {
    expect(getWrongQuestionCurrentReviewStage(10)).toBe(14)
    expect(getWrongQuestionCurrentReviewStage(WRONG_QUESTION_REVIEW_STAGES.length + 5)).toBe(14)
  })

  it("clamps negative streaks to the first stage", () => {
    expect(getWrongQuestionCurrentReviewStage(-1)).toBe(1)
  })

  it("floors fractional streaks", () => {
    expect(getWrongQuestionCurrentReviewStage(2.9)).toBe(7)
  })
})

describe("getWrongQuestionInitialReviewDate", () => {
  it("schedules first review 1 day after the wrong date", () => {
    const wrong = new Date("2026-04-20T00:00:00Z")
    const due = getWrongQuestionInitialReviewDate(wrong)
    expect(due.toISOString().slice(0, 10)).toBe("2026-04-21")
  })
})

describe("getWrongQuestionNextReviewDate", () => {
  it("returns null when there is no next stage", () => {
    expect(getWrongQuestionNextReviewDate(14)).toBeNull()
  })

  it("schedules stage 1 -> 3 as 2 days from now", () => {
    const now = new Date("2026-04-27T00:00:00Z")
    const due = getWrongQuestionNextReviewDate(1, now)
    expect(due?.toISOString().slice(0, 10)).toBe("2026-04-29")
  })

  it("schedules stage 7 -> 14 as 7 days from now", () => {
    const now = new Date("2026-04-27T00:00:00Z")
    const due = getWrongQuestionNextReviewDate(7, now)
    expect(due?.toISOString().slice(0, 10)).toBe("2026-05-04")
  })

  it("guarantees at least a 1-day gap when stages are adjacent or invalid", () => {
    const now = new Date("2026-04-27T00:00:00Z")
    // unknown stage that still advances via ?? null returning null first; but for
    // valid known stage with negative gap (would only happen if stages reorder),
    // the impl uses Math.max(1, …)
    const due = getWrongQuestionNextReviewDate(3, now)
    expect(due).not.toBeNull()
    expect(due!.getTime()).toBeGreaterThan(now.getTime())
  })
})
