-- Dokumenter. Den syvende tabel.
--
-- Selve filerne ligger i Supabase Storage, ikke i basen. Tabellen her holder
-- kun metadata og stien, så en node kan have flere filer og en fil altid ved
-- hvor den hører til.
--
-- Bucket'en er PRIVAT. Der findes ingen offentlig URL til noget som helst —
-- adgang sker gennem en signeret URL der udstedes af serveren og udløber.

create table document (
  id         uuid primary key default gen_random_uuid(),
  node_id    uuid not null references node(id) on delete cascade,
  name       text not null,              -- filnavnet som brugeren kender det
  path       text not null unique,       -- stien i bucket'en
  mime_type  text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index document_node_id_idx on document(node_id, created_at desc);

alter table document enable row level security;

create policy document_owner on document
  for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- Bucket. Privat, 25 MB pr. fil.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 26214400)
on conflict (id) do update
  set public = false, file_size_limit = 26214400;

-- Enkeltbruger: den der er logget ind må læse, lægge op og slette i bucket'en.
create policy documents_read on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and auth.uid() is not null);

create policy documents_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and auth.uid() is not null);

create policy documents_remove on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and auth.uid() is not null);
