-- Afhængighed mellem projekter.
--
-- Træet kan udtrykke at noget hører UNDER noget andet. Det kan ikke udtrykke
-- at dataplatformen skal stå færdig FØR scanneren kan aflevere data — to
-- sideordnede projekter der venter på hinanden. Det er en kant, ikke et
-- forældreforhold, og derfor sin egen tabel.
--
-- Retningen læses: node_id venter på depends_on_id.
--
-- Vi viser kun ét led i hver retning, så en længere kæde der lukker sig selv
-- gør ingen skade — den ville bare vise begge veje. Derfor kun de to værn
-- der faktisk kan gøre skade: en node kan ikke vente på sig selv, og samme
-- kant kan ikke registreres to gange.

create table node_dependency (
  id            uuid primary key default gen_random_uuid(),
  node_id       uuid not null references node(id) on delete cascade,
  depends_on_id uuid not null references node(id) on delete cascade,
  note          text,
  created_at    timestamptz not null default now(),
  unique (node_id, depends_on_id),
  check (node_id <> depends_on_id)
);

create index node_dependency_node_idx    on node_dependency(node_id);
create index node_dependency_depends_idx on node_dependency(depends_on_id);

alter table node_dependency enable row level security;

create policy node_dependency_owner on node_dependency
  for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);
