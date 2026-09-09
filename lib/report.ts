import { DAY, isoDate, utc } from './date.ts'
import type { ActiveBlocker, Entry, NextDate, NodeCost, NodeStatus } from '@/lib/types'

/**
 * Pure functions for the weekly report. No I/O, so they can be tested, and
 * because a report computed differently in two places is not a report.
 */


// --- The week --------------------------------------------------------------

export type Week = { start: string; end: string; number: number }

/** ISO week: Monday to Sunday, week 1 is the one holding 4 January. */
export function isoWeek(today: string): Week {
  const ms = utc(today)
  const weekday = (new Date(ms).getUTCDay() + 6) % 7 // Monday = 0
  const start = ms - weekday * DAY
  const end = start + 6 * DAY

  const thursday = start + 3 * DAY
  const year = new Date(thursday).getUTCFullYear()
  const jan4 = Date.UTC(year, 0, 4)
  const jan4Weekday = (new Date(jan4).getUTCDay() + 6) % 7
  const week1Monday = jan4 - jan4Weekday * DAY
  const number = Math.round((start - week1Monday) / (7 * DAY)) + 1

  return { start: isoDate(start), end: isoDate(end), number }
}

// --- Status ---------------------------------------------------------------

export const STATUS_UPDATE_VALUES = [
  'Not started',
  'Active',
  'Completed',
  'On hold',
  'Cancelled',
] as const
export type StatusUpdate = (typeof STATUS_UPDATE_VALUES)[number]

/** Our seven statuses map onto the company's five. `blocked` shows in Progress. */
export function toStatusUpdate(status: NodeStatus): StatusUpdate {
  switch (status) {
    case 'idea':
    case 'planned':
      return 'Not started'
    case 'active':
      return 'Active'
    case 'done':
      return 'Completed'
    case 'paused':
      return 'On hold'
    case 'cancelled':
      return 'Cancelled'
  }
}

// --- Stage ----------------------------------------------------------------

export const STAGES = [
  '1. Initiation',
  '2. Planning and Design',
  '3. Execution',
  '4. Project Closure',
] as const
export type Stage = (typeof STAGES)[number]

export function readStage(reporting: Record<string, unknown>): Stage | null {
  const value = reporting?.stage
  return typeof value === 'string' && (STAGES as readonly string[]).includes(value)
    ? (value as Stage)
    : null
}

// --- Progress -------------------------------------------------------------

export const PROGRESS_VALUES = ['On Track', 'At Risk', 'Off Track'] as const
export type Progress = (typeof PROGRESS_VALUES)[number]

export type ProgressInput = {
  daysUntilNext: number | null
  blockers: Pick<ActiveBlocker, 'expected_by'>[]
  today: string
}

/** First match wins. The rule is in MASTER.md and must exist in one place. */
export function progressSignal({
  daysUntilNext,
  blockers,
  today,
}: ProgressInput): Progress {
  const overdueBlocker = blockers.some(
    (b) => b.expected_by !== null && b.expected_by < today,
  )
  if ((daysUntilNext !== null && daysUntilNext < 0) || overdueBlocker) return 'Off Track'
  if (blockers.length > 0 || (daysUntilNext !== null && daysUntilNext <= 7))
    return 'At Risk'
  return 'On Track'
}

/** Why the light reads as it does. Shown beside the field, never in it. */
export function progressReason({
  daysUntilNext,
  blockers,
  today,
}: ProgressInput): string {
  const overdue = blockers.filter(
    (b) => b.expected_by !== null && b.expected_by < today,
  )
  const reasons: string[] = []
  if (daysUntilNext !== null && daysUntilNext < 0)
    reasons.push(`next date is ${Math.abs(daysUntilNext)} days overdue`)
  if (overdue.length > 0)
    reasons.push(
      `${overdue.length} ${overdue.length === 1 ? 'blocker has' : 'blockers have'} passed the expected reply date`,
    )
  if (reasons.length === 0 && blockers.length > 0)
    reasons.push(`${blockers.length} open blockers`)
  if (reasons.length === 0 && daysUntilNext !== null && daysUntilNext <= 7)
    reasons.push(`next date in ${daysUntilNext} days`)
  if (reasons.length === 0) reasons.push('no blockers, no overdue dates')
  return reasons.join(', ')
}

// --- Statusteksten --------------------------------------------------------

function sentence(text: string) {
  const t = text.trim()
  if (t === '') return ''
  return /[.!?]$/.test(t) ? t : `${t}.`
}

/**
 * Lower the first letter so a title reads inside a sentence, but only when the
 * title is an ordinary phrase.
 *
 * Two things must be left alone, both found by real reports rather than by
 * tests. An acronym: «VLAN» became «vLAN». And a title written with capitals on
 * every word: «Small Enhancement Approval» became «small Enhancement Approval»,
 * which looks broken rather than lowercased. A capital anywhere but the first
 * letter is the tell, and it beats keeping a list of exceptions.
 */
function lowerFirst(text: string) {
  const second = text.charAt(1)
  const acronym = second !== '' && second === second.toUpperCase() && second !== second.toLowerCase()
  const titleCase = /\s[A-Z]/.test(text)
  if (text.length < 2 || acronym || titleCase) return text
  return text.charAt(0).toLowerCase() + text.slice(1)
}

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const fmt = (iso: string) => shortDate.format(new Date(iso + 'T00:00:00'))

type CommentBlocker = Pick<
  ActiveBlocker,
  'title' | 'waiting_on' | 'days_blocked' | 'expected_by'
>

export type CommentInput = {
  entries: Pick<Entry, 'entry_date' | 'body'>[]
  blockers: CommentBlocker[]
  today: string
}

/**
 * The status text is assembled, not written. Log entries come first in the
 * order they happened, then the blockers phrased as waiting time. The tool
 * cannot invent what was never logged, and should not pretend otherwise.
 */
/** «1 days» is what the first real report said. */
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

export function buildStatusComment({ entries, blockers, today }: CommentInput): string {
  const parts: string[] = []

  for (const e of [...entries].sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1))) {
    const s = sentence(e.body)
    if (s !== '') parts.push(s)
  }

  /*
   * Grouped by recipient, because the first real report read «Waiting on
   * Project Board: ..., 1 days. Waiting on Project Board: ..., 0 days.» Two
   * sentences naming the same party is how a person reads it as two problems
   * when it is one relationship with two things in it.
   *
   * The day count shown is the longest of them: that is the wait you would
   * quote, and the shorter ones are inside it.
   */
  const byRecipient = new Map<string, CommentBlocker[]>()
  for (const b of blockers) {
    const key = b.waiting_on.trim()
    byRecipient.set(key, [...(byRecipient.get(key) ?? []), b])
  }

  const grouped = [...byRecipient.entries()]
    .map(([who, list]) => ({
      who,
      list: [...list].sort((a, b) => b.days_blocked - a.days_blocked),
    }))
    .sort((a, b) => b.list[0].days_blocked - a.list[0].days_blocked)

  for (const { who, list } of grouped) {
    const worst = list[0]
    const titles = list.map((b) => lowerFirst(b.title)).join(' and ')
    const overdue = list.find((b) => b.expected_by !== null && b.expected_by < today)
    const tail = overdue
      ? `, expected reply ${fmt(overdue.expected_by!)} has passed`
      : ''
    parts.push(
      sentence(`Waiting on ${who}: ${titles}, ${days(worst.days_blocked)}${tail}`),
    )
  }

  if (parts.length === 0) return 'No activity recorded in this period.'
  return parts.join(' ')
}

// --- The snapshot behind a report -----------------------------------------

/**
 * What the figures were when a report was submitted.
 *
 * The four fields say what you reported. This says what the project looked like
 * while you reported it: how far along, which node was next and when it was
 * due, who was being waited on and for how long.
 *
 * It cannot be recomputed afterwards. v_next_date and v_node_progress answer
 * for today, and the tree they read has moved on. A project that quietly slips
 * looks identical week to week in the archive unless this is written down at
 * the time.
 */
export type ReportSnapshot = {
  progress_pct: number
  leaf_done: number
  leaf_total: number
  next: {
    node_id: string
    title: string
    due_date: string
    is_milestone: boolean
  } | null
  blockers: {
    id: string
    title: string
    waiting_on: string
    days_blocked: number
  }[]
  entry_count: number
  /**
   * The money as it stood that week.
   *
   * Left out of the first version, which was the same mistake as leaving out
   * progress: v_node_cost answers for today, and «you said 620 000 in week 34
   * and it is 810 000 now» cannot be reconstructed once the lines have moved.
   */
  cost: {
    once_priced: number
    once_committed: number
    once_with_paper: number
    annual_priced: number
    items: number
  }
}

export function toSnapshot(input: {
  progressPct: number
  leafDone: number
  leafTotal: number
  next: NextDate | null
  blockers: ActiveBlocker[]
  entries: Entry[]
  cost: NodeCost | null
}): ReportSnapshot {
  return {
    progress_pct: input.progressPct,
    leaf_done: input.leafDone,
    leaf_total: input.leafTotal,
    next:
      input.next === null
        ? null
        : {
            node_id: input.next.next_node_id,
            title: input.next.title,
            due_date: input.next.due_date,
            is_milestone: input.next.is_milestone,
          },
    // Sorted by the longest wait, so two weeks can be compared without
    // reordering them first.
    blockers: [...input.blockers]
      .sort((a, b) => b.days_blocked - a.days_blocked || a.title.localeCompare(b.title))
      .map((b) => ({
        id: b.id,
        title: b.title,
        waiting_on: b.waiting_on,
        days_blocked: b.days_blocked,
      })),
    entry_count: input.entries.length,
    cost: {
      once_priced: Number(input.cost?.once_priced ?? 0),
      once_committed: Number(input.cost?.once_committed ?? 0),
      once_with_paper: Number(input.cost?.once_with_paper ?? 0),
      annual_priced: Number(input.cost?.annual_priced ?? 0),
      items: Number(input.cost?.items ?? 0),
    },
  }
}
