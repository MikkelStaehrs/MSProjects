'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BUCKET } from '@/lib/document'
import { storeFile } from '@/lib/document-store'
import { required } from '@/lib/form'

export async function uploadDocument(fd: FormData) {
  const supabase = await createClient()
  const file = fd.get('file')
  if (!(file instanceof File)) throw new Error('Choose a file first.')

  await storeFile(supabase, {
    nodeId: required(fd, 'node_id'),
    file,
    folder: String(fd.get('folder') ?? ''),
  })

  revalidatePath('/', 'layout')
  redirect(String(fd.get('redirectTo') ?? '/'))
}

/** Move a file to another folder. Only the label changes, not the path. */
export async function moveDocument(fd: FormData) {
  const supabase = await createClient()
  const folder = String(fd.get('folder') ?? '').trim()

  const { error } = await supabase
    .from('document')
    .update({ folder: folder === '' ? null : folder })
    .eq('id', required(fd, 'id'))

  if (error) throw new Error(`Could not move the document: ${error.message}`)
  revalidatePath('/', 'layout')
}

export async function deleteDocument(fd: FormData) {
  const supabase = await createClient()
  const id = required(fd, 'id')

  const { data: doc } = await supabase
    .from('document')
    .select('path')
    .eq('id', id)
    .single()

  if (doc) await supabase.storage.from(BUCKET).remove([doc.path])

  const { error } = await supabase.from('document').delete().eq('id', id)
  if (error) throw new Error(`Could not delete the document: ${error.message}`)

  revalidatePath('/', 'layout')
  redirect(String(fd.get('redirectTo') ?? '/'))
}

/**
 * Files in storage do not follow when a node is deleted. Only the database
 * row does, through the cascade. So they are cleared explicitly first.
 */
export async function purgeDocumentsForSubtree(nodeId: string) {
  const supabase = await createClient()

  const { data: subtree } = await supabase
    .from('v_node_descendant')
    .select('node_id')
    .eq('root_id', nodeId)

  const ids = (subtree ?? []).map((d) => d.node_id)
  if (ids.length === 0) return

  const { data: docs } = await supabase.from('document').select('path').in('node_id', ids)
  const paths = (docs ?? []).map((d) => d.path)
  if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths)
}
