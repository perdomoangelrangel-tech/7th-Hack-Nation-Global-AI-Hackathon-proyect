-- 0004_ingest_infra.sql
-- Ingestion runs inside Supabase (Edge Function `ingest`, invoked by pg_net / pg_cron).
-- 1) app_secrets: server-only secrets (no RLS policies => only service_role / postgres can read).
-- 2) ingest_upsert(): one-call, idempotent graph writer used by the Edge Function.
-- 3) research_community uniqueness for literature-derived authors.
-- 4) research_gaps exposes entity ids (append-only change to the view).
-- 5) private.invoke_ingest(): helper used by pg_cron to call the Edge Function.

-- 1) Secrets ---------------------------------------------------------------
create table if not exists public.app_secrets (
  name  text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
insert into public.app_secrets (name, value)
values ('ingest_key', gen_random_uuid()::text)
on conflict (name) do nothing;

-- 2) Graph writer ----------------------------------------------------------
-- p_entities: [{type, canonical_id, name, props}]           (deduplicated by the caller)
-- p_edges:    [{from_type, from_cid, to_type, to_cid, relation, confidence, confidence_basis, props,
--               evidence: [{source_id, external_id, url, quote, published_on}]}]
-- p_aliases:  [{type, canonical_id, alias, lang}]
-- Props are merged (existing || new), never wiped. Edges without evidence are ignored.
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

-- 3) Community uniqueness ---------------------------------------------------
create unique index if not exists research_community_uniq
  on public.research_community (disease_id, name, source);

-- 4) research_gaps with ids (columns appended at the end, so the view is replaced in place)
create or replace view public.research_gaps with (security_invoker = true) as
select edge_id, relation, from_name, to_name, confidence, jsonb_array_length(evidence) as evidence_count,
       from_id, to_id, from_type, to_type
from public.edge_evidence
where jsonb_array_length(evidence) <= 1 or confidence < 0.4;

-- 5) Cron helper -----------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.invoke_ingest(p_orpha text, p_step text default 'all', p_timeout_ms int default 150000)
returns bigint
language sql
set search_path = ''
as $$
  select net.http_post(
    url := 'https://zuqwmvshkhniqebtxlks.supabase.co/functions/v1/ingest',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-ingest-key', (select value from public.app_secrets where name = 'ingest_key')),
    body := jsonb_strip_nulls(jsonb_build_object('orpha', p_orpha, 'step', p_step)),
    timeout_milliseconds := p_timeout_ms
  );
$$;
revoke execute on function private.invoke_ingest(text, text, int) from public, anon, authenticated;
