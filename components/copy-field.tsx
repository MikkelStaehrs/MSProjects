'use client'

import { useEffect, useState } from 'react'

/**
 * One field, one copy button. The field is derived and cannot be edited here.
 * If the text should read differently, the log entry changes, not the report.
 */
export function CopyField({
  label,
  source,
  value,
  children,
}: {
  label: string
  source: string
  value: string
  children?: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!copied && !failed) return
    const t = setTimeout(() => {
      setCopied(false)
      setFailed(false)
    }, 1800)
    return () => clearTimeout(t)
  }, [copied, failed])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      setFailed(true)
    }
  }

  return (
    <div className="border border-rule bg-sheet">
      <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <span className="lbl text-muted">{label}</span>
          <span className="text-[9.5px] uppercase tracking-[0.1em] text-rule-strong">
            {source}
          </span>
        </div>
        <button
          type="button"
          onClick={copy}
          className={`lbl ${
            failed ? 'text-oxblood' : copied ? 'text-ink' : 'text-green hover:text-oxblood'
          }`}
        >
          {failed ? 'Select and copy' : copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="px-4 py-3.5 text-[13.5px] leading-relaxed text-pretty">
        {children ?? value}
      </div>
    </div>
  )
}
