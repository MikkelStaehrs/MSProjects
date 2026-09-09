import { opening, paragraphs } from './prose.ts'

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

const NL = String.fromCharCode(10)

check('nothing at all', paragraphs(null), [])
check('empty string', paragraphs(''), [])
check('whitespace only', paragraphs(`  ${NL} ${NL}  `), [])

check('one paragraph', paragraphs('One line.'), ['One line.'])

check(
  'a blank line separates paragraphs',
  paragraphs(`First.${NL}${NL}Second.`),
  ['First.', 'Second.'],
)

/*
 * The case that sent this file into being. Every description in the real
 * database separates paragraphs with a line holding a single space, which is
 * what a textarea leaves behind. Splitting on two newlines finds nothing.
 */
check(
  'a line holding a single space also separates them',
  paragraphs(`First.${NL} ${NL}Second.`),
  ['First.', 'Second.'],
)

check(
  'a tab counts as blank too',
  paragraphs(`First.${NL}\t${NL}Second.`),
  ['First.', 'Second.'],
)

check(
  'several blank lines are still one break',
  paragraphs(`First.${NL}${NL} ${NL}${NL}Second.`),
  ['First.', 'Second.'],
)

check(
  'a single newline stays inside the paragraph',
  paragraphs(`Sensor A${NL}Sensor B`),
  [`Sensor A${NL}Sensor B`],
)

check(
  'trailing spaces on a line are dropped',
  paragraphs(`Sensor A   ${NL}Sensor B`),
  [`Sensor A${NL}Sensor B`],
)

check(
  'windows line endings',
  paragraphs('First.\r\n\r\nSecond.'),
  ['First.', 'Second.'],
)

// --- The opening ------------------------------------------------------------
check('nothing to open', opening(null), { first: null, rest: [] })

check('one paragraph has no rest, so nothing is hidden', opening('All of it.'), {
  first: 'All of it.',
  rest: [],
})

check(
  'the first paragraph opens, the others wait',
  opening(`One.${NL} ${NL}Two.${NL} ${NL}Three.`),
  { first: 'One.', rest: ['Two.', 'Three.'] },
)

console.log(failed === 0 ? '\nAll tests passed.' : `\n${failed} test(s) failed.`)
process.exitCode = failed === 0 ? 0 : 1
