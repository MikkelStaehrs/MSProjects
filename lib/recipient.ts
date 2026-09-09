/**
 * Who a blocker is waiting on.
 *
 * `blocker.waiting_on` stays free text, so opening a blocker never waits for
 * anyone to create a record first. The cost of free text is that «Project
 * Board», «project board» and «Project  Board» are three recipients as far as
 * the chart on /blockers is concerned, and that chart is the whole reason the
 * blocker is a first class entity: a number you can take into a conversation.
 * Split the number and it argues for less than the truth.
 *
 * So the spelling is settled on write instead of by a table.
 */

/** Trim, and collapse any run of whitespace to a single space. */
export function normaliseName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/**
 * The spelling this recipient is already known by, if any.
 *
 * A name that matches an existing one apart from case or spacing takes the
 * existing spelling, so the two never split apart. A genuinely new name keeps
 * exactly what was typed, capitals included: the first person to write it
 * decides how it is spelled from then on.
 */
export function canonicalRecipient(raw: string, known: readonly string[]): string {
  const name = normaliseName(raw)
  if (name === '') return ''

  const key = name.toLowerCase()
  const match = known.find((k) => normaliseName(k).toLowerCase() === key)
  return match ?? name
}

/** Is this recipient one we have written to before? */
export function isKnownRecipient(raw: string, known: readonly string[]): boolean {
  const name = normaliseName(raw).toLowerCase()
  if (name === '') return false
  return known.some((k) => normaliseName(k).toLowerCase() === name)
}

/**
 * The realistic wait for a recipient, measured rather than declared.
 *
 * The median of every wait already resolved for them. The median and not the
 * mean, because one investment application that sat for half a year should not
 * move the expectation for the next ordinary question.
 *
 * Null until there is history. An expectation with nothing behind it would make
 * the Progress light fire on a schedule nobody chose, and inventing a date is
 * worse than having none: Off Track has to mean something.
 */
export function medianWait(days: readonly number[]): number | null {
  const usable = days.filter((d) => Number.isFinite(d) && d >= 0).sort((a, b) => a - b)
  if (usable.length === 0) return null

  const mid = Math.floor(usable.length / 2)
  const median =
    usable.length % 2 === 1 ? usable[mid] : (usable[mid - 1] + usable[mid]) / 2

  // A same day answer is still an answer. Never promise zero: the expectation
  // would be passed the moment it is set.
  return Math.max(1, Math.round(median))
}
