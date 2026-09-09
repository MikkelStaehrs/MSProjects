'use server'

import { revalidatePath } from 'next/cache'
import { today } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import { collectReports } from '@/lib/report-data'
import { STAGES, type Stage, toSnapshot } from '@/lib/report'
import { required } from '@/lib/form'

/**
 * Stage is the only field a human chooses. It lives in node.reporting, which
 * has to be merged: the project number and account string are already there.
 */
export async function setStage(fd: FormData) {
  const supabase = await createClient()
  const nodeId = required(fd, 'node_id')
  const stage = String(fd.get('stage') ?? '')

  if (stage !== '' && !(STAGES as readonly string[]).includes(stage)) {
    throw new Error(`Unknown stage: ${stage}`)
  }

  const { data: node } = await supabase
    .from('node')
    .select('reporting')
    .eq('id', nodeId)
    .single()

  const reporting = { ...((node?.reporting ?? {}) as Record<string, unknown>) }
  if (stage === '') delete reporting.stage
  else reporting.stage = stage as Stage

  const { error } = await supabase.from('node').update({ reporting }).eq('id', nodeId)
  if (error) throw new Error(`Could not save stage: ${error.message}`)

  revalidatePath('/', 'layout')
}

/**
 * Saves the week's report. The fields are computed again on the server rather
 * than submitted from the page, so what is stored cannot differ from what was
 * shown.
 */
export async function saveReport(fd: FormData) {
  const supabase = await createClient()
  const nodeId = required(fd, 'node_id')
  const submitted = fd.get('submitted') === 'true'

  const reports = await collectReports(supabase, today())
  const report = reports.find((r) => r.project.id === nodeId)
  if (!report) throw new Error('The project is no longer running.')

  const { error } = await supabase.from('report').upsert(
    {
      node_id: nodeId,
      period_start: report.week.start,
      period_end: report.week.end,
      fields: report.fields,
      // Written once, at submission. See ReportSnapshot: this is the half of
      // the record that cannot be recomputed once the tree has moved on.
      context: toSnapshot(report.context),
      body_markdown: report.fields.comment,
      submitted,
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'node_id,period_start' },
  )

  if (error) throw new Error(`Could not save the report: ${error.message}`)
  revalidatePath('/', 'layout')
}

/** Undo the submission. The report stays, the mark goes. */
export async function unsubmitReport(fd: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('report')
    .update({ submitted: false })
    .eq('id', required(fd, 'id'))

  if (error) throw new Error(`Could not undo: ${error.message}`)
  revalidatePath('/', 'layout')
}
