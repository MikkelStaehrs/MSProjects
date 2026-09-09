-- A dependency is not a problem. Being late is.
--
-- The first version of v_node_ready counted every unfinished predecessor the
-- same way, and the tree drew all of them in oxblood. That was wrong, and it
-- was wrong in the direction that matters: it cried about ordinary sequencing.
--
-- Work that comes after other work is normal. «Write the test protocol after
-- the calibration» is a plan, not a problem, and a tool that colours it red
-- teaches you to ignore the colour.
--
-- So the relation stays one thing and the state of it is derived, exactly as
-- «blocked» is derived from an open blocker rather than being a status:
--
--   ready    no unfinished predecessor
--   waiting  predecessors open, none of them late. Ordinary sequence
--   held up  at least one predecessor is past its own due date
--
-- Only the third is worth a colour, and it is honest: a date was given and has
-- passed.
--
-- What this deliberately does NOT do is feed /blockers. A blocker names a party
-- outside your control and measures the wait so it can be argued with. Both
-- ends of a dependency are your own work. Counting your own sequencing as
-- waiting days would inflate the one number that page exists to produce.

begin;

drop view if exists v_node_ready;

create or replace view v_node_ready as
select
  n.id as node_id,
  count(p.id) filter (where p.status not in ('done', 'cancelled')) as waiting_on_count,
  -- Late, and therefore actually costing time. A predecessor with no date can
  -- never be late: nothing was promised, so nothing was broken.
  count(p.id) filter (
    where p.status not in ('done', 'cancelled')
      and p.due_date is not null
      and p.due_date < current_date
  ) as overdue_count,
  count(p.id) filter (where p.status not in ('done', 'cancelled')) = 0 as is_ready
from node n
left join v_node_descendant a on a.node_id = n.id      -- a.root_id is n or an ancestor of n
left join node_dependency d on d.node_id = a.root_id
left join node p on p.id = d.depends_on_id
group by n.id;

alter view v_node_ready set (security_invoker = on);

comment on view v_node_ready is
  'Sequence, not blockers. waiting_on_count is every unfinished predecessor on '
  'the node or an ancestor; overdue_count is the subset that has passed its own '
  'due date. Ordinary sequence is waiting_on_count > 0 with overdue_count = 0, '
  'and it is not a problem.';

insert into schema_migration (version, applied_at, note)
values ('20260903000004_sequence_states', now(),
        'Waiting and held up separated: a dependency is not a problem, being late is')
on conflict (version) do nothing;

commit;
