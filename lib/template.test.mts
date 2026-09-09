import {
  countMilestones,
  countNodes,
  deriveTemplate,
  planNodes,
  folderLabel,
  folderNumber,
  readBody,
  spanDays,
} from './template.ts'
import { addDays, daysBetween } from './date.ts'

let failed = 0
function check(name: string, got: unknown, expected: unknown) {
  if (JSON.stringify(got) === JSON.stringify(expected)) {
    console.log(`ok    ${name}`)
  } else {
    failed++
    console.log(
      `FEJL  ${name}\n      ventet: ${JSON.stringify(expected)}\n      fik:    ${JSON.stringify(got)}`,
    )
  }
}

// --- Date arithmetic ------------------------------------------------------
check('days forward', addDays('2026-09-01', 30), '2026-10-01')
check('days back', addDays('2026-09-01', -1), '2026-08-31')
check('across a month boundary', daysBetween('2026-08-31', '2026-09-06'), 6)
check('across a year boundary', daysBetween('2025-12-28', '2026-01-04'), 7)

// --- Deriving from a project tree -----------------------------------------
const rows = [
  { id: 'p', parent_id: null, title: 'Projekt', type: 'project' as const, due_date: '2026-11-15', is_milestone: false, sort_order: 10 },
  { id: 'a', parent_id: 'p', title: 'Indkøb', type: 'subproject' as const, due_date: '2026-09-06', is_milestone: false, sort_order: 10 },
  { id: 'a2', parent_id: 'a', title: 'Tilbud', type: 'task' as const, due_date: '2026-08-14', is_milestone: false, sort_order: 20 },
  { id: 'a1', parent_id: 'a', title: 'Kravspec', type: 'task' as const, due_date: '2026-07-23', is_milestone: true, sort_order: 10 },
  { id: 'b', parent_id: 'p', title: 'Installation', type: 'subproject' as const, due_date: null, is_milestone: false, sort_order: 20 },
]

const derived = deriveTemplate(rows, 'p', '2026-07-01')

check('the root is not part of the tree', derived.length, 2)
check('siblings come in sort_order', derived[0].children.map((c) => c.title), ['Kravspec', 'Tilbud'])
check('a due date becomes days from the start', derived[0].offset_days, 67)
check('the milestone flag comes along', derived[0].children[0].is_milestone, true)
check('a node with no due date gets null', derived[1].offset_days, null)
check('node count', countNodes(derived), 4)
check('milestone count', countMilestones(derived), 1)
check('the length of the run', spanDays(derived), 67)

// --- Deployment -----------------------------------------------------------
const planned = planNodes(derived, '2027-01-04')

check('every node is planned', planned.length, 4)
check('the first node has no parent', planned[0].parentIndex, null)
check('a child points at its parent', planned[1].parentIndex, 0)
check(
  'the due date is counted from the new start date',
  planned[0].due_date,
  addDays('2027-01-04', 67),
)
check('a node with no due date stays without one', planned[3].due_date, null)
check('siblings are numbered in tens', planned.map((p) => p.sort_order), [10, 10, 20, 20])

// A tree derived and deployed on the same start must give the original dates
const roundTrip = planNodes(deriveTemplate(rows, 'p', '2026-07-01'), '2026-07-01')
check('the round trip preserves the dates', roundTrip.map((p) => p.due_date), [
  '2026-09-06',
  '2026-07-23',
  '2026-08-14',
  null,
])

// --- Robustness -----------------------------------------------------------
check('an empty body', readBody(null), { nodes: [], risks: [], folders: [] })
check('a body with no risks', readBody({ nodes: [] }), { nodes: [], risks: [], folders: [] })
check('an empty tree has no run', spanDays([]), null)
check(
  'folders are read and non strings are dropped',
  readBody({ folders: ['01 Aftaler', 42, '02 Tilbud'] }).folders,
  ['01 Aftaler', '02 Tilbud'],
)

// --- Folder names ---------------------------------------------------------
check('the number is read out', folderNumber('03 Quotes and pricing'), '03')
check('the label without its number', folderLabel('03 Quotes and pricing'), 'Quotes and pricing')
check('a folder with no number', folderNumber('Other'), null)
check('the label when there is no number', folderLabel('Other'), 'Other')
check('a label that is only a number is kept', folderLabel('07'), '07')

console.log(failed === 0 ? '\nAll tests passed.' : `\n${failed} test(s) failed.`)
process.exitCode = failed === 0 ? 0 : 1
