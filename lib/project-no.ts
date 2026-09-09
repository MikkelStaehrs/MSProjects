import type { NodeCategory } from '@/lib/types'

/**
 * The project number. Shape: CX-26-0001, meaning category, year, serial.
 *
 * The system generates it and it cannot be edited. It freezes once assigned:
 * change a project's category afterwards and the number stays. An identifier
 * that moves is not an identifier, and old references have to keep matching.
 *
 * The serial is counted within category and year and restarts each year, like
 * an invoice number. The year is part of the number, so two projects with the
 * same serial in different years are still two projects.
 */

export const CATEGORY_PREFIX: Record<NodeCategory, string> = {
  capex: 'CX',
  production: 'PR',
  it: 'IT',
  other: 'AN',
}

/** Without a category there are no letters to build on. */
export function prefixFor(category: NodeCategory | null): string | null {
  return category === null ? null : CATEGORY_PREFIX[category]
}

export type ProjectNo = { prefix: string; year: number; serial: number }

const PATTERN = /^([A-Z]{2})-(\d{2})-(\d{4})$/

export function formatProjectNo({ prefix, year, serial }: ProjectNo): string {
  return `${prefix}-${String(year).padStart(2, '0')}-${String(serial).padStart(4, '0')}`
}

export function parseProjectNo(value: unknown): ProjectNo | null {
  if (typeof value !== 'string') return null
  const m = value.trim().match(PATTERN)
  if (!m) return null
  return { prefix: m[1], year: Number(m[2]), serial: Number(m[3]) }
}

/** Two digits for the year, like the rest of the number. 2026 becomes 26. */
export function yearOf(isoDate: string): number {
  return Number(isoDate.slice(2, 4))
}

/**
 * The next free serial for the category in that year. Takes the highest one
 * that exists and adds one. Gaps left by deleted projects are not filled,
 * because a reused number points at two things.
 */
export function nextProjectNo(
  existing: unknown[],
  prefix: string,
  year: number,
): string {
  const serials = existing
    .map(parseProjectNo)
    .filter((p): p is ProjectNo => p !== null && p.prefix === prefix && p.year === year)
    .map((p) => p.serial)

  const next = serials.length === 0 ? 1 : Math.max(...serials) + 1
  if (next > 9999) {
    throw new Error(
      `The running number for ${prefix} in year ${year} is used up. That should not be possible.`,
    )
  }
  return formatProjectNo({ prefix, year, serial: next })
}
