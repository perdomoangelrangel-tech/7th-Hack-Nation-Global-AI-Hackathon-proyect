-- 0011_nexmed.sql
-- Nexmed graph model (contract: docs/WORKFLOW.md §3.1).
--   1) entity types pathway / investigator, relations participates_in / similar_to
--   2) edges.kind: observed | inferred | extracted | proposed
--   3) sources: reactome, nih_reporter, openai_extraction, nexmed_analysis, community
--   4) proposals (community drafts, never evidence) + submit_proposal() + proposals_public
--   5) extractions (OpenAI-extracted claims from a cited paper) + save_extraction()
--   6) atlas_version(): cheap change marker for the loader cache
-- New enum values are NOT used inside this migration (Postgres forbids using them in the same transaction).

-- 1) Enums -------------------------------------------------------------------
alter type public.entity_type   add value if not exists 'pathway';
alter type public.entity_type   add value if not exists 'investigator';
alter type public.relation_type add value if not exists 'participates_in';
alter type public.relation_type add value if not exists 'similar_to';

-- 2) Edge kind ---------------------------------------------------------------
alter table public.edges add column if not exists kind text not null default 'observed';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'edges_kind_check' and conrelid = 'public.edges'::regclass) then
    alter table public.edges add constraint edges_kind_check check (kind in ('observed', 'inferred', 'extracted', 'proposed'));
  end if;
end $$;

-- 3) Sources -----------------------------------------------------------------
insert into public.sources (id, name, license, base_url) values
  ('reactome',          'Reactome (via Open Targets)',            'CC BY 4.0',       'https://reactome.org'),
  ('nih_reporter',      'NIH RePORTER',                           'Public domain',   'https://api.reporter.nih.gov'),
  ('openai_extraction', 'OpenAI extraction from a cited paper',   'Derived (cites source paper)', 'https://pubmed.ncbi.nlm.nih.gov'),
  ('nexmed_analysis',   'Nexmed analysis (inferred)',             'Derived',         'https://github.com/perdomoangelrangel-tech/7th-Hack-Nation-Global-AI-Hackathon-proyect'),
  ('community',         'Nexmed community drafts (not evidence)', 'User submitted',  'https://github.com/perdomoangelrangel-tech/7th-Hack-Nation-Global-AI-Hackathon-proyect')
on conflict (id) do nothing;

-- 4) Proposals ---------------------------------------------------------------
create table if not exists public.proposals (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('hypothesis', 'collaboration', 'evidence')),
  title      text not null check (char_length(title) between 3 and 200),
  body       text not null check (char_length(body) between 1 and 4000),
  persona    text check (persona is null or char_length(persona) <= 40),
  disease    text check (disease is null or char_length(disease) <= 120),     -- Entity.id, e.g. disease:ORPHA:599373
  entities   text[] not null default '{}' check (cardinality(entities) <= 50),
  edges      text[] not null default '{}' check (cardinality(edges) <= 100),
  contact    text check (contact is null or char_length(contact) <= 200),     -- never exposed through the API
  status     text not null default 'draft' check (status in ('draft', 'under_review', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);
create index if not exists proposals_disease on public.proposals (disease, created_at desc);
create index if not exists proposals_created on public.proposals (created_at desc);
alter table public.proposals enable row level security;

-- Column-level grants: anon/authenticated may read every column except `contact`; writes only via the RPC.
revoke all on public.proposals from anon, authenticated;
grant select (id, kind, title, body, persona, disease, entities, edges, status, created_at) on public.proposals to anon, authenticated;
drop policy if exists "proposals public read" on public.proposals;
create policy "proposals public read" on public.proposals for select to anon, authenticated using (status <> 'rejected');

create or replace view public.proposals_public with (security_invoker = true) as
select id, kind, title, body, persona, disease, entities, edges, status, created_at
from public.proposals
where status <> 'rejected';
grant select on public.proposals_public to anon, authenticated;

create or replace function public.submit_proposal(
  p_kind text, p_title text, p_body text, p_persona text, p_disease text,
  p_entities text[], p_edges text[], p_contact text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_body  text := btrim(coalesce(p_body, ''));
begin
  if p_kind is null or p_kind not in ('hypothesis', 'collaboration', 'evidence') then
    raise exception 'p_kind must be hypothesis | collaboration | evidence' using errcode = '22023';
  end if;
  if char_length(v_title) not between 3 and 200 then raise exception 'title must be 3-200 characters' using errcode = '22023'; end if;
  if char_length(v_body) not between 1 and 4000 then raise exception 'body must be 1-4000 characters' using errcode = '22023'; end if;
  if char_length(coalesce(p_persona, '')) > 40 or char_length(coalesce(p_disease, '')) > 120 or char_length(coalesce(p_contact, '')) > 200 then
    raise exception 'persona/disease/contact too long' using errcode = '22023';
  end if;
  if cardinality(coalesce(p_entities, '{}')) > 50 or cardinality(coalesce(p_edges, '{}')) > 100 then
    raise exception 'too many entities (max 50) or edges (max 100)' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(coalesce(p_entities, '{}') || coalesce(p_edges, '{}')) x where char_length(x) > 200) then
    raise exception 'entity/edge id too long' using errcode = '22023';
  end if;
  -- Flood guard: at most 30 drafts per minute across the whole site.
  if (select count(*) from public.proposals where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'too many submissions, try again in a minute' using errcode = '54000';
  end if;

  insert into public.proposals (kind, title, body, persona, disease, entities, edges, contact)
  values (p_kind, v_title, v_body, nullif(btrim(p_persona), ''), nullif(btrim(p_disease), ''),
          coalesce(p_entities, '{}'), coalesce(p_edges, '{}'), nullif(btrim(p_contact), ''))
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.submit_proposal(text, text, text, text, text, text[], text[], text) from public;
grant execute on function public.submit_proposal(text, text, text, text, text, text[], text[], text) to anon, authenticated, service_role;

-- 5) Extractions -------------------------------------------------------------
create table if not exists public.extractions (
  id         uuid primary key default gen_random_uuid(),
  pmid       text not null check (pmid ~ '^[0-9]{1,9}$'),
  model      text not null check (char_length(model) between 1 and 80),
  payload    jsonb not null check (jsonb_typeof(payload) = 'object'),
  status     text not null default 'needs_review' check (status in ('needs_review', 'reviewed', 'rejected')),
  created_at timestamptz not null default now()
);
create index if not exists extractions_pmid on public.extractions (pmid, created_at desc);
alter table public.extractions enable row level security;
revoke all on public.extractions from anon, authenticated;
grant select on public.extractions to anon, authenticated;
drop policy if exists "extractions public read" on public.extractions;
create policy "extractions public read" on public.extractions for select to anon, authenticated using (status <> 'rejected');

create or replace function public.save_extraction(p_pmid text, p_model text, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_pmid text := regexp_replace(btrim(coalesce(p_pmid, '')), '^(PMID:?\s*)', '', 'i');
begin
  if v_pmid !~ '^[0-9]{1,9}$' then raise exception 'p_pmid must be a PubMed id' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_model, ''))) not between 1 and 80 then raise exception 'p_model must be 1-80 characters' using errcode = '22023'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'p_payload must be a JSON object' using errcode = '22023'; end if;
  if octet_length(p_payload::text) > 100000 then raise exception 'p_payload too large (max 100 kB)' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(p_payload -> 'claims', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_payload -> 'claims', '[]'::jsonb)) > 100 then
    raise exception 'p_payload.claims must be an array of at most 100 claims' using errcode = '22023';
  end if;
  if (select count(*) from public.extractions where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'too many extractions, try again in a minute' using errcode = '54000';
  end if;

  insert into public.extractions (pmid, model, payload) values (v_pmid, btrim(p_model), p_payload)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.save_extraction(text, text, jsonb) from public;
grant execute on function public.save_extraction(text, text, jsonb) to anon, authenticated, service_role;

-- 6) Loader support ----------------------------------------------------------
-- Change marker: the loader (src/lib/atlas/source.ts) reads tables with paginated PostgREST requests;
-- this lets it skip a full reload when nothing changed.
create or replace function public.atlas_version()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'entities',    (select count(*) from public.entities),
    'edges',       (select count(*) from public.edges where status = 'active'),
    'evidence',    (select count(*) from public.evidence),
    'aliases',     (select count(*) from public.entity_aliases),
    'proposals',   (select count(*) from public.proposals where status <> 'rejected'),
    'extractions', (select count(*) from public.extractions where status <> 'rejected'),
    'updated_at',  greatest((select max(updated_at) from public.edges), (select max(updated_at) from public.entities), (select max(retrieved_at) from public.evidence))
  );
$$;
grant execute on function public.atlas_version() to anon, authenticated, service_role;

create index if not exists edges_status on public.edges (status);
