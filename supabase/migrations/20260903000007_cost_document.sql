-- The paper behind the number.
--
-- `reference` already holds a quote number, a PO or an invoice number, which is
-- what you would type into a finance system. It is not the same as having the
-- quote. A price without the document behind it is a number you have to take on
-- trust six months later, and the one question anybody asks about a cost line
-- is «where does that figure come from».
--
-- On delete set null rather than cascade: removing a file must never remove the
-- money. The line stays, it simply loses its attachment.

begin;

alter table cost
  add column document_id uuid references document(id) on delete set null;

comment on column cost.document_id is
  'The quote, order confirmation or invoice this line rests on. Set null when '
  'the file is deleted: losing the paper must not lose the money.';

insert into schema_migration (version, applied_at, note)
values ('20260903000007_cost_document', now(), 'A cost line can carry its own paper')
on conflict (version) do nothing;

commit;
