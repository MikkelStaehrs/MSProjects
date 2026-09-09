-- «blocked» is not a status. It is a fact about open blockers.
--
-- Until now the two lived apart: opening a blocker wrote nothing to node, so
-- the mark in the tree only said «blocked» if you remembered to choose it in
-- the dropdown, and it kept saying so after the blocker was resolved. Two
-- places to keep in step, and nothing forcing them together.
--
-- A status you can forget to set is not a measurement. So the value leaves
-- the enum and becomes derived: a node is blocked exactly when it carries an
-- open blocker, computed in v_node_state and never stored.
--
-- What is left in node_status is only what YOU decide: idea, planned, active,
-- paused, done, cancelled. Note that «paused» is the one that means on hold,
-- and it is a decision, not a wait. That distinction is the whole reason
-- «blocked» could not simply be folded into it.
--
-- Reporting is unaffected. Status Update already collapsed blocked to Active,
-- so the four fields it receives are byte for byte the same as before. The
-- Progress light was already driven by the blockers themselves, not by this
-- column.

-- Everything here is transactional in Postgres, the enum rebuild included, so
-- a failure halfway rolls back rather than leaving the schema without views.
begin;

-- ---------------------------------------------------------------------------
-- 1. Move any node off the value before it disappears.
-- ---------------------------------------------------------------------------
-- A node standing on 'blocked' becomes 'active'. If it has an open blocker,
-- v_node_state will keep calling it blocked, so nothing is lost on screen.
-- If it has none, it was a stale mark, and 'active' is the honest reading.
update node set status = 'active' where status = 'blocked';

-- ---------------------------------------------------------------------------
-- 2. Drop what depends on the column, so the type can be swapped.
-- ---------------------------------------------------------------------------
drop view v_node_progress;
drop view v_node_leaf;
drop view v_next_date;

-- ---------------------------------------------------------------------------
-- 3. Swap the enum. Postgres cannot remove a value, so the type is rebuilt.
-- ---------------------------------------------------------------------------
alter type node_status rename to node_status_old;

create type node_status as enum ('idea','planned','active','paused','done','cancelled');

alter table node
  alter column status drop default,
  alter column status type node_status using status::text::node_status,
  alter column status set default 'planned';

drop type node_status_old;

-- ---------------------------------------------------------------------------
-- 4. Rebuild the views, unchanged apart from the type underneath them.
-- ---------------------------------------------------------------------------
create view v_node_leaf as
select
  n.id,
  n.status,
  n.type,
  not exists (select 1 from node c where c.parent_id = n.id) as is_leaf
from node n;

create view v_node_progress as
select
  d.root_id as node_id,
  count(case when l.is_leaf and l.type = 'task' and l.status <> 'cancelled' then 1 end) as leaf_total,
  count(case when l.is_leaf and l.type = 'task' and l.status = 'done'      then 1 end) as leaf_done,
  case
    when count(case when l.is_leaf and l.type = 'task' and l.status <> 'cancelled' then 1 end) = 0 then 0
    else cast(round(
      100.0 * count(case when l.is_leaf and l.type = 'task' and l.status = 'done' then 1 end)
            / count(case when l.is_leaf and l.type = 'task' and l.status <> 'cancelled' then 1 end)
    ) as int)
  end as progress_pct
from v_node_descendant d
join v_node_leaf l on l.id = d.node_id
group by d.root_id;

create view v_next_date as
with candidate as (
  select
    d.root_id,
    n.id, n.title, n.due_date, n.is_milestone, n.status,
    row_number() over (
      partition by d.root_id
      order by n.due_date asc, n.is_milestone desc, n.title asc
    ) as rn
  from v_node_descendant d
  join node n on n.id = d.node_id
  where d.depth > 0
    and n.due_date is not null
    and n.completed_at is null
    and n.status not in ('done','cancelled')
)
select
  root_id as node_id,
  id      as next_node_id,
  title,
  due_date,
  is_milestone,
  status,
  due_date - current_date as days_until
from candidate
where rn = 1;

-- ---------------------------------------------------------------------------
-- 5. The new truth about blocked-ness.
-- ---------------------------------------------------------------------------
-- One row per node. is_blocked counts the node's OWN open blockers, not the
-- subtree's: a project is not blocked because one task out of twelve is. The
-- subtree picture is already carried by the Progress light and by the wait
-- days on the parts overview, and it would overstate the case here.
create view v_node_state as
select
  n.id as node_id,
  n.status,
  count(b.id) filter (where b.resolved_at is null) > 0 as is_blocked,
  count(b.id) filter (where b.resolved_at is null)     as open_blockers,
  coalesce(
    max(coalesce(b.resolved_at, current_date) - b.opened_at)
      filter (where b.resolved_at is null),
    0
  ) as worst_wait,
  case
    when count(b.id) filter (where b.resolved_at is null) > 0 then 'blocked'
    else n.status::text
  end as status_effective
from node n
left join blocker b on b.node_id = n.id
group by n.id, n.status;

alter view v_node_leaf     set (security_invoker = on);
alter view v_node_progress set (security_invoker = on);
alter view v_next_date     set (security_invoker = on);
alter view v_node_state    set (security_invoker = on);

commit;
