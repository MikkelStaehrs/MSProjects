'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { EntryKind } from '@/lib/types'
import { required } from '@/lib/form'

/**
 * The log entry is the raw material of the weekly report. If it cannot be
 * corrected the report cannot either, and a typo ends up in the company
 * system.
 */
export async function updateEntry(fd: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('entry')
    .update({
      entry_date: required(fd, 'entry_date'),
      kind: required(fd, 'kind') as EntryKind,
      body: required(fd, 'body'),
    })
    .eq('id', required(fd, 'id'))

  if (error) throw new Error(`Could not save the log entry: ${error.message}`)
  revalidatePath('/', 'layout')
  redirect(String(fd.get('redirectTo') ?? '/'))
}

export async function deleteEntry(fd: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('entry').delete().eq('id', required(fd, 'id'))

  if (error) throw new Error(`Could not delete the log entry: ${error.message}`)
  revalidatePath('/', 'layout')
  redirect(String(fd.get('redirectTo') ?? '/'))
}
