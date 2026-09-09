-- CAPEX or OPEX, per line.
--
-- The recurrence already separates a one-off from a rate, and that is a
-- different question. Capitalisation asks whether the money creates an asset
-- you will use for years, and the two do not line up:
--
--   a sensor, bought once                     once, capex
--   installation labour to get it working     once, capex
--   a consultant day to write the protocol    once, opex
--   a licence at 800 a month                  monthly, opex
--   a three year support contract, paid up    once, opex or capex, ask finance
--
-- So they are orthogonal, and every line carries both.
--
-- The default is the ordinary case rather than a blank: a one-off buys
-- something, a recurring charge keeps something running. Getting it wrong is
-- one click, and a field nobody fills in is worse than a field that starts on
-- the common answer.
--
-- What it buys is the question a board actually asks: «what is the investment,
-- and what does it cost us every year afterwards». Those are different budgets
-- with different approvers, and the grant only ever covered the first.

begin;

create type cost_budget as enum ('capex', 'opex');

alter table cost
  add column budget cost_budget not null default 'capex';

-- Recurring lines are running costs far more often than not, so the existing
-- rows start where they most likely belong.
update cost set budget = 'opex' where recurrence <> 'once';

comment on column cost.budget is
  'Whether the money is capitalised or expensed. Independent of recurrence: a '
  'consultant day is one-off opex, a licence paid up front can be capex.';

-- ---------------------------------------------------------------------------
-- Four buckets, because both questions are real and neither answers the other.
-- ---------------------------------------------------------------------------
drop view v_node_cost;

create view v_node_cost as
with rated as (
  select
    c.node_id,
    c.state,
    c.amount,
    c.recurrence,
    c.budget,
    c.document_id,
    (c.recurrence = 'once') as is_once,
    (c.state in ('ordered', 'invoiced')) as is_committed,
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

  -- The investment, split by certainty. What the grant covers.
  coalesce(sum(r.amount) filter (where r.is_once and r.state = 'estimate'), 0)::numeric(14,2) as once_estimated,
  coalesce(sum(r.amount) filter (where r.is_once and r.state = 'quoted'),   0)::numeric(14,2) as once_quoted,
  coalesce(sum(r.amount) filter (where r.is_once and r.state = 'ordered'),  0)::numeric(14,2) as once_ordered,
  coalesce(sum(r.amount) filter (where r.is_once and r.state = 'invoiced'), 0)::numeric(14,2) as once_invoiced,
  coalesce(sum(r.amount) filter (where r.is_once and r.is_committed), 0)::numeric(14,2) as once_committed,
  coalesce(sum(r.amount) filter (where r.is_once), 0)::numeric(14,2) as once_priced,
  coalesce(sum(r.amount) filter (where r.is_once and r.document_id is not null), 0)::numeric(14,2) as once_with_paper,

  -- Everything that repeats, at a yearly rate.
  coalesce(sum(r.annual) filter (where not r.is_once and r.is_committed), 0)::numeric(14,2) as annual_committed,
  coalesce(sum(r.annual) filter (where not r.is_once), 0)::numeric(14,2) as annual_priced,

  -- The same money, cut the other way. Capitalised against expensed.
  coalesce(sum(r.amount) filter (where r.budget = 'capex' and r.is_once), 0)::numeric(14,2) as capex_once_priced,
  coalesce(sum(r.amount) filter (where r.budget = 'capex' and r.is_once and r.is_committed), 0)::numeric(14,2) as capex_once_committed,
  coalesce(sum(r.annual) filter (where r.budget = 'capex' and not r.is_once), 0)::numeric(14,2) as capex_annual_priced,

  coalesce(sum(r.amount) filter (where r.budget = 'opex' and r.is_once), 0)::numeric(14,2) as opex_once_priced,
  coalesce(sum(r.amount) filter (where r.budget = 'opex' and r.is_once and r.is_committed), 0)::numeric(14,2) as opex_once_committed,
  coalesce(sum(r.annual) filter (where r.budget = 'opex' and not r.is_once), 0)::numeric(14,2) as opex_annual_priced,
  coalesce(sum(r.annual) filter (where r.budget = 'opex' and not r.is_once and r.is_committed), 0)::numeric(14,2) as opex_annual_committed,

  count(r.node_id) filter (where r.is_once)     as once_items,
  count(r.node_id) filter (where not r.is_once) as annual_items,
  count(r.node_id) as items
from v_node_descendant d
left join rated r on r.node_id = d.node_id
group by d.root_id;

alter view v_node_cost set (security_invoker = on);

comment on view v_node_cost is
  'Cost rolled up per node, cut two independent ways. once_*/annual_* separates '
  'an amount from a rate. capex_*/opex_* separates what is capitalised from what '
  'is expensed. Neither cut answers the other question, and a one-off and a rate '
  'are never added together.';

insert into schema_migration (version, applied_at, note)
values ('20260903000009_cost_budget', now(), 'CAPEX and OPEX per line, independent of recurrence')
on conflict (version) do nothing;

commit;
