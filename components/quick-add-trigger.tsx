'use client'

/** The mouse route to what Ctrl+K does. The overlay listens for the event. */
export function QuickAddTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('quickadd:open'))}
      className="flex items-center gap-2.5"
    >
      <span className="lbl text-green hover:text-oxblood">New entry</span>
      {/* There is no Ctrl on a phone, and the badge is only taking width. */}
      <span className="hidden border border-rule px-1.5 py-0.5 text-[10px] tracking-[0.06em] text-muted lg:inline-block">
        CTRL K
      </span>
    </button>
  )
}
