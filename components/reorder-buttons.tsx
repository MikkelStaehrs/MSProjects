import { moveNodeInOrder } from '@/lib/node-actions'

/**
 * One step up or down among the siblings. Two small forms rather than drag
 * and drop: MASTER asks for drag-free, and a keyboard reaches a button.
 */
export function ReorderButtons({
  id,
  can,
  redirectTo,
}: {
  id: string
  can: { up: boolean; down: boolean }
  redirectTo: string
}) {
  return (
    <span className="flex shrink-0 flex-col leading-none">
      {(['up', 'down'] as const).map((direction) => (
        <form key={direction} action={moveNodeInOrder}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="direction" value={direction} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button
            type="submit"
            disabled={!can[direction]}
            title={direction === 'up' ? 'Move up' : 'Move down'}
            className="block text-[9px] text-rule-strong hover:text-green disabled:opacity-30 disabled:hover:text-rule-strong"
          >
            {direction === 'up' ? '▲' : '▼'}
          </button>
        </form>
      ))}
    </span>
  )
}
