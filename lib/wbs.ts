/**
 * Work breakdown codes: PR-26-0001.01.03
 *
 * The project number is the stem. Each level below adds the node's position
 * among its siblings, two digits, counted in sort order.
 *
 * The code is DERIVED, not stored. Reorder the siblings and the code changes.
 * That is the trade: it always matches what you see on screen, and it is
 * therefore a path, not an identifier. The identifier is the project number
 * plus the node itself.
 */

export type Flat = { id: string; parent_id: string | null; sort_order: number }

/** Walking up needs parentage and nothing else. Ordering is irrelevant to it. */
export type Linked = { id: string; parent_id: string | null }

const segment = (index: number) => String(index + 1).padStart(2, '0')

export function wbsCodes(
  nodes: Flat[],
  rootId: string,
  rootCode: string,
): Map<string, string> {
  const children = new Map<string, Flat[]>()
  for (const n of nodes) {
    if (n.parent_id === null) continue
    children.set(n.parent_id, [...(children.get(n.parent_id) ?? []), n])
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
  }

  const codes = new Map<string, string>([[rootId, rootCode]])

  const walk = (parentId: string, prefix: string) => {
    ;(children.get(parentId) ?? []).forEach((child, i) => {
      const code = `${prefix}.${segment(i)}`
      codes.set(child.id, code)
      walk(child.id, code)
    })
  }

  walk(rootId, rootCode)
  return codes
}

/** The chain of ancestors from the project down to a node, the node last. */
export function pathTo(
  nodes: Linked[],
  rootId: string,
  nodeId: string,
): string[] {
  const parentOf = new Map(nodes.map((n) => [n.id, n.parent_id]))
  const chain: string[] = []
  let current: string | null = nodeId

  while (current) {
    chain.unshift(current)
    if (current === rootId) break
    current = parentOf.get(current) ?? null
  }

  return chain[0] === rootId ? chain : []
}
