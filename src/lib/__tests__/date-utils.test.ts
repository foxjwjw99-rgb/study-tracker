import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  formatDateTimeInTaipei,
  formatShortDateInTaipei,
  getEndOfTodayUTC,
  getStartOfDayInTaipeiUTC,
  getStartOfDaysAgoUTC,
  getStartOfTodayUTC,
  getStartOfWeekUTC,
} from "@/lib/date-utils"

// Asia/Taipei = UTC+8. A UTC instant of 2026-04-26T18:00:00Z corresponds to
// 2026-04-27 02:00 Taipei time. The "start of today in Taipei" should be
// 2026-04-26T16:00:00Z (which is 00:00 of 2026-04-27 Taipei).
const FROZEN_NOW = new Date("2026-04-26T18:00:00Z")

describe("date-utils (Asia/Taipei boundaries)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FROZEN_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("getStartOfTodayUTC returns 00:00 Taipei = 16:00 UTC of previous day", () => {
    expect(getStartOfTodayUTC().toISOString()).toBe("2026-04-26T16:00:00.000Z")
  })

  it("getEndOfTodayUTC returns 23:59:59.999 Taipei = 15:59:59.999 UTC", () => {
    expect(getEndOfTodayUTC().toISOString()).toBe("2026-04-27T15:59:59.999Z")
  })

  it("getStartOfDaysAgoUTC(6) returns 7 days back of start-of-today", () => {
    expect(getStartOfDaysAgoUTC(6).toISOString()).toBe("2026-04-20T16:00:00.000Z")
  })

  it("getStartOfWeekUTC returns the Monday before today (Taipei)", () => {
    // 2026-04-27 Taipei is a Monday → start of week is itself.
    expect(getStartOfWeekUTC().toISOString()).toBe("2026-04-26T16:00:00.000Z")
  })
})

describe("getStartOfDayInTaipeiUTC", () => {
  it("snaps a Taipei-evening date back to its 00:00 boundary", () => {
    // 2026-04-27T15:30:00Z = 2026-04-27 23:30 Taipei → start of day = 2026-04-27 00:00 Taipei = 2026-04-26T16:00Z
    const result = getStartOfDayInTaipeiUTC(new Date("2026-04-27T15:30:00Z"))
    expect(result.toISOString()).toBe("2026-04-26T16:00:00.000Z")
  })

  it("does not roll over when the time is already at the boundary", () => {
    const result = getStartOfDayInTaipeiUTC(new Date("2026-04-26T16:00:00Z"))
    expect(result.toISOString()).toBe("2026-04-26T16:00:00.000Z")
  })
})

describe("formatShortDateInTaipei", () => {
  it("uses Taipei month/day, not UTC", () => {
    // 2026-04-26T16:00:00Z is 2026-04-27 00:00 Taipei → "4/27"
    expect(formatShortDateInTaipei(new Date("2026-04-26T16:00:00Z"))).toBe("4/27")
  })

  it("does not pad single-digit months/days", () => {
    expect(formatShortDateInTaipei(new Date("2026-01-04T16:00:00Z"))).toBe("1/5")
  })
})

describe("formatDateTimeInTaipei", () => {
  it("zero-pads month, day, hour, minute", () => {
    expect(formatDateTimeInTaipei(new Date("2026-01-04T16:30:00Z"))).toBe("01/05 00:30")
  })
})
