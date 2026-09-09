-- v_next_milestone -> v_next_date
--
-- Beregningen var aldrig milepælsspecifik: den finder den første uafsluttede
-- efterkommer med en due_date, uanset is_milestone. Navnet lovede noget andet
-- end det leverede. Logikken er uændret, kun navnet retter sig efter den.
--
-- is_milestone bliver stående som kolonne, så UI kan markere de datoer der
-- rent faktisk er milepæle, uden at feltet afhænger af flaget.

drop view v_next_milestone;

create view v_next_date as
with candidate as (
  select
    d.root_id,
    n.id, n.title, n.due_date, n.is_milestone, n.status,
    row_number() over (
      partition by d.root_id
      order by n.due_date asc, n.is_milestone desc, n.title asc
    ) as rn
  from v_node_descendant d
  join node n on n.id = d.node_id
  where d.depth > 0
    and n.due_date is not null
    and n.completed_at is null
    and n.status not in ('done','cancelled')
)
select
  root_id as node_id,
  id      as next_node_id,
  title,
  due_date,
  is_milestone,
  status,
  due_date - current_date as days_until
from candidate
where rn = 1;

alter view v_next_date set (security_invoker = on);
