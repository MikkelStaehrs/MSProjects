import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { nextProjectNo, prefixFor, yearOf } from '@/lib/project-no'
import type { NodeCategory } from '@/lib/types'

/**
 * Assigns a project number when the node is a top level project, has a
 * category, and does not already have one. Assigned once only. Called both on
 * creation and the first time a category is set on a project that lacked one.
 *
 * Returns the updated reporting, or the unchanged one when there is nothing
 * to do.
 */
export async function assignProjectNo(
  supabase: SupabaseClient,
  reporting: Record<string, unknown>,
  category: NodeCategory | null,
  isRoot: boolean,
  today: string,
): Promise<Record<string, unknown>> {
  if (!isRoot) return reporting
  if (typeof reporting.project_no === 'string' && reporting.project_no !== '') {
    return reporting
  }

  const prefix = prefixFor(category)
  if (prefix === null) return reporting

  const { data } = await supabase.from('node').select('reporting').is('parent_id', null)
  const existing = (data ?? []).map(
    (r) => (r.reporting as Record<string, unknown> | null)?.project_no,
  )

  return { ...reporting, project_no: nextProjectNo(existing, prefix, yearOf(today)) }
}
