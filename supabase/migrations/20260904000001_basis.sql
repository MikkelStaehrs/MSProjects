-- The grounds a piece of work rests on.
--
-- Two questions that look alike and are not:
--
--   «What did we choose, and what did we turn down?»   -- a moment, fixed
--   «What does it consist of?»                         -- a state, still moving
--
-- The first already had a table. `decision` has carried `rationale` and
-- `alternatives` since the first migration and held zero rows, because twenty
-- decisions in one flat list is not something anyone reads. A topic is what
-- turns that list into a specification: hardware here, software there, and the
-- rejected option standing next to each.
--
-- The second deliberately does NOT get a table. A sensor you are going to buy
-- is already a cost line, with the vendor, the quote number and the quotation
-- attached to it. A separate parts list would mean typing the IOT2050 once as a
-- specification and once as a price, and a thing written twice is a thing that
-- disagrees with itself by Christmas. So `cost` gains the two fields it was
-- missing to double as a bill of materials, and nothing else changes.

begin;

-- ---------------------------------------------------------------------------
-- What a decision is about.
-- ---------------------------------------------------------------------------
create type decision_topic as enum (
  'hardware',     -- sensors, cabinets, machines, the physical layer
  'software',     -- what runs, and what it is written in
  'network',      -- addressing, segmentation, what IT has to allow
  'data',         -- the model, where it lands, how long it is kept
  'vendor',       -- who supplies it, who builds it
  'method',       -- how the work is done, what becomes the standard
  'scope',        -- what is in and what is deliberately left out
  'other'         -- not filed yet. See below.
);

-- `other` is the default on purpose.
--
-- Quick capture writes a decision without asking anything, and that has to keep
-- working. But a default of, say, `method` would file hardware choices under
-- method silently, and a wrong bucket is worse than an empty one. `other` reads
-- as "not filed", the basis page counts them, and filing one is one click.
alter table decision
  add column topic decision_topic not null default 'other';

create index decision_topic_idx on decision(node_id, topic);

comment on column decision.topic is
  'What area the choice was about. Groups a flat list into something that '
  'reads as a specification. Defaults to other, meaning not filed yet.';

-- ---------------------------------------------------------------------------
-- What a cost line is, and how many of them.
-- ---------------------------------------------------------------------------
create type cost_kind as enum (
  'hardware',
  'software',
  'licence',
  'service',      -- installation, integration, consulting bought from outside
  'labour',       -- hours, internal or hired
  'other'
);

alter table cost
  add column kind cost_kind not null default 'other',
  -- `amount` becomes the price of ONE. Every existing line carries a quantity
  -- of one, so every total that has ever been reported still reads the same:
  -- 1 x amount is amount. Nothing is restated, and "2 x IO-Link master at 180"
  -- stops having to be entered as a single lump of 360 that no one can check.
  add column quantity numeric(12,3) not null default 1 check (quantity > 0);

create index cost_kind_idx on cost(node_id, kind);

comment on column cost.kind is
  'What sort of thing this is. Lets the same line serve as both a price and a '
  'part in the specification, so neither has to be typed twice.';
comment on column cost.quantity is
  'How many. The line is worth amount x quantity.';
comment on column cost.amount is
  'The price of one, in `currency`, exactly as the supplier wrote it. '
  'Multiply by quantity for the line, divide by eur_rate for the report.';

-- ---------------------------------------------------------------------------
-- Every total now counts the quantity.
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
    (c.amount * c.quantity / c.eur_rate) as eur,
    (c.recurrence = 'once') as is_once,
    (c.state in ('ordered', 'invoiced')) as is_committed,
    case c.recurrence
      when 'monthly'   then (c.amount * c.quantity / c.eur_rate) * 12
      when 'quarterly' then (c.amount * c.quantity / c.eur_rate) * 4
      when 'yearly'    then (c.amount * c.quantity / c.eur_rate)
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
  'Cost rolled up per node, always in euro, quantity included. Lines keep the '
  'currency of the quote and the rate that applied when it was written; this '
  'is the only place the conversion happens. Cut two independent ways: once '
  'against annual, capex against opex.';

insert into schema_migration (version, applied_at, note)
values ('20260904000001_basis', now(),
        'Topic on decisions, kind and quantity on cost lines')
on conflict (version) do nothing;

commit;
