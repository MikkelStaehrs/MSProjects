-- What a piece of work is FOR, above the project it lives in.
--
-- "COGS saving" is a company strategy that several unrelated projects serve at
-- once, and it is the first of its kind, not the only one. So this is a table
-- rather than a column: a boolean called cogs_saving would have to be joined
-- by a second boolean the day someone announces a sustainability programme,
-- and by a third the day after that.
--
-- The marking sits on any node, not only on a project. A broad digitalisation
-- project can have exactly one subproject that saves cost of goods, and saying
-- the whole project counts would overstate the strategy by everything else in
-- it.
--
-- That creates the one thing worth being careful about: if a subproject is
-- marked and its parent is marked too, the money underneath it must not be
-- counted twice. `v_strategy_node` derives which markings are the topmost one
-- in their branch, and only those are added up. Derived, because a "counts
-- towards the total" checkbox is a checkbox that goes wrong the first time
-- somebody marks a parent.

begin;

create table strategy (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  -- What the strategy is measured against, per year, in euro. Null where it is
  -- a heading rather than a promise: not every strategy arrives with a number,
  -- and inventing one to fill the field would be worse than leaving it open.
  target_annual numeric(14,2),
  owner        text,
  started_on   date,
  -- Null while it runs. A finished strategy stays, because what it delivered is
  -- the evidence for the next one.
  ended_on     date,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (target_annual is null or target_annual >= 0)
);

create index strategy_sort_idx on strategy(sort_order, name);

comment on table strategy is
  'A company strategy that projects serve. Cuts across the tree: one strategy '
  'is fed by work sitting under several unrelated projects.';
comment on column strategy.target_annual is
  'The annual figure the strategy is measured against, in euro. Null where the '
  'strategy carries no number.';

create trigger strategy_set_updated_at
  before update on strategy
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- The marking itself.
-- ---------------------------------------------------------------------------
create table node_strategy (
  id          uuid primary key default gen_random_uuid(),
  node_id     uuid not null references node(id) on delete cascade,
  strategy_id uuid not null references strategy(id) on delete cascade,
  -- What THIS node promises THIS strategy, per year, in euro.
  --
  -- Null means: take the node's own expected annual benefit, whole. That is
  -- the common case and it keeps one number in one place. A figure here is for
  -- the project that serves two strategies, or that serves one only in part,
  -- where the project's own benefit would be the wrong number to add up.
  annual_eur  numeric(14,2),
  note        text,
  created_at  timestamptz not null default now(),
  unique (node_id, strategy_id),
  check (annual_eur is null or annual_eur >= 0)
);

create index node_strategy_node_idx     on node_strategy(node_id);
create index node_strategy_strategy_idx on node_strategy(strategy_id);

comment on column node_strategy.annual_eur is
  'This node contribution to this strategy, per year, in euro. Null means the '
  'node own expected annual benefit counts in full.';

-- ---------------------------------------------------------------------------
-- Which markings are the topmost in their branch.
-- ---------------------------------------------------------------------------
create view v_strategy_node as
select
  ns.id,
  ns.strategy_id,
  ns.node_id,
  ns.annual_eur,
  ns.note,
  -- False where an ancestor of this node carries the same strategy. Adding up
  -- only the true ones is what stops a marked parent and a marked child from
  -- being counted as two.
  not exists (
    select 1
    from node_strategy above
    join v_node_descendant d
      on d.root_id = above.node_id
     and d.node_id = ns.node_id
     and d.depth > 0
    where above.strategy_id = ns.strategy_id
  ) as is_top
from node_strategy ns;

alter view v_strategy_node set (security_invoker = on);

comment on view v_strategy_node is
  'Every marking, with whether it is the topmost one for its strategy in its '
  'branch. Only the topmost are added up, so a marked subproject inside a '
  'marked project is never counted twice.';

-- ---------------------------------------------------------------------------
-- RLS. Single account, same as everything else.
-- ---------------------------------------------------------------------------
alter table strategy      enable row level security;
alter table node_strategy enable row level security;

create policy strategy_owner on strategy
  for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

create policy node_strategy_owner on node_strategy
  for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- The one that started it.
-- ---------------------------------------------------------------------------
insert into strategy (name, description, sort_order)
values (
  'COGS saving',
  'Work that lowers the cost of goods sold. Marked on whatever part of the '
  'tree actually delivers the saving, which is not always the whole project.',
  0
)
on conflict do nothing;

insert into schema_migration (version, applied_at, note)
values ('20260904000003_strategy', now(),
        'Strategies across the tree, with the topmost marking derived')
on conflict (version) do nothing;

commit;
