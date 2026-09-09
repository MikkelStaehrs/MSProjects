-- A one-off and a running cost are not the same kind of number.
--
-- Buying a sensor for 4 200 and paying 800 a month for a licence are both
-- costs, and adding them together produces a figure that means nothing: it is
-- an amount plus a rate. The first version of this table did exactly that.
--
-- So a line now says how often it happens, and the roll-up keeps the two apart
-- for good. Nothing anywhere adds a one-off to a run rate.
--
--   once      the investment. What the grant covers
--   monthly   |
--   quarterly | a rate, normalised to a year so they can be compared
--   yearly    |
--
-- Three consequences follow, and each of them was wrong before:
--
-- 1. The grant is compared against COMMITTED ONE-OFF money only. An investment
--    board approves a purchase, not next year's operating budget, and counting
--    a licence against the grant would invent a breach.
--
-- 2. Payback becomes cost / (benefit - annual running cost). A saving of 10 000
--    a year against a licence of 9 600 a year is not a saving of 10 000, and
--    where the running cost eats the benefit there is no payback at all. That
--    is a real answer, and the old formula could not give it.
--
-- 3. «Priced» splits in two. A project says what it costs to build and what it
--    costs to keep, and those go to different places in a business case.

begin;

create type cost_recurrence as enum ('once', 'monthly', 'quarterly', 'yearly');

alter table cost
  add column recurrence cost_recurrence not null default 'once';

comment on column cost.recurrence is
  'How often the amount falls due. «once» is the investment; the rest are rates, '
  'normalised to a year in v_node_cost. A one-off and a rate are never summed.';

-- ---------------------------------------------------------------------------
-- The roll-up, now in two halves that are never added together.
-- ---------------------------------------------------------------------------
drop view v_node_cost;

create view v_node_cost as
with rated as (
  select
    c.node_id,
    c.state,
    c.amount,
    c.recurrence,
    -- What a recurring line costs in a year. A one-off has no annual rate.
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

  -- The investment. What the grant covers.
  coalesce(sum(r.amount) filter (where r.recurrence = 'once' and r.state = 'estimate'), 0)::numeric(14,2) as once_estimated,
  coalesce(sum(r.amount) filter (where r.recurrence = 'once' and r.state = 'quoted'),   0)::numeric(14,2) as once_quoted,
  coalesce(sum(r.amount) filter (where r.recurrence = 'once' and r.state = 'ordered'),  0)::numeric(14,2) as once_ordered,
  coalesce(sum(r.amount) filter (where r.recurrence = 'once' and r.state = 'invoiced'), 0)::numeric(14,2) as once_invoiced,
  coalesce(sum(r.amount) filter (where r.recurrence = 'once' and r.state in ('ordered','invoiced')), 0)::numeric(14,2) as once_committed,
  coalesce(sum(r.amount) filter (where r.recurrence = 'once'), 0)::numeric(14,2) as once_priced,

  -- What it costs to keep, per year.
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
  'Cost rolled up per node, in two halves. once_* is the investment, in whole '
  'amounts. annual_* is the running cost, normalised to a year. They are never '
  'added together: one is an amount and the other is a rate.';

insert into schema_migration (version, applied_at, note)
values ('20260903000006_cost_recurrence', now(),
        'One-off and running costs kept apart; payback can account for OPEX')
on conflict (version) do nothing;

commit;
