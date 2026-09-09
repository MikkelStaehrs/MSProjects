import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BUCKET, MAX_BYTES } from '@/lib/document'

/**
 * Putting a file away, in one place.
 *
 * Both the documents panel and a cost line can take a file, and the two paths
 * have to agree about the name, the size limit and what happens when half of it
 * succeeds. Uploading to storage and then failing to write the row leaves a file
 * nobody can ever see, so the cleanup lives here rather than in each caller.
 */

/** File names become paths. Anything that is not safe is dropped. */
export function safeName(name: string) {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return cleaned === '' ? 'file' : cleaned
}

export async function storeFile(
  supabase: SupabaseClient,
  input: { nodeId: string; file: File; folder?: string | null },
): Promise<string> {
  const { nodeId, file } = input

  if (file.size === 0) throw new Error('Choose a file first.')
  if (file.size > MAX_BYTES) {
    throw new Error(
      `The file is ${Math.round(file.size / 1024 / 1024)} MB. The limit is 25 MB.`,
    )
  }

  const path = `${nodeId}/${crypto.randomUUID()}-${safeName(file.name)}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream' })

  if (uploadError) throw new Error(`Could not upload the file: ${uploadError.message}`)

  const folder = (input.folder ?? '').trim()

  const { data, error } = await supabase
    .from('document')
    .insert({
      node_id: nodeId,
      name: file.name,
      path,
      mime_type: file.type || null,
      size_bytes: file.size,
      folder: folder === '' ? null : folder,
    })
    .select('id')
    .single()

  // Without the row the file is invisible forever, so clean up right away.
  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error(`Could not save the document: ${error?.message}`)
  }

  return data.id as string
}
