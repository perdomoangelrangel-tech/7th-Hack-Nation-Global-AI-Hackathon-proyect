-- Cross-disease connections (challenge Module 3): every phenotype, gene, treatment, trial, organization
-- or researcher two diseases share, with the evidence for both sides. Read by /atlas Connections and the Lovable portal.
create or replace view disease_links with (security_invoker = true) as
with d as (
  select e.id from entities e
  where e.type = 'disease'
    and exists (select 1 from edges x where x.status = 'active' and (x.from_id = e.id or x.to_id = e.id))
),
links as (
  select 'phenotype'::text as kind, e.from_id as disease_id, e.to_id as item_id, e.id as edge_id, e.confidence, e.props
    from edges e where e.relation = 'has_phenotype' and e.status = 'active'
  union all
  select 'gene', e.to_id, e.from_id, e.id, e.confidence, e.props from edges e where e.relation = 'causes' and e.status = 'active'
  union all
  select 'treatment', e.to_id, e.from_id, e.id, e.confidence, e.props from edges e where e.relation = 'treats' and e.status = 'active'
  union all
  select 'trial', e.to_id, e.from_id, e.id, e.confidence, e.props
    from edges e join entities t on t.id = e.from_id and t.type = 'trial'
    where e.relation = 'studies' and e.status = 'active'
  union all
  select 'organization', e.to_id, e.from_id, e.id, e.confidence, e.props from edges e where e.relation = 'supports' and e.status = 'active'
)
select
  a.disease_id as disease_a,
  b.disease_id as disease_b,
  a.kind,
  i.canonical_id as item_code,
  i.name as item_name,
  i.props as item_props,
  a.props as props_a,
  b.props as props_b,
  least(a.confidence, b.confidence) as confidence,
  (select coalesce(jsonb_agg(jsonb_build_object('id', ev.id, 'source', ev.source_id, 'external_id', ev.external_id, 'url', ev.url, 'retrieved_at', ev.retrieved_at, 'side', case when ev.edge_id = a.edge_id then 'a' else 'b' end)), '[]'::jsonb)
     from evidence ev where ev.edge_id in (a.edge_id, b.edge_id)) as evidence
from links a
join links b on b.item_id = a.item_id and b.kind = a.kind and b.disease_id <> a.disease_id
join entities i on i.id = a.item_id
where a.disease_id in (select id from d) and b.disease_id in (select id from d)
union all
select
  r1.disease_id, r2.disease_id, 'researcher', null, r1.name, jsonb_build_object('affiliation', r1.affiliation, 'country', r1.country, 'orcid', r1.orcid),
  jsonb_build_object('source_ref', r1.source_ref), jsonb_build_object('source_ref', r2.source_ref), null,
  jsonb_build_array(
    jsonb_build_object('source', 'pubmed', 'external_id', r1.source_ref, 'url', 'https://pubmed.ncbi.nlm.nih.gov/' || replace(coalesce(r1.source_ref, ''), 'PMID:', '') || '/', 'side', 'a'),
    jsonb_build_object('source', 'pubmed', 'external_id', r2.source_ref, 'url', 'https://pubmed.ncbi.nlm.nih.gov/' || replace(coalesce(r2.source_ref, ''), 'PMID:', '') || '/', 'side', 'b'))
from research_community r1
join research_community r2 on lower(r2.name) = lower(r1.name) and r2.disease_id <> r1.disease_id
where r1.public_profile and r2.public_profile;

comment on view disease_links is 'Pairs of diseases and every phenotype, gene, treatment, trial, organization or researcher they share, with the evidence for both sides.';
