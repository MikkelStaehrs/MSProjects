-- Can this be started yet?
--
-- The tree says that something sits UNDER something else. node_dependency says
-- that something must finish BEFORE something else, and it has always accepted
-- any node; only the UI restricted it to top level projects.
--
-- What was missing is the consequence. Recording that OEE Dashboards waits on
-- two tasks in another subproject is worth little if you still have to walk the
-- list yourself to work out that you cannot start. So readiness is derived.
--
-- Two rules, both of which came out of the real case:
--
-- 1. It inherits downwards. If a node is not ready, nothing inside it is
--    either. The development work under OEE Dashboards cannot start before OEE
--    Dashboards can, and nobody should have to record that twice.
--
-- 2. Cancelled counts as settled. A predecessor that will never happen is not
--    something to keep waiting for.
--
-- Note what this is NOT. «Not ready» is about sequence; «blocked» is about
-- someone else sitting on you. They are different questions with different
-- answers, and folding them together would make both mean less. A node can be
-- ready and blocked, or blocked and not ready, and both readings are useful.

begin;

create or replace view v_node_ready as
select
  n.id as node_id,
  -- Every ancestor's predecessors count as this node's own, which is what
  -- makes the rule inherit without being stored twice.
  count(p.id) filter (where p.status not in ('done', 'cancelled')) as waiting_on_count,
  count(p.id) filter (where p.status not in ('done', 'cancelled')) = 0 as is_ready
from node n
left join v_node_descendant a on a.node_id = n.id      -- a.root_id is n or an ancestor of n
left join node_dependency d on d.node_id = a.root_id
left join node p on p.id = d.depends_on_id
group by n.id;

alter view v_node_ready set (security_invoker = on);

comment on view v_node_ready is
  'Whether a node can be started: no unfinished predecessor on it or on any of '
  'its ancestors. Sequence, not blockers. Never stored.';

insert into schema_migration (version, applied_at, note)
values ('20260903000003_node_ready', now(), 'Readiness derived from node_dependency')
on conflict (version) do nothing;

commit;
