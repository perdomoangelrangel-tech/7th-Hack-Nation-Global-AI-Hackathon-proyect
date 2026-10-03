-- 0005_ingest_reactivate.sql
-- ingest_upsert(): an edge that was retracted (e.g. a trial that stopped recruiting) is re-activated
-- when a source reports it again. The guard trigger still requires evidence for any active edge.
create or replace function public.ingest_upsert(
  p_entities jsonb default '[]'::jsonb,
  p_edges    jsonb default '[]'::jsonb,
  p_aliases  jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  n_ent int := 0; n_edge int := 0; n_ev int := 0; n_alias int := 0;
begin
  insert into entities (type, canonical_id, name, props)
  select x.type, x.canonical_id, x.name, coalesce(x.props, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_entities, '[]'::jsonb))
       as x(type entity_type, canonical_id text, name text, props jsonb)
  on conflict (type, canonical_id) do update
     set name = excluded.name,
         props = entities.props || excluded.props,
         updated_at = now();
  get diagnostics n_ent = row_count;

  insert into edges (from_id, to_id, relation, confidence, confidence_basis, props)
  select f.id, t.id, s.relation, coalesce(s.confidence, 0.5), coalesce(s.confidence_basis, 'source_default'),
         coalesce(s.props, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_edges, '[]'::jsonb))
       as s(from_type entity_type, from_cid text, to_type entity_type, to_cid text, relation relation_type,
            confidence numeric, confidence_basis text, props jsonb, evidence jsonb)
  join entities f on f.type = s.from_type and f.canonical_id = s.from_cid
  join entities t on t.type = s.to_type   and t.canonical_id = s.to_cid
  where jsonb_array_length(coalesce(s.evidence, '[]'::jsonb)) > 0
  on conflict (from_id, to_id, relation) do update
     set confidence = excluded.confidence,
         confidence_basis = excluded.confidence_basis,
         props = edges.props || excluded.props,
         status = case when edges.status = 'retracted' then 'active'::edge_status else edges.status end,
         updated_at = now();
  get diagnostics n_edge = row_count;

  insert into evidence (edge_id, source_id, external_id, url, quote, published_on, retrieved_at)
  select ed.id, e.source_id, e.external_id, e.url, left(e.quote, 500), e.published_on, now()
  from jsonb_to_recordset(coalesce(p_edges, '[]'::jsonb))
       as s(from_type entity_type, from_cid text, to_type entity_type, to_cid text, relation relation_type, evidence jsonb)
  join entities f on f.type = s.from_type and f.canonical_id = s.from_cid
  join entities t on t.type = s.to_type   and t.canonical_id = s.to_cid
  join edges ed on ed.from_id = f.id and ed.to_id = t.id and ed.relation = s.relation
  cross join lateral jsonb_to_recordset(coalesce(s.evidence, '[]'::jsonb))
       as e(source_id text, external_id text, url text, quote text, published_on date)
  where e.url is not null and e.external_id is not null
  on conflict (edge_id, source_id, external_id) do update
     set url = excluded.url,
         quote = excluded.quote,
         published_on = coalesce(excluded.published_on, evidence.published_on),
         retrieved_at = now();
  get diagnostics n_ev = row_count;

  insert into entity_aliases (entity_id, alias, lang)
  select en.id, a.alias, coalesce(a.lang, 'en')
  from jsonb_to_recordset(coalesce(p_aliases, '[]'::jsonb))
       as a(type entity_type, canonical_id text, alias text, lang text)
  join entities en on en.type = a.type and en.canonical_id = a.canonical_id
  where coalesce(a.alias, '') <> ''
  on conflict (entity_id, alias, lang) do nothing;
  get diagnostics n_alias = row_count;

  return jsonb_build_object('entities', n_ent, 'edges', n_edge, 'evidence', n_ev, 'aliases', n_alias);
end $$;

revoke execute on function public.ingest_upsert(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_upsert(jsonb, jsonb, jsonb) to service_role;
