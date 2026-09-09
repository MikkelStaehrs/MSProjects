/**
 * Walking the tree in memory, so a page does not have to ask the database
 * where its own children are.
 *
 * v_node_descendant is the right answer in SQL, where a view joins against it
 * and Postgres does the work in one pass. It is the wrong answer as a separate
 * round trip: every page was fetching the id list first and only then issuing
 * the queries that filter by it, which turns one wait into two. On a project
 * page that happened three times, once for the tree, once for the frame and
 * once more when an edit form was open, and each cost about a tenth of a
 * second of doing nothing.
 *
 * The whole portfolio is a few dozen rows. Fetching it and walking it here is
 * free by comparison.
 */

export type Parented = { id: string; parent_id: string | null }

/** Children by parent, in the order given. */
export function childrenByParent<T extends Parented>(nodes: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const n of nodes) {
    if (n.parent_id === null) continue
    out.set(n.parent_id, [...(out.get(n.parent_id) ?? []), n])
  }
  return out
}

/**
 * A node and everything under it, the node itself first.
 *
 * Matches v_node_descendant, which includes the root at depth zero, so a caller
 * can swap one for the other without the set changing shape.
 */
export function subtreeIds(nodes: Parented[], rootId: string): string[] {
  const kids = childrenByParent(nodes)
  const out: string[] = []
  const walk = (nodeId: string) => {
    out.push(nodeId)
    for (const k of kids.get(nodeId) ?? []) walk(k.id)
  }
  walk(rootId)
  return out
}

/** The same, as a set, for the filtering that always follows. */
export function subtreeSet(nodes: Parented[], rootId: string): Set<string> {
  return new Set(subtreeIds(nodes, rootId))
}

/** Everything under a node, not counting the node. */
export function descendantIds(nodes: Parented[], rootId: string): string[] {
  return subtreeIds(nodes, rootId).slice(1)
}
