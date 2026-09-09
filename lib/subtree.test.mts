import { childrenByParent, descendantIds, subtreeIds, subtreeSet } from './subtree.ts'

let failed = 0
function check(name: string, got: unknown, expected: unknown) {
  if (JSON.stringify(got) === JSON.stringify(expected)) console.log(`ok    ${name}`)
  else {
    failed++
    console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      got:      ${JSON.stringify(got)}`)
  }
}

const nodes = [
  { id: 'root', parent_id: null },
  { id: 'a', parent_id: 'root' },
  { id: 'a1', parent_id: 'a' },
  { id: 'a1x', parent_id: 'a1' },
  { id: 'b', parent_id: 'root' },
  { id: 'other', parent_id: null },
]

// v_node_descendant includes the root at depth zero, so this has to as well or
// a caller swapping one for the other would silently lose a row.
check('the root is part of its own subtree', subtreeIds(nodes, 'root'), [
  'root', 'a', 'a1', 'a1x', 'b',
])
check('a branch is only its own branch', subtreeIds(nodes, 'a'), ['a', 'a1', 'a1x'])
check('a leaf is just itself', subtreeIds(nodes, 'a1x'), ['a1x'])
check('another root is not included', subtreeIds(nodes, 'root').includes('other'), false)
check('an unknown id gives just itself', subtreeIds(nodes, 'ghost'), ['ghost'])

check('descendants leave the node out', descendantIds(nodes, 'a'), ['a1', 'a1x'])
check('a leaf has no descendants', descendantIds(nodes, 'b'), [])

check('the set is the same members', [...subtreeSet(nodes, 'a')].sort(), ['a', 'a1', 'a1x'])

check('children come in the order given', childrenByParent(nodes).get('root')?.map((n) => n.id), ['a', 'b'])
check('a leaf has no children entry', childrenByParent(nodes).has('a1x'), false)
check('roots are not children of anything', childrenByParent(nodes).has('null'), false)

console.log(failed === 0 ? '\nAll tests passed.' : `\n${failed} test(s) failed.`)
process.exitCode = failed === 0 ? 0 : 1
