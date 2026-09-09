'use client'

/**
 * Log straight onto one node. Opens the same overlay as Ctrl+K, but with the
 * target already set, so the common case costs no searching.
 */
export function QuickAddOn({ nodeId, label = 'log' }: { nodeId: string; label?: string }) {
  return (
    <button
      type="button"
      title="Write a log entry on this node"
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent('quickadd:open', { detail: { nodeId } }),
        )
      }
      className="lbl-tight shrink-0 text-rule-strong hover:text-green"
    >
      {label}
    </button>
  )
}
