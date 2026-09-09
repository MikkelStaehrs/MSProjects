export type Sortable = { id: string; sort_order: number }

/**
 * Move one node one step among its siblings.
 *
 * The whole set is renumbered in tens rather than swapping two values. That
 * repairs duplicates and gaps left by earlier inserts, and it means the WBS
 * codes, which count position, always match what the list shows.
 *
 * Returns only the siblings whose number actually changed, so a move writes
 * two rows and not the entire branch.
 */
export function reorder(
  siblings: Sortable[],
  id: string,
  direction: 'up' | 'down',
): Sortable[] {
  const ordered = [...siblings].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  )

  const from = ordered.findIndex((n) => n.id === id)
  if (from === -1) return []

  const to = direction === 'up' ? from - 1 : from + 1
  if (to < 0 || to >= ordered.length) return []

  const moved = [...ordered]
  ;[moved[from], moved[to]] = [moved[to], moved[from]]

  const before = new Map(ordered.map((n) => [n.id, n.sort_order]))
  return moved
    .map((n, i) => ({ id: n.id, sort_order: (i + 1) * 10 }))
    .filter((n) => before.get(n.id) !== n.sort_order)
}

/** Whether a move is possible, for deciding what the row offers. */
export function canMove(
  siblings: Sortable[],
  id: string,
): { up: boolean; down: boolean } {
  const ordered = [...siblings].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  )
  const i = ordered.findIndex((n) => n.id === id)
  return { up: i > 0, down: i !== -1 && i < ordered.length - 1 }
}
