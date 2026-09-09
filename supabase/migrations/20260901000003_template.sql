-- Skabeloner. Den sjette tabel, og den eneste der er planlagt fra start.
--
-- `body` rummer et helt projekttræ som jsonb i stedet for rækker, fordi en
-- skabelon aldrig forespørges på — den læses hel og udrulles hel. Havde den
-- ligget i node-tabellen med et flag, skulle hvert eneste view filtrere
-- skabeloner fra resten af livet.
--
-- Form:
--   {
--     "nodes": [
--       { "title": "Indkøb og godkendelse", "type": "subproject",
--         "offset_days": 30, "is_milestone": false, "children": [ ... ] }
--     ],
--     "risks": [
--       { "title": "Leveringstid på scanner", "waiting_on": "Leverandør",
--         "waiting_on_type": "vendor", "expected_days": 21 }
--     ]
--   }
--
-- offset_days er dage fra projektets startdato til nodens frist. Datoerne
-- regnes altså ud ved udrulning og gemmes ikke i skabelonen.

create table template (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  category    node_category,
  body        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger template_set_updated_at
  before update on template
  for each row execute function set_updated_at();

alter table template enable row level security;

create policy template_owner on template
  for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);
