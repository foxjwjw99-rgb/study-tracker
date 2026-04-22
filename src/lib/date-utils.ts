/**
 * Timezone-aware date utilities for Asia/Taipei (UTC+8, no DST).
 *
 * All server-side date boundaries should use these helpers so that
 * "today", "start of week", etc. are computed in the user's local
 * timezone rather than the server's system timezone.
 */

// Asia/Taipei is always UTC+8, no daylight saving time.
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000

/**
 * Return the current moment shifted to Asia/Taipei time as a plain UTC Date.
 * Useful for extracting year/month/day in Taiwan local time via getUTC* methods.
 */
function getTaipeiNow(): Date {
  return new Date(Date.now() + TAIPEI_OFFSET_MS)
}

/** Start of today in Asia/Taipei, expressed as a UTC Date. */
export function getStartOfTodayUTC(): Date {
  const t = getTaipeiNow()
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - TAIPEI_OFFSET_MS)
}

/** End of today (23:59:59.999) in Asia/Taipei, expressed as a UTC Date. */
export function getEndOfTodayUTC(): Date {
  const t = getTaipeiNow()
  return new Date(
    Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 23, 59, 59, 999) -
      TAIPEI_OFFSET_MS
  )
}

/**
 * Start of N days ago in Asia/Taipei, expressed as a UTC Date.
 * e.g. getStartOfDaysAgoUTC(6) gives the start of 6 days before today (Taiwan time).
 */
export function getStartOfDaysAgoUTC(daysAgo: number): Date {
  const t = getTaipeiNow()
  return new Date(
    Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - daysAgo) - TAIPEI_OFFSET_MS
  )
}

/**
 * Start of the current week (Monday) in Asia/Taipei, expressed as a UTC Date.
 */
export function getStartOfWeekUTC(): Date {
  const t = getTaipeiNow()
  const dow = t.getUTCDay() // 0 = Sun, 1 = Mon, …
  const daysFromMonday = dow === 0 ? 6 : dow - 1
  return new Date(
    Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - daysFromMonday) -
      TAIPEI_OFFSET_MS
  )
}

/**
 * Start of the day for an arbitrary UTC Date, computed in Asia/Taipei time.
 * Use this instead of date-fns startOfDay() for dates coming from the database.
 */
export function getStartOfDayInTaipeiUTC(date: Date): Date {
  const taipeiDate = new Date(date.getTime() + TAIPEI_OFFSET_MS)
  return new Date(
    Date.UTC(taipeiDate.getUTCFullYear(), taipeiDate.getUTCMonth(), taipeiDate.getUTCDate()) -
      TAIPEI_OFFSET_MS
  )
}

/**
 * Format a UTC Date as "M/d" using Asia/Taipei local time.
 * Matches the existing formatShortDate / format(date, "M/d") pattern.
 */
export function formatShortDateInTaipei(date: Date): string {
  const taipeiDate = new Date(date.getTime() + TAIPEI_OFFSET_MS)
  return `${taipeiDate.getUTCMonth() + 1}/${taipeiDate.getUTCDate()}`
}

/**
 * Format a UTC Date as "MM/dd HH:mm" using Asia/Taipei local time.
 */
export function formatDateTimeInTaipei(date: Date): string {
  const taipeiDate = new Date(date.getTime() + TAIPEI_OFFSET_MS)
  const month = String(taipeiDate.getUTCMonth() + 1).padStart(2, "0")
  const day = String(taipeiDate.getUTCDate()).padStart(2, "0")
  const hour = String(taipeiDate.getUTCHours()).padStart(2, "0")
  const minute = String(taipeiDate.getUTCMinutes()).padStart(2, "0")
  return `${month}/${day} ${hour}:${minute}`
}
