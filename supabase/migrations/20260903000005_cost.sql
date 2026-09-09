-- What it actually costs, one line at a time.
--
-- Until now economics was two numbers on the project: a cost and a benefit,
-- typed once and ageing from that day. But a project is priced the way it is
-- run, piece by piece: a sensor, a DIM cabinet, an electrician. Each of those
-- belongs to a part of the tree, and together they are a better estimate than
-- the number written in March.
--
-- The gap between the two is the point. «Planned 1 450 000, priced 620 000»
-- says how much of the budget is still a guess, and that is a question the
-- single figure could never answer.
--
-- Four states, because certainty is what makes a number mean something
-- different. An estimate is a belief, a quote is a supplier's promise, an order
-- is money spoken for and an invoice is money gone. Committed is ordered plus
-- invoiced: the part you can no longer change your mind about.

begin;

create type cost_state as enum ('estimate', 'quoted', 'ordered', 'invoiced');

create table cost (
  id          uuid primary key default gen_random_uuid(),
  node_id     uuid not null references node(id) on delete cascade,
  description text not null,
  -- Whole currency units, not thousands. A 4 200 kroner sensor written as 4.2
  -- is how a line item stops being worth entering.
  amount      numeric(14,2) not null,
  state       cost_state not null default 'estimate',
  vendor      text,
  reference   text,                       -- quote number, PO, invoice number
  dated       date not null default current_date,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (amount >= 0)
);

create index cost_node_id_idx on cost(node_id, dated desc);

create trigger cost_set_updated_at
  before update on cost
  for each row execute function set_updated_at();

alter table cost enable row level security;

create policy cost_owner on cost
  for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

comment on table cost is
  'Priced line items, attached to any node and rolled up through the tree. The '
  'sum of these is what the project is actually adding up to; reporting.economics '
  'is what was planned. The difference is how much is still a guess.';

-- ---------------------------------------------------------------------------
-- The roll-up, the same shape as progress: every node answers for its subtree.
-- ---------------------------------------------------------------------------
create view v_node_cost as
select
  d.root_id as node_id,
  coalesce(sum(c.amount) filter (where c.state = 'estimate'), 0)::numeric(14,2) as estimated,
  coalesce(sum(c.amount) filter (where c.state = 'quoted'),   0)::numeric(14,2) as quoted,
  coalesce(sum(c.amount) filter (where c.state = 'ordered'),  0)::numeric(14,2) as ordered,
  coalesce(sum(c.amount) filter (where c.state = 'invoiced'), 0)::numeric(14,2) as invoiced,
  -- Money you can no longer change your mind about.
  coalesce(sum(c.amount) filter (where c.state in ('ordered', 'invoiced')), 0)::numeric(14,2) as committed,
  coalesce(sum(c.amount), 0)::numeric(14,2) as priced,
  count(c.id) as items
from v_node_descendant d
left join cost c on c.node_id = d.node_id
group by d.root_id;

alter view v_node_cost set (security_invoker = on);

comment on view v_node_cost is
  'Cost rolled up per node, split by how certain it is. priced is the total of '
  'all four; committed is ordered plus invoiced. Never stored.';

insert into schema_migration (version, applied_at, note)
values ('20260903000005_cost', now(), 'Priced line items, rolled up through the tree')
on conflict (version) do nothing;

commit;
