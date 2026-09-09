'use client'

import { deleteNode } from '@/lib/node-actions'

/**
 * Deleting takes the whole subtree through the cascade: log entries, blockers,
 * decisions and reports go with it. Hence a confirmation that says so.
 */
export function DeleteNodeButton({
  id,
  title,
  descendants,
  redirectTo,
}: {
  id: string
  title: string
  descendants: number
  redirectTo: string
}) {
  const warning =
    descendants > 0
      ? `Delete "${title}" and ${descendants} child ${
          descendants === 1 ? 'node' : 'nodes'
        }? Work log, blockers and decisions go with it. This cannot be undone.`
      : `Delete "${title}"? Work log, blockers and decisions go with it. This cannot be undone.`

  return (
    <form
      action={deleteNode}
      onSubmit={(e) => {
        if (!window.confirm(warning)) e.preventDefault()
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <button type="submit" className="btn btn-danger">
        Delete
      </button>
    </form>
  )
}
