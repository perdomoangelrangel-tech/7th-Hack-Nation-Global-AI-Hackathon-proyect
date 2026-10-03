-- graph_stats counts only diseases/entities that have active edges (hides the retracted CLN8 node) and adds researchers.
create or replace view graph_stats with (security_invoker = true) as
select
  (select count(*) from entities e where exists (select 1 from edges x where x.status = 'active' and (x.from_id = e.id or x.to_id = e.id))) as entities,
  (select count(*) from edges where status = 'active') as edges,
  (select count(*) from evidence ev join edges x on x.id = ev.edge_id where x.status = 'active') as evidence,
  (select count(*) from entities e where e.type = 'disease' and exists (select 1 from edges x where x.status = 'active' and (x.from_id = e.id or x.to_id = e.id))) as diseases,
  (select count(*) from entities e where e.type = 'trial' and exists (select 1 from edges x where x.status = 'active' and x.from_id = e.id)) as trials,
  (select count(*) from entities e where e.type = 'treatment' and exists (select 1 from edges x where x.status = 'active' and x.from_id = e.id)) as treatments,
  (select count(distinct source_id) from evidence) as sources_used,
  (select max(retrieved_at) from evidence) as last_retrieved_at,
  (select count(*) from research_community where public_profile) as researchers;
