-- The last two columns that were only documented, not constrained.
--
-- A backend audit against the live database found one structural gap. Every
-- other closed set in this schema is a real enum: node_status, node_type,
-- node_category, cost_state, cost_recurrence, cost_budget, cost_currency,
-- cost_kind, decision_topic. Two were plain `text` with the allowed values
-- written in a trailing comment:
--
--   entry.kind             text not null default 'work'   -- work|note|meeting|risk
--   blocker.waiting_on_type text not null default 'other' -- internal_it|management|...
--
-- A comment does not stop anything. Both are written by server actions that
-- cast whatever arrived, `(text(fd, 'kind') ?? 'work') as EntryKind`, and
-- TypeScript disappears at the network boundary. Rename a form field and the
-- database accepts the mistake in silence, which is exactly the failure mode
-- this project keeps designing out.
--
-- The existing data is clean: entry.kind is only 'note', waiting_on_type only
-- 'other', 'management' and 'internal_it'. So the conversion cannot fail on
-- what is already there.
--
-- The two blocker views select `b.*` and therefore depend on the column, and
-- Postgres will not retype a column a view is built on. They are dropped and
-- recreated verbatim, which also lets them pick up the new type.

begin;

create type entry_kind as enum ('work', 'note', 'meeting', 'risk');

create type waiting_on_type as enum (
  'internal_it',
  'management',
  'vendor',
  'external',
  'other'
);

-- ---------------------------------------------------------------------------
-- entry.kind
-- ---------------------------------------------------------------------------
alter table entry
  alter column kind drop default,
  alter column kind type entry_kind using kind::text::entry_kind,
  alter column kind set default 'work';

comment on column entry.kind is
  'What sort of line this is. A closed set, enforced here rather than in a '
  'comment.';

-- ---------------------------------------------------------------------------
-- blocker.waiting_on_type. Two views stand on it.
-- ---------------------------------------------------------------------------
drop view v_active_blocker;
drop view v_blocker_days;

alter table blocker
  alter column waiting_on_type drop default,
  -- Cast through text: the column and the type share a name, and the two step
  -- cast is the form migration 003 already used to swap an enum.
  alter column waiting_on_type type waiting_on_type using waiting_on_type::text::waiting_on_type,
  alter column waiting_on_type set default 'other';

comment on column blocker.waiting_on_type is
  'What kind of party you are waiting on. Drives the median wait per type, so '
  'a typo here would quietly split one recipient into two.';

-- Recreated exactly as they were.
create view v_active_blocker as
select
  b.*,
  current_date - b.opened_at as days_blocked,
  case when b.expected_by is not null and b.expected_by < current_date
       then true else false end as overdue
from blocker b
where b.resolved_at is null;

create view v_blocker_days as
select
  b.*,
  coalesce(b.resolved_at, current_date) - b.opened_at as days_blocked,
  (b.resolved_at is null) as is_active
from blocker b;

alter view v_active_blocker set (security_invoker = on);
alter view v_blocker_days   set (security_invoker = on);

comment on view v_active_blocker is
  'Open blockers with the days they have been open. Overdue is against the '
  'date a reply was expected, not against any deadline of the work.';
comment on view v_blocker_days is
  'Every blocker, resolved ones included, with how long it ran. The basis for '
  'the wait figures on /blockers.';

insert into schema_migration (version, applied_at, note)
values ('20260904000002_kind_enums', now(),
        'entry.kind and blocker.waiting_on_type are enums, not text with a comment')
on conflict (version) do nothing;

commit;
