-- Half a thought, at eleven at night.
--
-- Every other table here demands that you know something: a node needs a type
-- and a parent, a cost line needs an amount, a decision needs what you turned
-- down. That is right for work and wrong for an idea. The good ones arrive in a
-- car park or in bed, and anything that asks "which project is this under?"
-- before it will accept the sentence is a thing you will not open.
--
-- So a spark has one required field. Where it goes, whether it becomes
-- anything, and what type it would be are all questions for a desk, later.
--
-- It is deliberately NOT a node with status 'idea'. That would put every
-- passing thought in the tree, in /projects, in the progress counts and in the
-- portfolio, and the tree would stop being a picture of the actual work. The
-- triage step is the point: most sparks should die, and a table you delete from
-- without guilt is a table you will keep writing to.

begin;

-- Where it came from. Worth keeping, because it tells you which route you
-- actually use and which one was a nice idea that nobody touched.
create type spark_source as enum (
  'app',       -- typed on the inbox page
  'quick',     -- captured with Ctrl+K
  'claude'     -- said to Claude and written in over the connector
);

create type spark_state as enum (
  'new',       -- not looked at yet
  'kept',      -- became real work. See became_node_id
  'dropped'    -- looked at, decided against. Kept, so it is not thought again
);

create table spark (
  id           uuid primary key default gen_random_uuid(),
  -- The only thing you have to have. Everything else can wait.
  body         text not null check (length(trim(body)) > 0),
  source       spark_source not null default 'app',
  state        spark_state not null default 'new',
  -- What it turned into, where it turned into anything. On delete set null
  -- rather than cascade: deleting the node it became must not erase the record
  -- that the thought was had and acted on.
  became_node_id uuid references node(id) on delete set null,
  -- Why it was dropped, where you bothered to say. The most useful field on a
  -- dead idea, and the reason dropped ones are kept at all.
  verdict      text,
  captured_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index spark_state_idx on spark(state, captured_at desc);

comment on table spark is
  'Captured thoughts, before they are work. One required field on purpose: an '
  'idea that has to be classified before it can be written down is an idea '
  'that does not get written down.';
comment on column spark.became_node_id is
  'The node it became. Set null if that node is later deleted: the thought was '
  'still had.';
comment on column spark.verdict is
  'Why it was dropped. The reason dropped sparks are kept rather than deleted.';

create trigger spark_set_updated_at
  before update on spark
  for each row execute function set_updated_at();

alter table spark enable row level security;

create policy spark_owner on spark
  for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

insert into schema_migration (version, applied_at, note)
values ('20260904000004_spark', now(),
        'An inbox for half thoughts, outside the tree on purpose')
on conflict (version) do nothing;

commit;
