-- Export one disease map in src/data/snapshot.json format (read-only; replace __ORPHA__).
-- Preferred refresh from a machine that reaches Supabase: curl -s https://<site>/api/snapshot > src/data/snapshot.json
with d as (
  select id, canonical_id, name, props from entities where type = 'disease' and canonical_id = '__ORPHA__'
), ee as (
  select v.* from edge_evidence v, d where v.from_id = d.id or v.to_id = d.id
), s as (
  select
    case when relation = 'has_phenotype' then 'phenotypes' when relation = 'causes' then 'genes' when relation = 'treats' then 'treatments'
         when relation = 'studies' and from_type = 'trial' then 'trials' when relation = 'studies' then 'literature'
         when relation in ('supports','researches') then 'community' end as line,
    relation,
    case when relation = 'has_phenotype' then to_id else from_id end as eid,
    case when relation = 'has_phenotype' then to_name else from_name end as name,
    case when relation = 'has_phenotype' then to_canonical_id else from_canonical_id end as cid,
    case when relation = 'has_phenotype' then to_props else from_props end as p,
    confidence, edge_props, evidence
  from ee
), r as (
  select s.*, row_number() over (partition by line order by
    case when line = 'literature' then coalesce(evidence->0->>'published_on', '') end desc nulls last,
    case when line = 'trials' then (case when upper(coalesce(p->>'status', '')) in ('RECRUITING','NOT_YET_RECRUITING','ENROLLING_BY_INVITATION') then 0 else 1 end) end,
    confidence desc, jsonb_array_length(evidence) desc, name) rn
  from s where line is not null
), st as (
  select line, rn, jsonb_build_object(
    'id', eid, 'name', name, 'canonical_id', cid, 'relation', relation, 'confidence', confidence::float, 'weak', confidence < 0.4,
    'props', jsonb_strip_nulls(case line
      when 'genes' then jsonb_build_object('symbol', p->'symbol', 'locus', p->'locus')
      when 'treatments' then jsonb_build_object('drug_type', p->'drug_type', 'approved', p->'approved', 'mechanism', p->'mechanism')
      when 'trials' then jsonb_build_object('status', p->'status', 'phase', p->'phase', 'phases', p->'phases', 'sponsor', p->'sponsor', 'start_date', p->'start_date',
          'countries', (select jsonb_agg(c) from (select c from jsonb_array_elements(case when jsonb_typeof(p->'countries') = 'array' then p->'countries' else '[]'::jsonb end) c limit 12) x))
      when 'literature' then jsonb_build_object('journal', p->'journal', 'authors', (select jsonb_agg(a) from (select a from jsonb_array_elements(case when jsonb_typeof(p->'authors') = 'array' then p->'authors' else '[]'::jsonb end) a limit 3) y))
      when 'community' then jsonb_build_object('country', p->'country', 'url', p->'url', 'kind', p->'kind')
      else '{}'::jsonb end),
    'edge_props', jsonb_strip_nulls(jsonb_build_object('frequency', edge_props->'frequency', 'association_type', edge_props->'association_type',
      'phase', edge_props->'phase', 'status', edge_props->'status', 'stage', edge_props->'stage', 'approved_for_indication', edge_props->'approved_for_indication',
      'investigational', edge_props->'investigational', 'mechanism', edge_props->'mechanism')),
    'evidence', (select jsonb_agg(jsonb_build_object('id', e->'id', 'source', e->'source', 'external_id', e->'external_id', 'url', e->'url',
        'published_on', e->'published_on', 'retrieved_at', left(e->>'retrieved_at', 19) || 'Z', 'quote', left(e->>'quote', 100))) from (select e from jsonb_array_elements(evidence) e limit 2) z)
  ) j from r
  where rn <= case line when 'genes' then 12 when 'phenotypes' then 8 when 'treatments' then 6 when 'trials' then 6 when 'literature' then 5 else 8 end
), rc as (
  select jsonb_build_object('id', 'rc:' || c.id, 'name', c.name, 'canonical_id', coalesce('ORCID:' || c.orcid, c.source_ref, ''), 'relation', 'researches', 'confidence', null, 'weak', false,
    'props', jsonb_strip_nulls(jsonb_build_object('kind', 'researcher', 'role', c.role, 'affiliation', c.affiliation, 'country', c.country, 'focus', c.focus, 'open_to_contact', c.open_to_contact, 'source', c.source)),
    'edge_props', '{}'::jsonb,
    'evidence', jsonb_build_array(jsonb_build_object('id', 'rc:' || c.id, 'source', case when c.source = 'pubmed_author' then 'pubmed' else 'research_community' end,
      'external_id', coalesce(c.source_ref, 'ORCID:' || c.orcid, c.source),
      'url', case when c.source_ref ~ '^(PMID:)?[0-9]+$' then 'https://pubmed.ncbi.nlm.nih.gov/' || regexp_replace(c.source_ref, '^PMID:', '') || '/' when c.orcid is not null then 'https://orcid.org/' || c.orcid else '' end,
      'published_on', null, 'retrieved_at', c.created_at))
  ) j, row_number() over (order by c.created_at desc) rn
  from research_community c, d where c.disease_id = d.id and c.public_profile
)
select jsonb_build_object(
  'disease', jsonb_build_object('id', d.id, 'orpha', d.canonical_id, 'name', d.name, 'name_es', d.props->'name_es',
     'short', split_part(trim(regexp_replace(d.name, '[(,].*$', '')), ' ', 1),
     'aliases', coalesce((select jsonb_agg(alias) from entity_aliases a where a.entity_id = d.id), '[]'),
     'props', jsonb_strip_nulls(jsonb_build_object('definition', left(d.props->>'definition', 400), 'mondo', d.props->'mondo',
        'prevalence', (select jsonb_agg(jsonb_build_object('type', pv->'type', 'class', pv->'class', 'geographic', pv->'geographic'))
           from jsonb_array_elements(case when jsonb_typeof(d.props->'prevalence') = 'array' then d.props->'prevalence' else '[]'::jsonb end) pv
           where pv->>'class' is not null and pv->>'class' <> 'Unknown')))),
  'lines', jsonb_build_object(
    'genes', coalesce((select jsonb_agg(j order by rn) from st where line = 'genes'), '[]'),
    'phenotypes', coalesce((select jsonb_agg(j order by rn) from st where line = 'phenotypes'), '[]'),
    'treatments', coalesce((select jsonb_agg(j order by rn) from st where line = 'treatments'), '[]'),
    'trials', coalesce((select jsonb_agg(j order by rn) from st where line = 'trials'), '[]'),
    'literature', coalesce((select jsonb_agg(j order by rn) from st where line = 'literature'), '[]'),
    'community', coalesce((select jsonb_agg(j order by rn) from st where line = 'community'), '[]') || coalesce((select jsonb_agg(j order by rn) from rc where rn <= 4), '[]')),
  'totals', jsonb_build_object(
    'genes', (select count(*) from s where line = 'genes'), 'phenotypes', (select count(*) from s where line = 'phenotypes'),
    'treatments', (select count(*) from s where line = 'treatments'), 'trials', (select count(*) from s where line = 'trials'),
    'literature', (select count(*) from s where line = 'literature'),
    'community', (select count(*) from s where line = 'community') + (select count(*) from rc)),
  'gaps', '[]'::jsonb,
  'retrieved_at', (select left(max(e->>'retrieved_at'), 19) || 'Z' from ee, jsonb_array_elements(ee.evidence) e)
)::text as map
from d;
