import { contributionOf, notStartedShare, strategyPicture, type Marking } from './strategy.ts'

let failed = 0
function check(name: string, got: unknown, expected: unknown) {
  if (JSON.stringify(got) === JSON.stringify(expected)) console.log(`ok    ${name}`)
  else {
    failed++
    console.log(
      `FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      got:      ${JSON.stringify(got)}`,
    )
  }
}

const m = (over: Partial<Marking> = {}): Marking => ({
  nodeId: 'n1',
  isTop: true,
  annualEur: null,
  ownBenefit: null,
  status: 'active',
  blocked: false,
  investedEur: 0,
  ...over,
})

// --- What one marking promises ---------------------------------------------
check('nothing stated anywhere is unknown, not zero', contributionOf(m()), null)

check(
  'a whole project falls back to its own benefit',
  contributionOf(m({ ownBenefit: 40000 })),
  40000,
)

check(
  'a figure on the marking wins, because it was written about this strategy',
  contributionOf(m({ ownBenefit: 40000, annualEur: 15000 })),
  15000,
)

check('a stated zero is a figure, not a blank', contributionOf(m({ annualEur: 0 })), 0)

// --- The picture ------------------------------------------------------------
check(
  'nothing marked',
  strategyPicture([], 100000),
  { counted: 0, promised: 0, unquantified: 0, delivered: 0, invested: 0, stalled: 0,
    target: 100000, shortfall: 100000 },
)

check(
  'two projects, added up',
  strategyPicture([m({ ownBenefit: 40000 }), m({ ownBenefit: 25000 })], 100000).promised,
  65000,
)

/*
 * The reason v_strategy_node exists. A marked subproject inside a marked
 * project is one contribution.
 */
check(
  'a nested marking is not counted',
  strategyPicture(
    [m({ ownBenefit: 40000 }), m({ isTop: false, annualEur: 12000 })],
    null,
  ),
  { counted: 1, promised: 40000, unquantified: 0, delivered: 0, invested: 0, stalled: 0,
    target: null, shortfall: null },
)

check(
  'a marking with no figure is counted as unknown, never as zero',
  strategyPicture([m({ ownBenefit: 40000 }), m()], 100000),
  { counted: 2, promised: 40000, unquantified: 1, delivered: 0, invested: 0, stalled: 0,
    target: 100000, shortfall: null },
)

check(
  'the shortfall stays null while anything counted has no figure',
  strategyPicture([m()], 100000).shortfall,
  null,
)

check(
  'and appears once everything carries one',
  strategyPicture([m({ ownBenefit: 40000 })], 100000).shortfall,
  60000,
)

check(
  'promising more than the target gives a negative shortfall, not a floor of zero',
  strategyPicture([m({ ownBenefit: 140000 })], 100000).shortfall,
  -40000,
)

check(
  'delivered is the part already finished',
  strategyPicture(
    [m({ ownBenefit: 40000, status: 'done' }), m({ ownBenefit: 25000, status: 'active' })],
    null,
  ).delivered,
  40000,
)

check(
  'blocked and on hold both count as stalled',
  strategyPicture(
    [m({ blocked: true }), m({ status: 'paused' }), m({ status: 'active' })],
    null,
  ).stalled,
  2,
)

check(
  'investment is summed even where the benefit is unknown',
  strategyPicture([m({ investedEur: 12000 }), m({ investedEur: 3000 })], null).invested,
  15000,
)

check(
  'a nested marking does not add its investment either',
  strategyPicture([m({ investedEur: 12000 }), m({ isTop: false, investedEur: 9000 })], null).invested,
  12000,
)

// --- How much rests on work nobody has started ------------------------------
check('nothing to divide by', notStartedShare([]), null)

check(
  'half the promise is still an idea',
  notStartedShare([m({ ownBenefit: 50000, status: 'idea' }), m({ ownBenefit: 50000, status: 'active' })]),
  0.5,
)

check(
  'planned counts as not started',
  notStartedShare([m({ ownBenefit: 10000, status: 'planned' })]),
  1,
)

check(
  'a marking with no figure is left out of the share rather than treated as nothing',
  notStartedShare([m({ ownBenefit: 50000, status: 'active' }), m({ status: 'idea' })]),
  0,
)

console.log(failed === 0 ? '\nAll tests passed.' : `\n${failed} test(s) failed.`)
process.exitCode = failed === 0 ? 0 : 1
