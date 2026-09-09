import {
  canonicalRecipient,
  isKnownRecipient,
  medianWait,
  normaliseName,
} from './recipient.ts'

let failed = 0
function check(name: string, got: unknown, expected: unknown) {
  if (JSON.stringify(got) === JSON.stringify(expected)) console.log(`ok    ${name}`)
  else {
    failed++
    console.log(`FAIL  ${name}\n      expected: ${JSON.stringify(expected)}\n      got:      ${JSON.stringify(got)}`)
  }
}

// --- Names ------------------------------------------------------------------
check('surrounding space is trimmed', normaliseName('  IT  '), 'IT')
check('inner runs collapse', normaliseName('Project  Board'), 'Project Board')
check('tabs and newlines count as space', normaliseName('Project\tBoard'), 'Project Board')
check('an empty name stays empty', normaliseName('   '), '')

const known = ['Project Board', 'ELT Acceptance', 'IT']

// --- The spelling that already exists wins ----------------------------------
check('exact match is kept', canonicalRecipient('Project Board', known), 'Project Board')
check('case is folded to the known spelling', canonicalRecipient('project board', known), 'Project Board')
check('shouting is folded too', canonicalRecipient('PROJECT BOARD', known), 'Project Board')
check('double space is folded', canonicalRecipient('Project  Board', known), 'Project Board')
check('padding is folded', canonicalRecipient('  IT ', known), 'IT')

// --- A new recipient keeps what was typed -----------------------------------
check('a new name is kept as written', canonicalRecipient('Maintenance', known), 'Maintenance')
check('a new name is still normalised', canonicalRecipient(' Group  Data ', known), 'Group Data')
check('an empty name gives an empty name', canonicalRecipient('   ', known), '')
check('nothing known yet', canonicalRecipient('project board', []), 'project board')

// --- Known or not -----------------------------------------------------------
check('known ignores case', isKnownRecipient('elt acceptance', known), true)
check('unknown is unknown', isKnownRecipient('Maintenance', known), false)
check('empty is never known', isKnownRecipient('  ', known), false)

// --- The measured wait ------------------------------------------------------
check('no history gives no expectation', medianWait([]), null)
check('one closed case is the median', medianWait([12]), 12)
check('odd count takes the middle', medianWait([3, 30, 9]), 9)
check('even count averages the two middles', medianWait([4, 10, 20, 30]), 15)
check('rounded to whole days', medianWait([4, 11]), 8)

// The point of the median: one application that sat for half a year must not
// move the expectation for the next ordinary question.
check(
  'an outlier does not move the expectation',
  medianWait([5, 6, 7, 8, 190]),
  7,
)

check('a same day answer never promises zero', medianWait([0, 0, 0]), 1)
check('negative days are ignored as impossible', medianWait([-4, 10, 12]), 11)

console.log(failed === 0 ? '\nAll tests passed.' : `\n${failed} test(s) failed.`)
process.exitCode = failed === 0 ? 0 : 1
