/**
 * A query that fails must say so.
 *
 * Every page here reads with `data ?? []`, which turns a missing view into an
 * empty list and renders a page that looks fine and shows nothing. That is how
 * v_node_ready went unnoticed: the migration had rolled back, the tree drew no
 * sequence marks at all, and nothing anywhere said why.
 *
 * So the results are checked before they are used. A schema that is behind the
 * code is an error, not an empty state.
 */
export function firstError(
  results: { error: { message: string } | null }[],
): string | null {
  return results.map((r) => r.error).find(Boolean)?.message ?? null
}

export function QueryFailure({ message }: { message: string }) {
  return (
    <main className="px-16 py-12">
      <h1 className="font-display text-3xl">
        The database is not answering as expected
      </h1>
      <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">
        Usually a migration in supabase/migrations that has not been applied yet.
      </p>
      <pre className="mt-4 overflow-x-auto border border-rule bg-sheet p-4 text-xs">
        {message}
      </pre>
    </main>
  )
}
