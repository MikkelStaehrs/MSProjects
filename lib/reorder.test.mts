import { canMove, reorder, type Sortable } from './reorder.ts'

let failed = 0
function check(name: string, got: unknown, expected: unknown) {
  if (JSON.stringify(got) === JSON.stringify(expected)) console.log(`ok    ${name}`)
  else {
    failed++
    console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      got:      ${JSON.stringify(got)}`)
  }
}

const s: Sortable[] = [
  { id: 'a', sort_order: 10 },
  { id: 'b', sort_order: 20 },
  { id: 'c', sort_order: 30 },
]

check('moving up swaps with the one before', reorder(s, 'b', 'up'),
  [{ id: 'b', sort_order: 10 }, { id: 'a', sort_order: 20 }])
check('moving down swaps with the one after', reorder(s, 'b', 'down'),
  [{ id: 'c', sort_order: 20 }, { id: 'b', sort_order: 30 }])
check('the first cannot move up', reorder(s, 'a', 'up'), [])
check('the last cannot move down', reorder(s, 'c', 'down'), [])
check('an unknown node moves nothing', reorder(s, 'x', 'up'), [])
check('a single sibling cannot move', reorder([{ id: 'a', sort_order: 10 }], 'a', 'down'), [])

// Duplicates and gaps from earlier inserts are repaired by the renumbering
const messy: Sortable[] = [
  { id: 'a', sort_order: 10 },
  { id: 'b', sort_order: 10 },
  { id: 'c', sort_order: 999 },
]
check('duplicates are broken by id, then renumbered', reorder(messy, 'c', 'up'),
  [{ id: 'c', sort_order: 20 }, { id: 'b', sort_order: 30 }])

check('only what changed is returned', reorder(s, 'c', 'up').map((n) => n.id).sort(), ['b', 'c'])

check('what the first row may offer', canMove(s, 'a'), { up: false, down: true })
check('what a middle row may offer', canMove(s, 'b'), { up: true, down: true })
check('what the last row may offer', canMove(s, 'c'), { up: true, down: false })
check('an unknown node offers nothing', canMove(s, 'x'), { up: false, down: false })

console.log(failed === 0 ? '\nAll tests passed.' : `\n${failed} test(s) failed.`)
process.exitCode = failed === 0 ? 0 : 1
