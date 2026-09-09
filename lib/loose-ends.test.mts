import { looseEnds, type LooseInput } from './loose-ends.ts'

let failed = 0
function check(name: string, got: unknown, expected: unknown) {
  if (JSON.stringify(got) === JSON.stringify(expected)) console.log(`ok    ${name}`)
  else {
    failed++
    console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      got:      ${JSON.stringify(got)}`)
  }
}

const TODAY = '2026-09-10'

const node = (over: Partial<LooseInput['nodes'][0]> = {}) => ({
  id: 'n1',
  title: 'Calibrate at 130 kV',
  type: 'task',
  status: 'active',
  due_date: '2026-09-20',
  completed_at: null,
  ...over,
})

const run = (over: Partial<LooseInput>) =>
  looseEnds({
    nodes: [],
    entries: [],
    blockers: [],
    decisions: [],
    today: TODAY,
    ...over,
  })

const kinds = (over: Partial<LooseInput>) => run(over).map((l) => l.kind)

// --- Finished without a word ------------------------------------------------
check(
  'something finished and never written about',
  kinds({ nodes: [node({ status: 'done', completed_at: '2026-09-08T10:00:00Z' })] }),
  ['completed'],
)

check(
  'an entry the same day covers it',
  kinds({
    nodes: [node({ status: 'done', completed_at: '2026-09-08T10:00:00Z' })],
    entries: [{ node_id: 'n1', entry_date: '2026-09-08' }],
  }),
  [],
)

// You finish on Thursday and write about it on Friday. That is still writing
// about it.
check(
  'an entry two days later still covers it',
  kinds({
    nodes: [node({ status: 'done', completed_at: '2026-09-08T10:00:00Z' })],
    entries: [{ node_id: 'n1', entry_date: '2026-09-10' }],
  }),
  [],
)

check(
  'an entry a week later does not',
  kinds({
    nodes: [node({ status: 'done', completed_at: '2026-09-01T10:00:00Z' })],
    entries: [{ node_id: 'n1', entry_date: '2026-09-09' }],
  }),
  ['completed'],
)

check(
  'an entry on another node does not cover it',
  kinds({
    nodes: [node({ status: 'done', completed_at: '2026-09-08T10:00:00Z' })],
    entries: [{ node_id: 'other', entry_date: '2026-09-08' }],
  }),
  ['completed'],
)

// The moment for a line has passed. Nagging about last quarter is noise.
check(
  'older than the window is left alone',
  kinds({ nodes: [node({ status: 'done', completed_at: '2026-07-01T10:00:00Z' })] }),
  [],
)

// --- Blockers ---------------------------------------------------------------
const blocker = (over = {}) => ({
  node_id: 'n1',
  title: 'Server access and VLAN',
  waiting_on: 'IT',
  opened_at: '2026-09-08',
  resolved_at: null,
  ...over,
})

check(
  'opening a blocker asks what you asked for',
  kinds({ nodes: [node()], blockers: [blocker()] }),
  ['blocker_opened'],
)

check(
  'resolving one asks what the answer was',
  kinds({
    nodes: [node()],
    blockers: [blocker({ opened_at: '2026-07-01', resolved_at: '2026-09-09' })],
  }),
  ['blocker_resolved'],
)

// «You opened a blocker here» and «nothing has ever been logged here» are the
// same fact twice. The specific one wins.
check(
  'silence does not repeat what a blocker already asks',
  kinds({ nodes: [node()], blockers: [blocker()] }),
  ['blocker_opened'],
)

check(
  'two specific events on one node both stand',
  kinds({
    nodes: [node({ status: 'done', completed_at: '2026-09-08T10:00:00Z' })],
    blockers: [blocker({ opened_at: '2026-09-07' })],
  }),
  ['completed', 'blocker_opened'],
)

check(
  'a blocker on a node that no longer exists is skipped',
  kinds({ nodes: [], blockers: [blocker()] }),
  [],
)

// --- Silence on live work ---------------------------------------------------
check(
  'an active dated node nobody has ever written about',
  kinds({ nodes: [node()] }),
  ['stale'],
)

check(
  'a recent entry is not silence',
  kinds({ nodes: [node()], entries: [{ node_id: 'n1', entry_date: '2026-09-05' }] }),
  [],
)

check(
  'silence starts at fourteen days',
  kinds({ nodes: [node()], entries: [{ node_id: 'n1', entry_date: '2026-08-27' }] }),
  ['stale'],
)

// An idea nobody has started is supposed to be quiet.
check(
  'an idea is not nagged about',
  kinds({ nodes: [node({ status: 'idea' })] }),
  [],
)

check(
  'an active node with no date is not nagged about',
  kinds({ nodes: [node({ due_date: null })] }),
  [],
)

check(
  'a paused node is not nagged about',
  kinds({ nodes: [node({ status: 'paused' })] }),
  [],
)

// You log on the work, not on the box. A subproject is active because its
// children are.
check(
  'a container is never asked for a line of its own',
  kinds({ nodes: [node({ type: 'subproject' })] }),
  [],
)

check(
  'a development container is not either',
  kinds({ nodes: [node({ type: 'development' })] }),
  [],
)

// --- Order ------------------------------------------------------------------
check(
  'newest first',
  run({
    nodes: [
      node({ id: 'a', status: 'done', completed_at: '2026-09-02T10:00:00Z' }),
      node({ id: 'b', status: 'done', completed_at: '2026-09-09T10:00:00Z' }),
    ],
  }).map((l) => l.on),
  ['2026-09-09', '2026-09-02'],
)

check(
  'the text names the node',
  run({ nodes: [node({ status: 'done', completed_at: '2026-09-08T10:00:00Z' })] })[0].what,
  'Finished Calibrate at 130 kV',
)

// --- Building something without saying why ----------------------------------
const dev = (over: Partial<LooseInput['nodes'][0]> = {}) =>
  node({ id: 'd1', title: 'Data Collector', type: 'development', status: 'active', ...over })

check(
  'a development node being worked on with nothing decided',
  kinds({
    nodes: [dev()],
    entries: [{ node_id: 'd1', entry_date: '2026-09-09' }],
  }),
  ['undecided'],
)

check(
  'one decision is enough to stop asking',
  kinds({
    nodes: [dev()],
    entries: [{ node_id: 'd1', entry_date: '2026-09-09' }],
    decisions: [{ node_id: 'd1' }],
  }),
  [],
)

check(
  'a decision on a different node does not count',
  kinds({
    nodes: [dev()],
    entries: [{ node_id: 'd1', entry_date: '2026-09-09' }],
    decisions: [{ node_id: 'somewhere-else' }],
  }),
  ['undecided'],
)

check('nothing logged on it yet, so nothing to ask about', kinds({ nodes: [dev()] }), [])

check(
  'planned counts, because that is when the choices get made',
  kinds({
    nodes: [dev({ status: 'planned' })],
    entries: [{ node_id: 'd1', entry_date: '2026-09-09' }],
  }),
  ['undecided'],
)

check(
  'a finished one is not asked what it decided',
  kinds({
    nodes: [dev({ status: 'done' })],
    entries: [{ node_id: 'd1', entry_date: '2026-09-09' }],
  }),
  [],
)

check(
  'a task is never asked. The choices live on the development node',
  kinds({
    nodes: [node({ id: 'd1', due_date: null })],
    entries: [{ node_id: 'd1', entry_date: '2026-09-09' }],
  }),
  [],
)

check(
  'a subproject is a container, not a place that decides',
  kinds({
    nodes: [dev({ type: 'subproject' })],
    entries: [{ node_id: 'd1', entry_date: '2026-09-09' }],
  }),
  [],
)

check(
  'it is dated by the last time the node was worked on',
  run({
    nodes: [dev()],
    entries: [
      { node_id: 'd1', entry_date: '2026-08-01' },
      { node_id: 'd1', entry_date: '2026-09-09' },
    ],
  })[0].on,
  '2026-09-09',
)

check(
  'the undecided text names the node',
  run({
    nodes: [dev()],
    entries: [{ node_id: 'd1', entry_date: '2026-09-09' }],
  })[0].what,
  'Nothing decided on record for Data Collector',
)

console.log(failed === 0 ? '\nAll tests passed.' : `\n${failed} test(s) failed.`)
process.exitCode = failed === 0 ? 0 : 1
