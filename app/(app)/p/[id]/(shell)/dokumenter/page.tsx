import { notFound } from 'next/navigation'
import { ProjectFrame } from '@/components/project-frame'
import { createClient } from '@/lib/supabase/server'
import { subtreeSet } from '@/lib/subtree'
import { DocumentPanel } from '@/components/document-panel'
import type { Document, Node } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const base = `/p/${id}/dokumenter`

  /*
   * One round trip. Asking which nodes sit underneath and only then filtering
   * by the answer costs a second wait for nothing at this size.
   */
  const [projectRes, titlesRes, docRes] = await Promise.all([
    supabase.from('node').select('*').eq('id', id).single(),
    supabase.from('node').select('id, parent_id, title'),
    supabase
      .from('document')
      .select('*')
      
      .order('created_at', { ascending: false }),
  ])

  const project = projectRes.data as Node | null
  if (!project) notFound()

  // Fetched whole, cut here. See lib/subtree.
  const everyNode = (titlesRes.data ?? []) as {
    id: string
    parent_id: string | null
    title: string
  }[]
  const inProject = subtreeSet(everyNode, id)

  const documents = ((docRes.data ?? []) as Document[]).filter((d) =>
    inProject.has(d.node_id),
  )
  const titleById = new Map(
    everyNode.filter((n) => inProject.has(n.id)).map((n) => [
      n.id,
      n.title,
    ]),
  )

  return (
    <ProjectFrame projectId={id} frameNodeId={id}>
    <div className="px-5 lg:px-10 py-7">
      <DocumentPanel
        nodeId={project.id}
        documents={documents}
        folders={
          Array.isArray(project.reporting?.folders)
            ? (project.reporting.folders as string[])
            : []
        }
        titleById={titleById}
        redirectTo={base}
      />
    </div>
    </ProjectFrame>
  )
}
