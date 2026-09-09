-- A record of what has actually been applied.
--
-- Until now the files in supabase/migrations/ were documentation, not state.
-- Which of them had reached the database was known only by convention and by
-- asking, and the answer was reconstructed each time by probing for a column
-- that a given migration would have added. That works with nine files and one
-- person. It stops working the first time you come back after a pause, or the
-- first time a migration fails halfway and nobody is sure how far it got.
--
-- This is deliberately the small half of the job. It does not apply anything:
-- migrations are still run by hand through the SQL editor. It only makes the
-- database able to answer what it has already seen, which is the half that
-- actually removes the risk.
--
-- The convention from here: every migration ends by recording itself.

begin;

create table if not exists schema_migration (
  version    text primary key,
  -- Null where the migration was recorded after the fact. An invented
  -- timestamp would read as a measurement, and the point of this table is to
  -- be trustworthy about what is known.
  applied_at timestamptz,
  note       text,
  recorded_at timestamptz not null default now()
);

comment on table schema_migration is
  'What has been applied. Written by each migration as its last statement. '
  'Applying is still manual: this records, it does not run anything.';

alter table schema_migration enable row level security;

drop policy if exists schema_migration_owner on schema_migration;
create policy schema_migration_owner on schema_migration
  for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- The nine that came before, in order. Their dates are not recorded, because
-- they were not written down at the time and guessing would be worse.
insert into schema_migration (version, note) values
  ('20260901000001_init',              'Recorded retroactively on 3 September 2026'),
  ('20260901000002_next_date',         'Recorded retroactively on 3 September 2026'),
  ('20260901000003_template',          'Recorded retroactively on 3 September 2026'),
  ('20260901000004_document',          'Recorded retroactively on 3 September 2026'),
  ('20260901000005_document_folder',   'Recorded retroactively on 3 September 2026'),
  ('20260902000001_node_dependency',   'Recorded retroactively on 3 September 2026'),
  ('20260902000002_node_type_and_work','Recorded retroactively on 3 September 2026'),
  ('20260902000003_blocked_derived',   'Recorded retroactively on 3 September 2026'),
  ('20260903000001_capture',           'Recorded retroactively on 3 September 2026')
on conflict (version) do nothing;

-- And this one, which does know when it ran.
insert into schema_migration (version, applied_at, note)
values ('20260903000002_schema_migration', now(), 'The first to record itself')
on conflict (version) do nothing;

commit;
