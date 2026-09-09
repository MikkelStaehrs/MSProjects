-- Two things that cannot be reconstructed later.
--
-- Neither of these builds a feature today. Both record something that is only
-- true in the moment it happens, and is gone if nobody writes it down. That is
-- the whole justification: everything else in this app is derived, and these
-- two are the cases where derivation is impossible after the fact.

begin;

-- ---------------------------------------------------------------------------
-- 1. What the figures were when a report was submitted.
-- ---------------------------------------------------------------------------
-- `fields` holds the four values that go into the company Power App. It says
-- nothing about the state they described: which node was next, what date it
-- carried, how far along the project was, who was being waited on.
--
-- Without that, «you said in week 34 that the VLAN was next, and it still is»
-- cannot be answered, because week 34 kept only its own prose. A project that
-- slips looks identical week to week in the archive as it stands.
--
-- Recomputing it is not possible: v_next_date and v_node_progress answer for
-- today, and the tree they read has moved on since.
alter table report add column context jsonb not null default '{}'::jsonb;

comment on column report.context is
  'The figures behind the fields at submission: progress, the next dated node, '
  'the open blockers. Written once and never recomputed, because the tree it '
  'described has moved on.';

-- ---------------------------------------------------------------------------
-- 2. What you thought a piece of work would take, before you did it.
-- ---------------------------------------------------------------------------
-- A range rather than a number, because that is how the guess is actually
-- held in your head: three to five days, not four.
--
-- Days rather than hours on purpose. Hours would need you to record hours,
-- which is a second habit, and the one thing this app cannot afford is another
-- discipline that lapses in a busy week. Elapsed calendar days are already
-- derivable from the first log entry and completed_at, so the measurement side
-- costs nothing and only the guess has to be captured.
--
-- Nothing reads these yet. In half a year they answer «you run 2.3 times over
-- your own estimate on integration work», which is a claim you can only make
-- if you started keeping them before you needed them.
alter table node
  add column estimate_low_days  int,
  add column estimate_high_days int;

alter table node
  add constraint node_estimate_sane check (
    (estimate_low_days  is null or estimate_low_days  >= 0) and
    (estimate_high_days is null or estimate_high_days >= 0) and
    (estimate_low_days is null or estimate_high_days is null
      or estimate_high_days >= estimate_low_days)
  );

comment on column node.estimate_low_days is
  'The optimistic end of the guess, in calendar days, recorded before the work.';
comment on column node.estimate_high_days is
  'The pessimistic end. Never overwritten once the work is done: the point is '
  'the gap between what you thought and what happened.';

commit;
