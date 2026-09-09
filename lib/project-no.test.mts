import {
  formatProjectNo,
  nextProjectNo,
  parseProjectNo,
  prefixFor,
  yearOf,
} from './project-no.ts'

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

// --- Shape ----------------------------------------------------------------
check('formatting', formatProjectNo({ prefix: 'CX', year: 26, serial: 1 }), 'CX-26-0001')
check('the serial is padded', formatProjectNo({ prefix: 'IT', year: 26, serial: 42 }), 'IT-26-0042')
check('a four digit serial', formatProjectNo({ prefix: 'PR', year: 27, serial: 1234 }), 'PR-27-1234')
check('a year under ten is padded', formatProjectNo({ prefix: 'AN', year: 7, serial: 3 }), 'AN-07-0003')

check('parsing', parseProjectNo('CX-26-0001'), { prefix: 'CX', year: 26, serial: 1 })
check('surrounding whitespace is tolerated', parseProjectNo('  IT-26-0042 '), { prefix: 'IT', year: 26, serial: 42 })
check('the old form is rejected', parseProjectNo('CX-2601'), null)
check('lower case is rejected', parseProjectNo('cx-26-0001'), null)
check('three letters are rejected', parseProjectNo('CAP-26-0001'), null)
check('empty is rejected', parseProjectNo(''), null)
check('a non string is rejected', parseProjectNo(42), null)
check('null is rejected', parseProjectNo(null), null)

// --- Category -------------------------------------------------------------
check('capex', prefixFor('capex'), 'CX')
check('production', prefixFor('production'), 'PR')
check('it', prefixFor('it'), 'IT')
check('other', prefixFor('other'), 'AN')
check('no category gives no prefix', prefixFor(null), null)

// --- Year -----------------------------------------------------------------
check('the year from a date', yearOf('2026-09-02'), 26)
check('the turn of the year', yearOf('2027-01-01'), 27)

// --- The next number ------------------------------------------------------
check('the first in the category', nextProjectNo([], 'CX', 26), 'CX-26-0001')
check(
  'counts up from the highest',
  nextProjectNo(['CX-26-0001', 'CX-26-0002'], 'CX', 26),
  'CX-26-0003',
)
check(
  'gaps are never filled in',
  nextProjectNo(['CX-26-0001', 'CX-26-0007'], 'CX', 26),
  'CX-26-0008',
)
check(
  'another category counts on its own',
  nextProjectNo(['CX-26-0009'], 'IT', 26),
  'IT-26-0001',
)
check(
  'a new year starts over',
  nextProjectNo(['CX-26-0009'], 'CX', 27),
  'CX-27-0001',
)
check(
  'rubbish in the list is ignored',
  nextProjectNo(['CX-2601', null, 42, '', 'CX-26-0003'], 'CX', 26),
  'CX-26-0004',
)

let threw = false
try {
  nextProjectNo(['CX-26-9999'], 'CX', 26)
} catch {
  threw = true
}
check('number 10000 is refused rather than rolling over', threw, true)

console.log(failed === 0 ? '\nAll tests passed.' : `\n${failed} test(s) failed.`)
process.exitCode = failed === 0 ? 0 : 1
