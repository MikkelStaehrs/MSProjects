import { pathTo, wbsCodes, type Flat } from './wbs.ts'

let failed = 0
function check(name: string, got: unknown, expected: unknown) {
  if (JSON.stringify(got) === JSON.stringify(expected)) console.log(`ok    ${name}`)
  else {
    failed++
    console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      got:      ${JSON.stringify(got)}`)
  }
}

const nodes: Flat[] = [
  { id: 'root', parent_id: null, sort_order: 10 },
  { id: 'b', parent_id: 'root', sort_order: 20 },
  { id: 'a', parent_id: 'root', sort_order: 10 },
  { id: 'a2', parent_id: 'a', sort_order: 20 },
  { id: 'a1', parent_id: 'a', sort_order: 10 },
  { id: 'a1x', parent_id: 'a1', sort_order: 10 },
]

const codes = wbsCodes(nodes, 'root', 'PR-26-0001')

check('the project keeps its own number', codes.get('root'), 'PR-26-0001')
check('first child', codes.get('a'), 'PR-26-0001.01')
check('second child follows sort order', codes.get('b'), 'PR-26-0001.02')
check('grandchild', codes.get('a1'), 'PR-26-0001.01.01')
check('grandchild in order', codes.get('a2'), 'PR-26-0001.01.02')
check('third level', codes.get('a1x'), 'PR-26-0001.01.01.01')
check('every node has a code', codes.size, 6)

const wide: Flat[] = [{ id: 'r', parent_id: null, sort_order: 0 }]
for (let i = 0; i < 12; i++) wide.push({ id: `n${i}`, parent_id: 'r', sort_order: i * 10 })
check('two digits above nine', wbsCodes(wide, 'r', 'X-26-0001').get('n9'), 'X-26-0001.10')
check('twelfth child', wbsCodes(wide, 'r', 'X-26-0001').get('n11'), 'X-26-0001.12')

check('path to a grandchild', pathTo(nodes, 'root', 'a1x'), ['root', 'a', 'a1', 'a1x'])
check('path to the project itself', pathTo(nodes, 'root', 'root'), ['root'])
check('path to something outside the tree', pathTo(nodes, 'root', 'ukendt'), [])

console.log(failed === 0 ? '\nAll tests passed.' : `\n${failed} test(s) failed.`)
process.exitCode = failed === 0 ? 0 : 1
