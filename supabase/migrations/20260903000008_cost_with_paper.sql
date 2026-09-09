-- How much of the money has paper behind it.
--
-- The four states are what you declare. An estimate is a belief, a quote is a
-- supplier's promise, and the tool takes you at your word: attaching the
-- document does not change the state, and a missing document does not demote
-- it. Overruling your own classification because a PDF is absent would be the
-- wrong kind of clever.
--
-- But «of the 612 000 priced, 438 000 has a quote behind it» is a different and
-- useful reading, and it is the one somebody asks for in a review. So it is
-- counted rather than enforced.

begin;

drop view v_node_cost;

create view v_node_cost as
with rated as (
  select
    c.node_id,
    c.state,
    c.amount,
    c.recurrence,
    c.document_id,
    case c.recurrence
      when 'monthly'   then c.amount * 12
      when 'quarterly' then c.amount * 4
      when 'yearly'    then c.amount
      else 0
    end as annual
  from cost c
)
select
  d.root_id as node_id,

  coalesce(sum(r.amount) filter (where r.recurrence = 'once' and r.state = 'estimate'), 0)::numeric(14,2) as once_estimated,
  coalesce(sum(r.amount) filter (where r.recurrence = 'once' and r.state = 'quoted'),   0)::numeric(14,2) as once_quoted,
  coalesce(sum(r.amount) filter (where r.recurrence = 'once' and r.state = 'ordered'),  0)::numeric(14,2) as once_ordered,
  coalesce(sum(r.amount) filter (where r.recurrence = 'once' and r.state = 'invoiced'), 0)::numeric(14,2) as once_invoiced,
  coalesce(sum(r.amount) filter (where r.recurrence = 'once' and r.state in ('ordered','invoiced')), 0)::numeric(14,2) as once_committed,
  coalesce(sum(r.amount) filter (where r.recurrence = 'once'), 0)::numeric(14,2) as once_priced,

  -- Evidence, not classification. The state is still yours.
  coalesce(sum(r.amount) filter (where r.recurrence = 'once' and r.document_id is not null), 0)::numeric(14,2) as once_with_paper,

  coalesce(sum(r.annual) filter (where r.recurrence <> 'once' and r.state in ('ordered','invoiced')), 0)::numeric(14,2) as annual_committed,
  coalesce(sum(r.annual) filter (where r.recurrence <> 'once'), 0)::numeric(14,2) as annual_priced,

  count(r.node_id) filter (where r.recurrence = 'once')  as once_items,
  count(r.node_id) filter (where r.recurrence <> 'once') as annual_items,
  count(r.node_id) as items
from v_node_descendant d
left join rated r on r.node_id = d.node_id
group by d.root_id;

alter view v_node_cost set (security_invoker = on);

comment on view v_node_cost is
  'Cost rolled up per node, in two halves that are never added together. once_* '
  'is the investment, annual_* the running cost normalised to a year. '
  'once_with_paper is how much of the investment has a document attached: '
  'evidence, counted but never used to reclassify a line.';

insert into schema_migration (version, applied_at, note)
values ('20260903000008_cost_with_paper', now(), 'Counted how much of the money has paper behind it')
on conflict (version) do nothing;

commit;
