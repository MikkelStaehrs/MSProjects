/**
 * What you did but did not write down.
 *
 * The whole tool rests on one habit, and the habit is the part that lapses in a
 * busy week. This is the cheapest defence against yourself: rather than
 * remembering to log, you are shown what already happened and asked to say a
 * line about it.
 *
 * Nothing is stored. A loose end is a state change with no entry near it, and
 * the moment you write the line it stops being one. There is no queue to drain,
 * no dismissal to manage and nothing to keep in sync, which is the same reason
 * blocked and readiness are derived rather than kept.
 *
 * A deliberate limitation: this only sees what happened INSIDE the app. Work
 * done in a week where you never opened it leaves no trace here, and the answer
 * to that is a real signal source, calendar or git, which needs its own
 * authentication and is a separate piece of work.
 */

import { daysBetween } from './date.ts'

/** How close an entry has to be to count as having covered the event. */
const NEAR_DAYS = 2

/** How long an active node may go unmentioned before it is a loose end. */
const STALE_DAYS = 14

/** How far back to look. Older than this, the moment for a line has passed. */
const WINDOW_DAYS = 21

export type LooseKind =
  | 'completed'
  | 'blocker_opened'
  | 'blocker_resolved'
  | 'stale'
  | 'undecided'

export type LooseEnd = {
  nodeId: string
  kind: LooseKind
  /** What happened, ready to read. */
  what: string
  /** The day it happened, for ordering and for showing. */
  on: string
  /** How the line might start, offered rather than imposed. */
  prompt: string
}

export type LooseInput = {
  nodes: {
    id: string
    title: string
    type: string
    status: string
    due_date: string | null
    completed_at: string | null
  }[]
  entries: { node_id: string; entry_date: string }[]
  decisions: { node_id: string }[]
  blockers: {
    node_id: string
    title: string
    waiting_on: string
    opened_at: string
    resolved_at: string | null
  }[]
  today: string
}

const day = (timestamp: string) => timestamp.slice(0, 10)

/**
 * Every loose end, newest first.
 *
 * An event counts as covered when any entry on the same node falls within two
 * days of it. Not the same day, because you finish something on Thursday and
 * write about it on Friday, and that is still writing about it.
 */
export function looseEnds(input: LooseInput): LooseEnd[] {
  const { nodes, entries, blockers, decisions, today } = input

  const decided = new Set(decisions.map((d) => d.node_id))

  const entryDates = new Map<string, string[]>()
  for (const e of entries) {
    entryDates.set(e.node_id, [...(entryDates.get(e.node_id) ?? []), e.entry_date])
  }

  const covered = (nodeId: string, on: string) =>
    (entryDates.get(nodeId) ?? []).some(
      (d) => Math.abs(daysBetween(on, d)) <= NEAR_DAYS,
    )

  const recent = (on: string) => {
    const age = daysBetween(on, today)
    return age >= 0 && age <= WINDOW_DAYS
  }

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out: LooseEnd[] = []

  for (const n of nodes) {
    if (n.completed_at === null) continue
    const on = day(n.completed_at)
    if (!recent(on) || covered(n.id, on)) continue
    out.push({
      nodeId: n.id,
      kind: 'completed',
      what: `Finished ${n.title}`,
      on,
      prompt: 'What did it take, and did anything change because of it?',
    })
  }

  for (const b of blockers) {
    const node = byId.get(b.node_id)
    if (!node) continue

    if (recent(b.opened_at) && !covered(b.node_id, b.opened_at)) {
      out.push({
        nodeId: b.node_id,
        kind: 'blocker_opened',
        what: `Started waiting on ${b.waiting_on}, ${b.title}`,
        on: b.opened_at,
        prompt: 'What did you ask for, and who did you ask?',
      })
    }

    if (
      b.resolved_at !== null &&
      recent(b.resolved_at) &&
      !covered(b.node_id, b.resolved_at)
    ) {
      out.push({
        nodeId: b.node_id,
        kind: 'blocker_resolved',
        what: `${b.waiting_on} came back on ${b.title}`,
        on: b.resolved_at,
        prompt: 'What was the answer, and what does it unblock?',
      })
    }
  }

  /*
   * Silence on live work, and the catch-all of the four.
   *
   * Skipped where something specific already asks about the node: «you opened a
   * blocker here» and «nothing has ever been logged here» are the same fact
   * twice, and the specific one is the one worth answering. Two specific events
   * may both stand, because finishing a task and opening a blocker on it are
   * genuinely two lines.
   *
   * Tasks only, and only ones that are active and dated.
   *
   * The first run against real data asked for a line on «Spectral Analysis» and
   * «Production Line: Cleaning», which are containers. You log on the work, not
   * on the box: a subproject is active because its children are, and its
   * activity is the sum of theirs. An idea nobody has started is supposed to be
   * quiet too, and nagging about either would teach you to ignore the list.
   */
  const alreadyAsked = new Set(out.map((l) => l.nodeId))

  for (const n of nodes) {
    if (alreadyAsked.has(n.id)) continue
    if (n.type !== 'task' || n.status !== 'active' || n.due_date === null) continue
    const dates = entryDates.get(n.id) ?? []
    const last = dates.length === 0 ? null : dates.slice().sort().at(-1)!
    const silent = last === null ? Infinity : daysBetween(last, today)
    if (silent < STALE_DAYS) continue
    out.push({
      nodeId: n.id,
      kind: 'stale',
      what:
        last === null
          ? `Nothing ever logged on ${n.title}`
          : `Nothing logged on ${n.title} for ${silent} days`,
      on: last ?? today,
      prompt: 'Where does it actually stand?',
    })
  }

  /*
   * Work under way with nothing decided written down.
   *
   * The one loose end that is not about a log line. `decision` carried
   * `rationale` and `alternatives` from the first migration and held zero rows
   * for two days of real use, which was never laziness: nothing ever asked.
   * Everything else here is shown what happened and asked to say a line about
   * it, and the reasoning behind a build deserves the same treatment.
   *
   * Development nodes only, and only once something has actually been logged
   * on one. A development node is where the technical choices live; a
   * subproject is a container, and asking a box what it decided is the same
   * mistake `stale` made on its first run against real data. The entry is what
   * separates «you are building this and have not said why» from «you created
   * this yesterday».
   */
  for (const n of nodes) {
    if (n.type !== 'development') continue
    if (n.status !== 'active' && n.status !== 'planned') continue
    if (decided.has(n.id)) continue
    const dates = entryDates.get(n.id) ?? []
    if (dates.length === 0) continue
    out.push({
      nodeId: n.id,
      kind: 'undecided',
      what: `Nothing decided on record for ${n.title}`,
      on: dates.slice().sort().at(-1)!,
      prompt: 'What did you settle on, and what did you turn down to get there?',
    })
  }

  return out.sort((a, b) => (a.on < b.on ? 1 : a.on > b.on ? -1 : 0))
}
