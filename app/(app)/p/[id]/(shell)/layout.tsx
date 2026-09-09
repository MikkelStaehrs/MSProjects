import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QuickAddTrigger } from '@/components/quick-add-trigger'
import { Rule } from '@/components/ui'
import { readIdentity } from '@/lib/identity'
import { CATEGORY_LABEL, type Node } from '@/lib/types'

/**
 * Only the context band lives here. The title block, the sub navigation and
 * the right column moved into ProjectFrame, which the pages render, because
 * a layout cannot read search params and therefore cannot know which part of
 * the tree you are looking at.
 */
export default async function ProjectShell({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const base = `/p/${id}`

  const { data } = await supabase.from('node').select('*').eq('id', id).single()
  const project = data as Node | null
  if (!project) notFound()

  const identity = readIdentity(project.reporting)

  return (
    <main>
      <div className="frame">
        <div className="lbl pl-5 lg:pl-16 py-3 pr-5 text-muted">Project</div>
        <div className="lbl border-l border-rule px-5 lg:px-10 py-3">
          {/* The path reads as one address: Production.PR-26-0001 */}
          <span className="text-ink">
            {project.category ? CATEGORY_LABEL[project.category] : 'No category'}
            {identity.admin.project_no && (
              <>
                <span className="text-rule-strong">.</span>
                {identity.admin.project_no}
              </>
            )}
          </span>
          {identity.admin.portfolio && (
            <span className="text-muted"> &nbsp;·&nbsp; {identity.admin.portfolio}</span>
          )}
          {identity.admin.account && (
            <span className="text-muted"> &nbsp;·&nbsp; {identity.admin.account}</span>
          )}
        </div>
        <div className="flex items-center justify-end gap-6 border-l border-rule py-3 pl-5 lg:pl-8 pr-5 lg:pr-16">
          <Link href={`${base}/map`} className="lbl text-muted hover:text-ink">
            Map
          </Link>
          <Link href={`${base}?edit=${id}`} className="lbl text-muted hover:text-ink">
            Edit project
          </Link>
          <QuickAddTrigger />
        </div>
      </div>
      <Rule strong />

      {children}
    </main>
  )
}
