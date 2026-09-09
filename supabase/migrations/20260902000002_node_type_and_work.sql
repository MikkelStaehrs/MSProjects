-- To ting om node-typen.
--
-- 1. 'program' hedder nu 'development'.
--
-- 2. Fremdrift tæller kun opgaver.
--
-- Før talte v_node_progress ethvert blad, altså enhver node uden børn. Det
-- betød at et nyoprettet, tomt delprojekt talte som arbejde: projektet stod
-- på «0 af 1», hvor den ene var delprojektet selv. Så snart delprojektet fik
-- sin første opgave, holdt det op med at tælle, og nævneren hoppede.
--
-- En beholder er ikke arbejde. Arbejdet ligger i opgaverne, og kun opgaver
-- tælles nu. Et projekt uden opgaver står på 0 af 0 og dermed 0 %, hvilket
-- er ærligere end 0 af 1.

alter type node_type rename value 'program' to 'development';

drop view v_node_progress;
drop view v_node_leaf;

-- Bladet er stadig strukturelt: en node uden børn. Typen kommer med, så
-- den der bruger viewet selv kan afgøre hvad der er arbejde.
create view v_node_leaf as
select
  n.id,
  n.status,
  n.type,
  not exists (select 1 from node c where c.parent_id = n.id) as is_leaf
from node n;

-- Kun opgaver uden børn er arbejde. Aflyste tæller hverken med eller imod.
create view v_node_progress as
select
  d.root_id as node_id,
  count(case when l.is_leaf and l.type = 'task' and l.status <> 'cancelled' then 1 end) as leaf_total,
  count(case when l.is_leaf and l.type = 'task' and l.status = 'done'      then 1 end) as leaf_done,
  case
    when count(case when l.is_leaf and l.type = 'task' and l.status <> 'cancelled' then 1 end) = 0 then 0
    else cast(round(
      100.0 * count(case when l.is_leaf and l.type = 'task' and l.status = 'done' then 1 end)
            / count(case when l.is_leaf and l.type = 'task' and l.status <> 'cancelled' then 1 end)
    ) as int)
  end as progress_pct
from v_node_descendant d
join v_node_leaf l on l.id = d.node_id
group by d.root_id;

alter view v_node_leaf     set (security_invoker = on);
alter view v_node_progress set (security_invoker = on);
