'use client'

import { useRef } from 'react'
import { setNodeStatus } from '@/lib/node-actions'
import { STATUS_LABEL, type NodeStatus } from '@/lib/types'
import { StatusMark } from '@/components/ui'

/**
 * Changing status without a detour: pick from the list and it saves itself.
 *
 * The visible word is the EFFECTIVE state, so it can never disagree with the
 * mark beside it. An earlier version showed the stored status next to an
 * oxblood mark, and a blocked node read «Blocked» in colour and «Active» in
 * words at the same time. The select sits on top, transparent, and still edits
 * the decision underneath: open it and you see which status is really stored.
 */
export function StatusSelect({
  id,
  status,
  blocked = false,
  waitDays = 0,
}: {
  id: string
  status: NodeStatus
  blocked?: boolean
  waitDays?: number
}) {
  const form = useRef<HTMLFormElement>(null)

  return (
    <form ref={form} action={setNodeStatus} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <StatusMark status={status} blocked={blocked} />

      <span className="group relative inline-flex items-center">
        <span
          aria-hidden
          className={`lbl-tight pointer-events-none whitespace-nowrap group-focus-within:underline ${
            blocked ? 'text-oxblood' : 'text-ink'
          }`}
        >
          {blocked ? 'Blocked' : STATUS_LABEL[status]}
          {blocked && <span className="ml-1.5 tabular-nums">{waitDays}d</span>}
          <span className="ml-1.5 text-rule-strong">&#9662;</span>
        </span>

        <select
          name="status"
          defaultValue={status}
          onChange={() => form.current?.requestSubmit()}
          aria-label={
            blocked
              ? `Status, blocked for ${waitDays} days. Stored status ${STATUS_LABEL[status]}`
              : 'Status'
          }
          className="absolute inset-0 w-full cursor-pointer opacity-0"
        >
          {(Object.keys(STATUS_LABEL) as NodeStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </span>
    </form>
  )
}
