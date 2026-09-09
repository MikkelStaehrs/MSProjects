/**
 * Dates, in one place.
 *
 * Every date in this app is a plain ISO day, `2026-09-03`, never a timestamp.
 * That is deliberate: a due date is a day, not a moment, and giving it a time
 * only invites a timezone to move it.
 *
 * These lived in four copies before. `addDays` was in template.ts and again as
 * `addDaysIso` in template-actions.ts; `daysBetween` was in report.ts and again
 * in template.ts; the day in milliseconds was declared three times; and today
 * was spelled out by hand in nineteen places. Nothing was wrong with any single
 * copy, which is exactly how the median ended up with two different answers
 * earlier: the same word computed twice eventually disagrees.
 */

export const DAY = 86_400_000

/** An ISO day to milliseconds, read as UTC so arithmetic never drifts. */
export const utc = (iso: string) => Date.parse(iso + 'T00:00:00Z')

/** Milliseconds back to an ISO day. */
export const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/**
 * Today, as an ISO day.
 *
 * Read in UTC, which is what every call site did by hand before this existed.
 * For a Danish user that means the day rolls over at 01:00 or 02:00 local
 * rather than at midnight. It has never mattered for a tool measuring waits in
 * days, and it is now one line to change if it ever does.
 */
export const today = () => new Date().toISOString().slice(0, 10)

/** Whole days from one ISO day to another. Negative when `to` is earlier. */
export const daysBetween = (from: string, to: string) =>
  Math.round((utc(to) - utc(from)) / DAY)

/** An ISO day shifted by whole days, forwards or backwards. */
export const addDays = (iso: string, n: number) => isoDate(utc(iso) + n * DAY)

/** Is this ISO day in the past, relative to today? */
export const isPast = (iso: string) => iso < today()
