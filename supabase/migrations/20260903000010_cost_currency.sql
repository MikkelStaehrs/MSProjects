-- Written in the currency of the quote, reported in euro. Always.
--
-- The company PID that started all of this had 50 tDKK in one field and 8 to 10
-- tEUR in another, describing roughly the same saving. That is what happens
-- when a form takes whatever number is in front of you and never says which
-- currency it is. The figure that goes upwards has to be one currency, and here
-- it is euro.
--
-- But a Rittal quote is in kroner and a Videometer quote is in euro, and
-- rewriting the supplier's own number before entering it loses the one thing
-- the document is evidence of. So the line keeps what the quote says.
--
-- The rate lives ON THE LINE, not on the project.
--
-- That is the part worth being deliberate about. A rate on the project would be
-- one number that silently rewrites every past total the day it moves, so a
-- report from week 34 would stop matching what it said in week 34. Captured per
-- line, the conversion is a fact from the day the price landed and it never
-- changes afterwards. The project carries a default so the field fills itself
-- in; changing the default never touches a line already written.

begin;

create type cost_currency as enum ('DKK', 'EUR');

alter table cost
  add column currency cost_currency not null default 'DKK',
  -- Units of `currency` per euro, as it stood when the price landed. EUR lines
  -- carry 1, which keeps the arithmetic uniform rather than special cased.
  add column eur_rate numeric(12,6) not null default 1 check (eur_rate > 0);

comment on column cost.currency is
  'What the supplier quoted in. The amount is stored exactly as written.';
comment on column cost.eur_rate is
  'Units of currency per euro, captured when the line was written. Fixed from '
  'then on: a rate that moves must never rewrite a total that was already '
  'reported.';

-- ---------------------------------------------------------------------------
-- Everything rolled up is euro, from here on.
-- ---------------------------------------------------------------------------
drop view v_node_cost;

create view v_node_cost as
with rated as (
  select
    c.node_id,
    c.state,
    c.recurrence,
    c.budget,
    c.document_id,
    -- The one conversion, done once, in the one place that adds anything up.
    (c.amount / c.eur_rate) as eur,
    (c.recurrence = 'once') as is_once,
    (c.state in ('ordered', 'invoiced')) as is_committed,
    case c.recurrence
      when 'monthly'   then (c.amount / c.eur_rate) * 12
      when 'quarterly' then (c.amount / c.eur_rate) * 4
      when 'yearly'    then (c.amount / c.eur_rate)
      else 0
    end as annual_eur
  from cost c
)
select
  d.root_id as node_id,

  coalesce(sum(r.eur) filter (where r.is_once and r.state = 'estimate'), 0)::numeric(14,2) as once_estimated,
  coalesce(sum(r.eur) filter (where r.is_once and r.state = 'quoted'),   0)::numeric(14,2) as once_quoted,
  coalesce(sum(r.eur) filter (where r.is_once and r.state = 'ordered'),  0)::numeric(14,2) as once_ordered,
  coalesce(sum(r.eur) filter (where r.is_once and r.state = 'invoiced'), 0)::numeric(14,2) as once_invoiced,
  coalesce(sum(r.eur) filter (where r.is_once and r.is_committed), 0)::numeric(14,2) as once_committed,
  coalesce(sum(r.eur) filter (where r.is_once), 0)::numeric(14,2) as once_priced,
  coalesce(sum(r.eur) filter (where r.is_once and r.document_id is not null), 0)::numeric(14,2) as once_with_paper,

  coalesce(sum(r.annual_eur) filter (where not r.is_once and r.is_committed), 0)::numeric(14,2) as annual_committed,
  coalesce(sum(r.annual_eur) filter (where not r.is_once), 0)::numeric(14,2) as annual_priced,

  coalesce(sum(r.eur) filter (where r.budget = 'capex' and r.is_once), 0)::numeric(14,2) as capex_once_priced,
  coalesce(sum(r.eur) filter (where r.budget = 'capex' and r.is_once and r.is_committed), 0)::numeric(14,2) as capex_once_committed,
  coalesce(sum(r.annual_eur) filter (where r.budget = 'capex' and not r.is_once), 0)::numeric(14,2) as capex_annual_priced,

  coalesce(sum(r.eur) filter (where r.budget = 'opex' and r.is_once), 0)::numeric(14,2) as opex_once_priced,
  coalesce(sum(r.eur) filter (where r.budget = 'opex' and r.is_once and r.is_committed), 0)::numeric(14,2) as opex_once_committed,
  coalesce(sum(r.annual_eur) filter (where r.budget = 'opex' and not r.is_once), 0)::numeric(14,2) as opex_annual_priced,
  coalesce(sum(r.annual_eur) filter (where r.budget = 'opex' and not r.is_once and r.is_committed), 0)::numeric(14,2) as opex_annual_committed,

  count(r.node_id) filter (where r.is_once)     as once_items,
  count(r.node_id) filter (where not r.is_once) as annual_items,
  count(r.node_id) as items
from v_node_descendant d
left join rated r on r.node_id = d.node_id
group by d.root_id;

alter view v_node_cost set (security_invoker = on);

comment on view v_node_cost is
  'Cost rolled up per node, always in euro. Lines keep the currency of the quote '
  'and the rate that applied when it was written; this is the only place the '
  'conversion happens. Cut two independent ways: once against annual, capex '
  'against opex.';

insert into schema_migration (version, applied_at, note)
values ('20260903000010_cost_currency', now(),
        'Lines in the currency of the quote, every total in euro')
on conflict (version) do nothing;

commit;
