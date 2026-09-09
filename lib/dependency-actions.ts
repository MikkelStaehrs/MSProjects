'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { required } from '@/lib/form'

/** node_id waits on depends_on_id. */
export async function addDependency(fd: FormData) {
  const supabase = await createClient()
  const nodeId = required(fd, 'node_id')
  const dependsOn = required(fd, 'depends_on_id')
  const note = String(fd.get('note') ?? '').trim()

  if (nodeId === dependsOn) {
    throw new Error('A node cannot wait on itself.')
  }

  const { error } = await supabase.from('node_dependency').insert({
    node_id: nodeId,
    depends_on_id: dependsOn,
    note: note === '' ? null : note,
  })

  // The same edge twice is not a failure the user should see a stack for.
  if (error && !error.message.includes('duplicate key')) {
    throw new Error(`Could not save the dependency: ${error.message}`)
  }

  revalidatePath('/', 'layout')
  redirect(String(fd.get('redirectTo') ?? '/'))
}

export async function removeDependency(fd: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('node_dependency')
    .delete()
    .eq('id', required(fd, 'id'))

  if (error) throw new Error(`Could not remove the dependency: ${error.message}`)

  revalidatePath('/', 'layout')
  redirect(String(fd.get('redirectTo') ?? '/'))
}
