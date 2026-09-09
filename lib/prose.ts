/**
 * Text you typed, shown the way you typed it.
 *
 * A description is written in a textarea, with paragraphs, and every page was
 * rendering it inside a single <p>. HTML collapses whitespace, so four
 * paragraphs of specification arrived as one unbroken slab and the structure
 * the author put there was silently thrown away.
 *
 * The separator is not always a truly empty line. Real descriptions in this
 * database are separated by a line holding a single space, because that is what
 * a textarea produces when you press return twice and the cursor drifts. A
 * paragraph break is therefore a line with nothing but whitespace on it, not
 * strictly "\n\n".
 *
 * A single newline inside a paragraph stays a line break. Someone listing three
 * sensors on three lines means three lines.
 */

/** The paragraphs of a written text, in order, with the blank ones dropped. */
export function paragraphs(text: string | null | undefined): string[] {
  if (!text) return []
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    // Trailing spaces before a newline are invisible in a textarea and would
    // otherwise widen the line by a character nobody typed on purpose.
    .map((p) => p.replace(/[ \t]+$/gm, '').trim())
    .filter((p) => p.length > 0)
}

/**
 * What to show before asking to see the rest.
 *
 * The break is a paragraph, never a character count: cutting mid-sentence and
 * appending an ellipsis reads as damage, while a first paragraph reads as an
 * opening. Where the whole text is one paragraph there is nothing to hide, and
 * showing it whole is the honest outcome rather than a truncation.
 */
export function opening(text: string | null | undefined): {
  first: string | null
  rest: string[]
} {
  const all = paragraphs(text)
  return { first: all[0] ?? null, rest: all.slice(1) }
}
