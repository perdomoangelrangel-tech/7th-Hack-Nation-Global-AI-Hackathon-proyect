-- 0003_community_and_ingest_runs.sql
-- Researcher community (B2B portal) + ingest run log (public transparency).
create table if not exists research_community (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  disease_id uuid not null references entities(id) on delete cascade,
  name text not null,
  affiliation text,
  country text,
  role text not null default 'researcher' check (role in ('researcher','clinician','lab','foundation','pharma')),
  focus text,
  orcid text,
  public_profile boolean not null default true,
  open_to_contact boolean not null default false,
  source text not null default 'self_registered',  -- self_registered | pubmed_author | seed
  source_ref text,                                  -- PMID when derived from literature
  created_at timestamptz not null default now()
);
create index if not exists research_community_disease on research_community (disease_id);
create index if not exists research_community_user on research_community (user_id);
alter table research_community enable row level security;
create policy "public community read" on research_community for select using (public_profile = true);
create policy "join community" on research_community for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "edit own entry" on research_community for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists ingest_runs (
  id bigint generated always as identity primary key,
  disease text not null,
  source_id text references sources(id),
  status text not null default 'running' check (status in ('running','done','failed')),
  entities_upserted int not null default 0,
  edges_upserted int not null default 0,
  evidence_upserted int not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists ingest_runs_started on ingest_runs (started_at desc);
alter table ingest_runs enable row level security;
create policy "public run log" on ingest_runs for select using (true);

-- Graph stats for the landing page counters (security invoker; reads public tables).
create or replace view graph_stats with (security_invoker = true) as
select
  (select count(*) from entities) as entities,
  (select count(*) from edges where status = 'active') as edges,
  (select count(*) from evidence) as evidence,
  (select count(*) from entities where type = 'disease') as diseases,
  (select count(*) from entities where type = 'trial') as trials,
  (select count(*) from entities where type = 'treatment') as treatments,
  (select count(distinct source_id) from evidence) as sources_used,
  (select max(retrieved_at) from evidence) as last_retrieved_at;

create extension if not exists pg_net;
create extension if not exists pg_cron;
