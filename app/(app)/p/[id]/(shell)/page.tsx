import Link from 'next/link'
import { today as todayIso } from '@/lib/date'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QueryFailure, firstError } from '@/lib/failure'
import { NodeForm, type ParentOption } from '@/components/node-form'
import { StatusSelect } from '@/components/status-select'
import { BlockerForm, ResolveBlockerForm } from '@/components/blocker-form'
import { DecisionForm } from '@/components/decision-form'
import { EntryForm } from '@/components/entry-form'
import { ProjectFrame } from '@/components/project-frame'
import { QuickAddOn } from '@/components/quick-add-on'
import { ReorderButtons } from '@/components/reorder-buttons'
import { canMove } from '@/lib/reorder'
import { ProgressScale, formatDate } from '@/components/ui'
import { pathTo, wbsCodes } from '@/lib/wbs'
import { subtreeSet } from '@/lib/subtree'
import {
  TYPE_LABEL,
  type BlockerDays,
  type Decision,
  type Entry,
  type Node,
  type NodeProgress,
  type NodeReady,
  type NodeState,
} from '@/lib/types'

export const dynamic = 'force-dynamic'

/** Diamond for a milestone, square for an ordinary node. */
function MilestoneMark({ done }: { done: boolean }) {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" className="shrink-0 translate-y-px">
      <path
        d="M4.5 0 L9 4.5 L4.5 9 L0 4.5 Z"
        fill={done ? '#1a1f1b' : 'none'}
        stroke={done ? 'none' : '#6b6b65'}
        strokeWidth="1.2"
      />
    </svg>
  )
}

export default async function TreePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    edit?: string
    new?: string
    focus?: string
    scope?: string
    open?: string
    bedit?: string
    bresolve?: string
    bnew?: string
    dedit?: string
    dnew?: string
    eedit?: string
  }>
}) {
  const { id } = await params
  const {
    edit: editId,
    new: newParent,
    focus: focusId,
    scope,
    open: openParam,
    bedit: editBlockerId,
    bresolve: resolveBlockerId,
    bnew: newBlockerNode,
    dedit: editDecisionId,
    dnew: newDecisionNode,
    eedit: editEntryId,
  } = await searchParams

  const supabase = await createClient()
  const base = `/p/${id}`

  /*
   * One round trip, not two. Asking the database which nodes sit underneath and
   * only then issuing the queries that filter by the answer turns one wait into
   * two, and the portfolio is small enough to fetch whole and cut here.
   */
  const [
    nodesRes, allNodesRes, entryRes, blockerRes, decisionRes, progressRes,
    stateRes, readyRes, markRes, strategyRes,
  ] = await Promise.all([
    supabase.from('node').select('*').order('sort_order'),
    supabase.from('node').select('id, parent_id, title, sort_order').order('sort_order'),
    supabase.from('entry').select('*').order('entry_date', { ascending: false }).limit(200),
    supabase.from('v_blocker_days').select('*'),
    supabase.from('decision').select('*'),
    supabase.from('v_node_progress').select('*'),
    supabase.from('v_node_state').select('*'),
    supabase.from('v_node_ready').select('*'),
    supabase.from('v_strategy_node').select('node_id, strategy_id, is_top'),
    supabase.from('strategy').select('id, name'),
  ])

  const failure = firstError([
    nodesRes, allNodesRes, entryRes, blockerRes, decisionRes, progressRes, stateRes, readyRes,
    markRes, strategyRes,
  ])
  if (failure) return <QueryFailure message={failure} />

  const everyNode = (nodesRes.data ?? []) as Node[]
  const project = everyNode.find((n) => n.id === id)
  if (!project) notFound()

  /*
   * What each node is marked as serving. A nested marking is shown too: it
   * says where the saving actually comes from, and the page it feeds is the
   * one that decides what to add up.
   */
  const strategyName = new Map(
    ((strategyRes.data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]),
  )
  const serves = new Map<string, string[]>()
  for (const m of (markRes.data ?? []) as {
    node_id: string
    strategy_id: string
    is_top: boolean
  }[]) {
    const name = strategyName.get(m.strategy_id)
    if (name) serves.set(m.node_id, [...(serves.get(m.node_id) ?? []), name])
  }

  const inProject = subtreeSet(everyNode, id)
  const nodes = everyNode.filter((n) => inProject.has(n.id))

  const entries = ((entryRes.data ?? []) as Entry[]).filter((e) => inProject.has(e.node_id))
  const blockers = ((blockerRes.data ?? []) as BlockerDays[]).filter((b) => inProject.has(b.node_id))
  const decisions = ((decisionRes.data ?? []) as Decision[]).filter((d) => inProject.has(d.node_id))
  const progress = new Map(
    ((progressRes.data ?? []) as NodeProgress[]).map((p) => [p.node_id, p]),
  )
  // Sequence: a node nobody can start yet, because something it or an ancestor
  // waits on is still open. Not the same as blocked, which is about someone
  // else sitting on you.
  const ready = new Map(
    ((readyRes.data ?? []) as NodeReady[]).map((r) => [r.node_id, r]),
  )

  // Blocked-ness is derived, so it is read rather than worked out here.
  const state = new Map(
    ((stateRes.data ?? []) as NodeState[]).map((s) => [s.node_id, s]),
  )

  const childrenOf = new Map<string, Node[]>()
  for (const n of nodes) {
    if (n.parent_id === null || n.id === id) continue
    childrenOf.set(n.parent_id, [...(childrenOf.get(n.parent_id) ?? []), n])
  }

  /*
   * Work breakdown codes and the descendant sets behind each row summary.
   * A part that holds a hierarchy of its own has to say what is inside it
   * without being opened first.
   */
  const projectNo =
    typeof project.reporting?.project_no === 'string'
      ? project.reporting.project_no
      : 'no number'
  const codes = wbsCodes(nodes, id, projectNo)

  /**
   * «PR-26-0001.01.02» -> «.01.02». One segment per level, so the column reads
   * as the hierarchy itself: the dots step right exactly as the tree does.
   */
  const wbsTail = (nodeId: string) => (codes.get(nodeId) ?? '').slice(projectNo.length)

  const descendantsOf = new Map<string, string[]>()
  const collect = (nodeId: string): string[] => {
    const kids = childrenOf.get(nodeId) ?? []
    const all = kids.flatMap((k) => [k.id, ...collect(k.id)])
    descendantsOf.set(nodeId, all)
    return all
  }
  collect(id)

  const openBlockers = blockers.filter((b) => b.is_active)
  const byId = new Map(nodes.map((n) => [n.id, n]))

  // Focus shows one branch instead of the whole tree.
  const focused = focusId ? byId.get(focusId) : undefined
  const trail = focused ? pathTo(nodes, id, focused.id) : [id]
  const treeRoot = focused ?? project
  const treeRootId = treeRoot.id

  /*
   * The frame follows the focus by default. `scope=project` switches it back
   * to the project's own figures without leaving the part.
   */
  const showProjectFigures = scope === 'project'
  const frameNodeId = focused && !showProjectFigures ? focused.id : id
  const frameToggle = focused
    ? showProjectFigures
      ? { href: `${base}?focus=${focused.id}`, label: 'Show this part' }
      : { href: `${base}?focus=${focused.id}&scope=project`, label: 'Show the project' }
    : undefined

  const editing = editId ? nodes.find((n) => n.id === editId) : undefined

  const parentOptions: ParentOption[] = []
  let editDescendants = 0
  if (editing) {
    const excluded = subtreeSet(everyNode, editing.id)
    editDescendants = excluded.size - 1

    type Flat = { id: string; parent_id: string | null; title: string }
    const all = (allNodesRes.data ?? []) as Flat[]
    const kids = new Map<string, Flat[]>()
    for (const n of all) {
      const key = n.parent_id ?? '__root__'
      kids.set(key, [...(kids.get(key) ?? []), n])
    }
    const walk = (key: string, depth: number) => {
      for (const n of kids.get(key) ?? []) {
        if (!excluded.has(n.id)) {
          parentOptions.push({ id: n.id, title: n.title, depth })
          walk(n.id, depth + 1)
        }
      }
    }
    walk('__root__', 0)
  }

  /** Keep the focus when a form link is followed. */
  const keep = (extra: string) => {
    const parts = [
      focusId ? `focus=${focusId}` : '',
      scope ? `scope=${scope}` : '',
      openParam !== undefined ? `open=${openParam}` : '',
      extra,
    ].filter(Boolean)
    return parts.length === 0 ? base : `${base}?${parts.join('&')}`
  }

  const leadOf = (n: Node) =>
    ((n.reporting?.people ?? {}) as Record<string, string>).project_manager ?? n.owner

  const today = todayIso()

  /**
   * What is going on inside one branch. A part has to answer this without
   * being opened, otherwise the overview is a list of names.
   */
  function summarise(node: Node) {
    const branch = [node.id, ...(descendantsOf.get(node.id) ?? [])]
    const inBranch = branch.map((bid) => byId.get(bid)).filter((n): n is Node => !!n)

    const nextDate = inBranch
      .filter(
        (n) =>
          n.id !== node.id &&
          n.due_date !== null &&
          n.completed_at === null &&
          n.status !== 'done' &&
          n.status !== 'cancelled',
      )
      .map((n) => n.due_date!)
      .sort()[0]

    const lastEntry = entries
      .filter((e) => branch.includes(e.node_id))
      .map((e) => e.entry_date)
      .sort()
      .at(-1)

    const stuck = openBlockers.filter((b) => branch.includes(b.node_id))

    return {
      progress: progress.get(node.id),
      nodes: (descendantsOf.get(node.id) ?? []).length,
      nextDate,
      lastEntry,
      stuck,
      worstWait: stuck.length === 0 ? 0 : Math.max(...stuck.map((b) => b.days_blocked)),
      lead: leadOf(node),
      overdue: nextDate !== undefined && nextDate < today,
    }
  }

  function Row({ node, depth, first }: { node: Node; depth: number; first: boolean }) {
    const kids = childrenOf.get(node.id) ?? []
    const done = node.status === 'done'
    const expanded = kids.length > 0 && isOpen(node.id)
    // A part carries a summary whether or not it has been filled in yet, but
    // only while it is closed. Open, its children say the same thing better,
    // and printing both put the identical figures on the page twice.
    const isPart =
      node.type === 'subproject' || node.type === 'development' || kids.length > 0
    const sum = isPart && !expanded ? summarise(node) : null

    return (
      <div>
        {/*
          * A direct part of the project opens a block: 32 px of air, then a
          * heavier rule, then the title a step up in weight. The air sits ABOVE
          * the rule on purpose, so the break belongs to the part it opens
          * rather than to the block it closes. The first part skips the margin,
          * because the «Tree» heading already separates it.
          */}
        <div
          className={`flex items-baseline gap-3 border-t pb-2.5 ${
            depth === 0
              ? `border-rule-strong pt-4 ${first ? '' : 'mt-8'}`
              : 'border-rule pt-2.5'
          }`}
        >
          <div className="w-[152px] shrink-0">
            <StatusSelect
              id={node.id}
              status={node.status}
              blocked={state.get(node.id)?.is_blocked ?? false}
              waitDays={state.get(node.id)?.worst_wait ?? 0}
            />
          </div>

          {kids.length > 0 ? (
            <Link
              href={toggleHref(node.id)}
              title={expanded ? `Close ${node.title}` : `Open ${node.title}`}
              aria-expanded={expanded}
              className="w-3.5 shrink-0 text-center text-[9px] leading-none text-rule-strong hover:text-green"
            >
              {expanded ? '▾' : '▸'}
            </Link>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}

          <span
            className="w-[80px] shrink-0 text-[11px] tabular-nums tracking-[0.04em] text-muted"
            title={codes.get(node.id)}
          >
            {wbsTail(node.id)}
          </span>

          {/*
            * Only the title indents. The status mark is what you scan the page
            * for, so it holds a fixed column whatever the depth; indenting the
            * whole row made the left edge zigzag against a straight right edge.
            */}
          <div
            className="flex min-w-0 flex-1 items-baseline gap-3"
            style={{ paddingLeft: depth * 24 }}
          >
            {node.is_milestone && <MilestoneMark done={done} />}

            <div className="min-w-0 flex-1">
            <Link
              href={editId === node.id ? keep('') : keep(`edit=${node.id}`)}
              className={`hover:text-green ${
                depth === 0 ? 'text-[14.5px] font-medium' : 'text-[13px]'
              } ${editId === node.id ? 'text-green' : ''} ${
                done ? 'text-muted line-through decoration-rule' : ''
              }`}
            >
              {node.title}
            </Link>
            {(() => {
              // Sequence is normal. Only lateness is worth a colour, or the
              // colour stops meaning anything.
              const r = ready.get(node.id)
              if (!r || r.is_ready) return null
              return r.overdue_count > 0 ? (
                <span
                  className="lbl-tight ml-3 whitespace-nowrap text-oxblood"
                  title="A predecessor has passed its own due date"
                >
                  held up by {r.overdue_count}
                </span>
              ) : (
                <span
                  className="lbl-tight ml-3 whitespace-nowrap text-rule-strong"
                  title="Waiting its turn. Nothing is late"
                >
                  waits on {r.waiting_on_count}
                </span>
              )
            })()}

            {/*
              What this piece of work is for, above the project it sits in.
              Quiet by design: it is context, not a state, and it must not
              compete with lateness for attention.
            */}
            {(serves.get(node.id) ?? []).map((name) => (
              <span
                key={name}
                className="lbl-tight ml-3 whitespace-nowrap text-green"
                title="Marked as serving this strategy"
              >
                {name}
              </span>
            ))}

            {sum && (
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted">
                <span className="flex w-[56px] items-center">
                  <ProgressScale
                    done={sum.progress?.leaf_done ?? 0}
                    total={sum.progress?.leaf_total ?? 0}
                  />
                </span>
                <span className="tabular-nums">{sum.progress?.progress_pct ?? 0} %</span>
                <span className="tabular-nums">
                  {sum.nodes === 0 ? 'empty' : `${sum.nodes} nodes`}
                </span>
                {sum.nextDate && (
                  <span className={`tabular-nums ${sum.overdue ? 'text-oxblood' : ''}`}>
                    next {formatDate(sum.nextDate)}
                  </span>
                )}
                {sum.stuck.length > 0 && (
                  <span className="tabular-nums text-oxblood">
                    {sum.stuck.length} blocked, {sum.worstWait} days
                  </span>
                )}
                <span className="tabular-nums">
                  {sum.lastEntry ? `logged ${formatDate(sum.lastEntry)}` : 'never logged'}
                </span>
                {sum.lead && <span>{sum.lead}</span>}
              </div>
            )}
            </div>
          </div>

          <span className="lbl-tight w-[86px] shrink-0 text-muted">
            {TYPE_LABEL[node.type]}
          </span>
          <span className="w-[72px] shrink-0 text-right text-xs tabular-nums text-muted">
            {node.due_date ? formatDate(node.due_date) : '-'}
          </span>
          <ReorderButtons
            id={node.id}
            can={canMove(childrenOf.get(node.parent_id ?? '') ?? [], node.id)}
            redirectTo={keep('')}
          />
          <Link
            href={`${base}?focus=${node.id}`}
            title="Open this node on its own, with its log, blockers, decisions and sequence"
            className="lbl-tight shrink-0 text-rule-strong hover:text-green"
          >
            open
          </Link>
          <Link
            href={editId === node.id ? keep('') : keep(`edit=${node.id}`)}
            title={
              editId === node.id
                ? 'Close the form'
                : 'Edit this node, change its type, or delete it'
            }
            className={`lbl-tight shrink-0 hover:text-green ${
              editId === node.id ? 'text-green' : 'text-rule-strong'
            }`}
          >
            edit
          </Link>
          <QuickAddOn nodeId={node.id} />
          <Link
            href={newParent === node.id ? keep('') : keep(`new=${node.id}`)}
            title={newParent === node.id ? 'Close the form' : 'Add child node'}
            className={`w-4 shrink-0 text-center text-sm hover:text-green ${
              newParent === node.id ? 'text-green' : 'text-rule-strong'
            }`}
          >
            {newParent === node.id ? '×' : '+'}
          </Link>
        </div>

        {editId === node.id && editing && (
          <div className="my-2">
            <NodeForm
              node={editing}
              parentOptions={parentOptions}
              descendantCount={editDescendants}
              redirectTo={keep('')}
              cancelHref={keep('')}
            />
          </div>
        )}

        {newParent === node.id && (
          <div className="my-2">
            <NodeForm parentId={node.id} redirectTo={keep('')} cancelHref={keep('')} />
          </div>
        )}

      </div>
    )
  }

  /*
   * Folding.
   *
   * The open set travels in the URL as eight hex characters per node, which is
   * short enough to keep the address readable and unique enough that a clash
   * inside one project is not a real risk. It lives in the query rather than in
   * the client so the tree stays server rendered, and so a link to a half open
   * tree opens the same way for the next person.
   *
   * With no parameter at all, the direct parts are open and everything below is
   * closed. That is the reading you want when you arrive.
   */
  const containers = (nodeId: string) => (childrenOf.get(nodeId) ?? []).length > 0
  const short = (nodeId: string) => nodeId.slice(0, 8)

  const defaultOpen = new Set(
    (childrenOf.get(treeRootId) ?? []).filter((n) => containers(n.id)).map((n) => short(n.id)),
  )
  const openSet =
    openParam === undefined
      ? defaultOpen
      : new Set(openParam.split('.').filter(Boolean))

  const isOpen = (nodeId: string) => openSet.has(short(nodeId))

  const openHref = (next: Set<string>, extra = '') => {
    const parts = [
      focusId ? `focus=${focusId}` : '',
      scope ? `scope=${scope}` : '',
      `open=${[...next].join('.')}`,
      extra,
    ].filter(Boolean)
    return `${base}?${parts.join('&')}`
  }

  const toggleHref = (nodeId: string) => {
    const next = new Set(openSet)
    if (next.has(short(nodeId))) next.delete(short(nodeId))
    else next.add(short(nodeId))
    return openHref(next)
  }

  const allContainers = new Set(
    nodes.filter((n) => n.id !== treeRootId && containers(n.id)).map((n) => short(n.id)),
  )

  /*
   * Flattened with the depth carried alongside, so every row is a sibling in
   * the DOM and the fixed columns line up across the whole tree. A closed node
   * simply does not emit its children.
   */
  const flatten = (parentId: string, depth: number): { node: Node; depth: number }[] =>
    (childrenOf.get(parentId) ?? []).flatMap((n) =>
      isOpen(n.id)
        ? [{ node: n, depth }, ...flatten(n.id, depth + 1)]
        : [{ node: n, depth }],
    )

  const shown = flatten(treeRoot.id, 0)

  return (
    <ProjectFrame
      projectId={id}
      frameNodeId={frameNodeId}
      focusId={focusId}
      toggle={frameToggle}
    >
    <div className="px-5 lg:px-10 py-7">
      {editId === project.id && editing && (
        <div className="mb-5">
          <NodeForm
            node={editing}
            parentOptions={parentOptions}
            descendantCount={editDescendants}
            redirectTo={keep('')}
            cancelHref={keep('')}
          />
        </div>
      )}
      {editBlockerId && blockers.some((b) => b.id === editBlockerId) && (
        <div className="mb-5">
          <BlockerForm
            blocker={blockers.find((b) => b.id === editBlockerId)!}
            redirectTo={keep('')}
            cancelHref={keep('')}
          />
        </div>
      )}
      {resolveBlockerId && blockers.some((b) => b.id === resolveBlockerId) && (
        <div className="mb-5">
          <ResolveBlockerForm
            blocker={blockers.find((b) => b.id === resolveBlockerId)!}
            redirectTo={keep('')}
            cancelHref={keep('')}
          />
        </div>
      )}
      {newBlockerNode && (
        <div className="mb-5">
          <BlockerForm nodeId={newBlockerNode} redirectTo={keep('')} cancelHref={keep('')} />
        </div>
      )}
      {editDecisionId && decisions.some((d) => d.id === editDecisionId) && (
        <div className="mb-5">
          <DecisionForm
            decision={decisions.find((d) => d.id === editDecisionId)!}
            redirectTo={keep('')}
            cancelHref={keep('')}
          />
        </div>
      )}
      {newDecisionNode && (
        <div className="mb-5">
          <DecisionForm nodeId={newDecisionNode} redirectTo={keep('')} cancelHref={keep('')} />
        </div>
      )}
      {editEntryId && entries.some((e) => e.id === editEntryId) && (
        <div className="mb-5">
          <EntryForm
            entry={entries.find((e) => e.id === editEntryId)!}
            redirectTo={keep('')}
            cancelHref={keep('')}
          />
        </div>
      )}

      {/* The address of what you are looking at */}
      <div className="flex items-baseline justify-between gap-5">
        <div className="min-w-0">
          <div className="lbl tabular-nums">
            {trail.map((nodeId, i) => (
              <span key={nodeId}>
                {i > 0 && <span className="text-rule-strong">.</span>}
                <Link
                  href={nodeId === id ? base : `${base}?focus=${nodeId}`}
                  title={byId.get(nodeId)?.title}
                  className={
                    i === trail.length - 1 ? 'text-ink' : 'text-muted hover:text-ink'
                  }
                >
                  {i === 0 ? codes.get(nodeId) : codes.get(nodeId)?.split('.').pop()}
                </Link>
              </span>
            ))}
          </div>
          <h2 className="mt-1 truncate font-display text-[26px] font-medium">
            {focused ? focused.title : 'Tree'}
          </h2>
        </div>

        <div className="flex shrink-0 items-baseline gap-4">
          {focused && (
            <Link href={base} className="lbl-tight text-muted hover:text-ink">
              Whole project
            </Link>
          )}
          {allContainers.size > 0 && (
            <>
              <Link
                href={openHref(allContainers)}
                className="lbl-tight text-rule-strong hover:text-ink"
              >
                Expand all
              </Link>
              <Link
                href={openHref(new Set())}
                className="lbl-tight text-rule-strong hover:text-ink"
              >
                Collapse all
              </Link>
            </>
          )}
          <Link
            href={newParent === treeRoot.id ? keep('') : keep(`new=${treeRoot.id}`)}
            className="lbl text-green hover:text-oxblood"
          >
            {newParent === treeRoot.id ? 'Close' : 'New node'}
          </Link>
        </div>
      </div>

      <div className="mt-6">
        {newParent === treeRoot.id && (
          <div className="mb-2">
            <NodeForm parentId={treeRoot.id} redirectTo={keep('')} cancelHref={keep('')} />
          </div>
        )}

        {shown.length === 0 ? (
          <p className="border-t border-rule py-4 text-[13px] text-muted">
            No child nodes yet.
          </p>
        ) : (
          <div className="border-b border-rule">
            {shown.map(({ node, depth }, i) => (
              <Row key={node.id} node={node} depth={depth} first={i === 0} />
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-[11px] text-muted">
          <MilestoneMark done={false} />
          Diamond means milestone. Status is changed directly in the list.
          <span className="text-rule-strong">edit</span> opens the node, its type
          and its delete button.
          <span className="text-rule-strong">log</span> writes an entry on it.
          <span className="text-rule-strong">+</span> adds a child.
        </div>
      </div>
    </div>
    </ProjectFrame>
  )
}
