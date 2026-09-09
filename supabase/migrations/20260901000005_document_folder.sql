-- Mapper på dokumenter.
--
-- En tekstkolonne, ikke en tabel. Mappen er en etiket brugeren vælger, ikke
-- en entitet med sit eget liv — og et skabelonsæt skal kunne udrulles uden
-- at oprette rækker der bagefter står tomme.
--
-- Skabelonens `body.folders` er en liste af navne, fx
--   ["01 Kom godt i gang", "02 Aftaler og jura", "03 Tilbud", "04 Dokumentation"]
-- Nummereringen er en del af navnet, så sorteringen giver sig selv.

alter table document add column folder text;

create index document_folder_idx on document(node_id, folder);
