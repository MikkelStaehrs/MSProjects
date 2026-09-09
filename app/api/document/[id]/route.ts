import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { BUCKET } from '@/lib/document'

/**
 * Access to a file. The bucket is private, so no fixed URL exists. The server
 * issues a signed address that expires after a minute and sends the browser
 * there. No session, no file.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Not signed in', { status: 401 })

  const { data: doc } = await supabase
    .from('document')
    .select('path, name')
    .eq('id', id)
    .single()

  if (!doc) return new NextResponse('The document does not exist', { status: 404 })

  const { data: signed, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.path, 60, { download: doc.name })

  if (error || !signed) {
    return new NextResponse('Could not grant access to the file', { status: 500 })
  }

  return NextResponse.redirect(signed.signedUrl)
}
