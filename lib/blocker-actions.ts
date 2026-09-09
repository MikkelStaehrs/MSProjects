'use server'

import { revalidatePath } from 'next/cache'
import { today } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import type { WaitingOnType } from '@/lib/types'
import { back, required, text } from '@/lib/form'
import { settleRecipient } from '@/lib/recipient-data'

export async function createBlocker(fd: FormData) {
  const supabase = await createClient()

  // The same gate as quick entry: one spelling per recipient, always.
  const now = today()
  const settled = await settleRecipient(supabase, required(fd, 'waiting_on'), now)

  const { error } = await supabase.from('blocker').insert({
    node_id: required(fd, 'node_id'),
    title: required(fd, 'title'),
    waiting_on: settled.name,
    waiting_on_type: (text(fd, 'waiting_on_type') ?? 'other') as WaitingOnType,
    opened_at: text(fd, 'opened_at') ?? undefined,
    expected_by: text(fd, 'expected_by') ?? settled.expectedBy,
  })

  if (error) throw new Error(`Could not open blocker: ${error.message}`)
  revalidatePath('/', 'layout')
  back(fd)
}

export async function updateBlocker(fd: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('blocker')
    .update({
      title: required(fd, 'title'),
      waiting_on: (await settleRecipient(supabase, required(fd, 'waiting_on'),
        today())).name,
      waiting_on_type: (text(fd, 'waiting_on_type') ?? 'other') as WaitingOnType,
      opened_at: required(fd, 'opened_at'),
      expected_by: text(fd, 'expected_by'),
      resolved_at: text(fd, 'resolved_at'),
      resolution: text(fd, 'resolution'),
    })
    .eq('id', required(fd, 'id'))

  if (error) throw new Error(`Could not save blocker: ${error.message}`)
  revalidatePath('/', 'layout')
  back(fd)
}

/**
 * The action used most: stop the clock. The day count freezes by itself,
 * because days_blocked is measured from resolved_at once that exists.
 */
export async function resolveBlocker(fd: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('blocker')
    .update({
      resolved_at: text(fd, 'resolved_at') ?? today(),
      resolution: text(fd, 'resolution'),
    })
    .eq('id', required(fd, 'id'))

  if (error) throw new Error(`Could not close blocker: ${error.message}`)
  revalidatePath('/', 'layout')
  back(fd)
}

/** Reopening: the clock continues from the original opened_at. */
export async function reopenBlocker(fd: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('blocker')
    .update({ resolved_at: null, resolution: null })
    .eq('id', required(fd, 'id'))

  if (error) throw new Error(`Could not reopen blocker: ${error.message}`)
  revalidatePath('/', 'layout')
  back(fd)
}

export async function deleteBlocker(fd: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('blocker').delete().eq('id', required(fd, 'id'))

  if (error) throw new Error(`Could not delete blocker: ${error.message}`)
  revalidatePath('/', 'layout')
  back(fd)
}
