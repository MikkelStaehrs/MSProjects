'use client'

import { useRef } from 'react'
import { setStage } from '@/lib/report-actions'
import { STAGES, type Stage } from '@/lib/report'

/** The only field in the weekly report that needs a human. */
export function StageSelect({
  nodeId,
  stage,
}: {
  nodeId: string
  stage: Stage | null
}) {
  const form = useRef<HTMLFormElement>(null)

  return (
    <form ref={form} action={setStage}>
      <input type="hidden" name="node_id" value={nodeId} />
      <select
        name="stage"
        defaultValue={stage ?? ''}
        onChange={() => form.current?.requestSubmit()}
        aria-label="Stage"
        className={`cursor-pointer border-0 bg-transparent text-[13.5px] outline-none ${
          stage === null ? 'text-oxblood' : 'text-ink'
        }`}
      >
        <option value="">Choose a phase</option>
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </form>
  )
}
