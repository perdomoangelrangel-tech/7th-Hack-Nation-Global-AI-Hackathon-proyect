-- 0001_graph.sql
-- Grafo de conocimiento con evidencia. Postgres como grafo de propiedades.
-- Regla: una arista activa sin evidencia no existe (trigger al final).

create extension if not exists "pgcrypto";
create extension if not exists vector;
create extension if not exists pg_trgm;

-- -------------------------------------------------------------------
-- Fuentes
-- -------------------------------------------------------------------
create table if not exists sources (
  id              text primary key,                 -- orphanet, hpo, monarch, clinvar, ctgov, opentargets, pubmed, patient_orgs
  name            text not null,
  license         text not null,
  base_url        text not null,
  last_synced_at  timestamptz
);

-- -------------------------------------------------------------------
-- Entidades (nodos)
-- -------------------------------------------------------------------
create type entity_type as enum (
  'disease', 'gene', 'phenotype', 'variant', 'trial', 'study', 'treatment', 'organization'
);

create table if not exists entities (
  id            uuid primary key default gen_random_uuid(),
  type          entity_type not null,
  canonical_id  text not null,                      -- ORPHA:33069, HGNC:10585, HP:0001250, NCT0..., PMID:..., CHEMBL...
  name          text not null,
  props         jsonb not null default '{}'::jsonb, -- prevalencia, definición, fase, país, etc.
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (type, canonical_id)
);
create index if not exists entities_name_trgm on entities using gin (name gin_trgm_ops);
create index if not exists entities_props_gin on entities using gin (props);

create table if not exists entity_aliases (
  entity_id uuid not null references entities(id) on delete cascade,
  alias     text not null,
  lang      text not null default 'en',
  primary key (entity_id, alias, lang)
);
create index if not exists entity_aliases_trgm on entity_aliases using gin (alias gin_trgm_ops);

-- -------------------------------------------------------------------
-- Aristas (relaciones)
-- -------------------------------------------------------------------
create type relation_type as enum (
  'causes',          -- gene -> disease
  'has_phenotype',   -- disease -> phenotype
  'has_variant',     -- gene -> variant
  'studies',         -- trial|study -> disease
  'treats',          -- treatment -> disease
  'supports',        -- organization -> disease (grupo de pacientes)
  'researches',      -- organization -> disease (comunidad de investigadores)
  'is_a'             -- phenotype -> phenotype (jerarquía HPO)
);

create type edge_status as enum ('active', 'retracted', 'pending');

create table if not exists edges (
  id               uuid primary key default gen_random_uuid(),
  from_id          uuid not null references entities(id) on delete cascade,
  to_id            uuid not null references entities(id) on delete cascade,
  relation         relation_type not null,
  confidence       numeric(3,2) not null default 0.50 check (confidence between 0 and 1),
  confidence_basis text not null default 'source_default',  -- hpo_frequency | clinical_phase | clinvar_significance | source_default
  status           edge_status not null default 'pending',  -- pasa a active cuando tiene evidencia
  props            jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (from_id, to_id, relation)
);
create index if not exists edges_from on edges (from_id, relation);
create index if not exists edges_to   on edges (to_id, relation);

-- -------------------------------------------------------------------
-- Evidencia (cada arista tiene >= 1)
-- -------------------------------------------------------------------
create table if not exists evidence (
  id            uuid primary key default gen_random_uuid(),
  edge_id       uuid not null references edges(id) on delete cascade,
  source_id     text not null references sources(id),
  external_id   text not null,          -- PMID, NCT, ORPHA, HP, CHEMBL
  url           text not null,
  quote         text,                   -- cita literal corta cuando existe
  published_on  date,
  retrieved_at  timestamptz not null default now(),
  unique (edge_id, source_id, external_id)
);
create index if not exists evidence_edge on evidence (edge_id);
create index if not exists evidence_source on evidence (source_id, external_id);

-- Trigger: al insertar evidencia la arista pasa a active.
create or replace function activate_edge_on_evidence() returns trigger
language plpgsql as $$
begin
  update edges set status = 'active', updated_at = now()
   where id = new.edge_id and status = 'pending';
  return new;
end $$;
drop trigger if exists trg_activate_edge on evidence;
create trigger trg_activate_edge after insert on evidence
  for each row execute function activate_edge_on_evidence();

-- Trigger: nadie puede poner una arista en active sin evidencia.
create or replace function guard_edge_active() returns trigger
language plpgsql as $$
begin
  if new.status = 'active' and not exists (select 1 from evidence e where e.edge_id = new.id) then
    raise exception 'edge % cannot be active without evidence', new.id;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_edge_active on edges;
create trigger trg_guard_edge_active before update of status on edges
  for each row execute function guard_edge_active();

-- -------------------------------------------------------------------
-- Embeddings (búsqueda semántica sobre nombres + definiciones)
-- -------------------------------------------------------------------
create table if not exists embeddings (
  entity_id  uuid primary key references entities(id) on delete cascade,
  embedding  vector(1536) not null,
  model      text not null,
  updated_at timestamptz not null default now()
);
create index if not exists embeddings_hnsw on embeddings using hnsw (embedding vector_cosine_ops);

-- -------------------------------------------------------------------
-- Cola de ingesta (escala: FOR UPDATE SKIP LOCKED)
-- -------------------------------------------------------------------
create type job_status as enum ('pending', 'processing', 'done', 'failed');

create table if not exists ingest_jobs (
  id          bigint generated always as identity primary key,
  source_id   text not null references sources(id),
  target      text not null,                    -- ORPHA:33069, SCN1A, etc.
  status      job_status not null default 'pending',
  attempts    int not null default 0,
  error       text,
  created_at  timestamptz not null default now(),
  started_at  timestamptz,
  finished_at timestamptz
);
create index if not exists ingest_jobs_pending on ingest_jobs (created_at) where status = 'pending';

-- -------------------------------------------------------------------
-- Vista de lectura para las herramientas del agente: arista + evidencia
-- -------------------------------------------------------------------
create or replace view edge_evidence as
select
  e.id            as edge_id,
  e.relation,
  e.confidence,
  e.confidence_basis,
  e.props          as edge_props,
  f.id as from_id, f.type as from_type, f.canonical_id as from_canonical_id, f.name as from_name, f.props as from_props,
  t.id as to_id,   t.type as to_type,   t.canonical_id as to_canonical_id,   t.name as to_name,   t.props as to_props,
  coalesce(
    jsonb_agg(jsonb_build_object(
      'id', ev.id, 'source', ev.source_id, 'external_id', ev.external_id,
      'url', ev.url, 'quote', ev.quote, 'published_on', ev.published_on, 'retrieved_at', ev.retrieved_at
    ) order by ev.published_on desc nulls last) filter (where ev.id is not null),
    '[]'::jsonb
  ) as evidence
from edges e
join entities f on f.id = e.from_id
join entities t on t.id = e.to_id
left join evidence ev on ev.edge_id = e.id
where e.status = 'active'
group by e.id, f.id, t.id;

-- -------------------------------------------------------------------
-- Huecos de investigación: relaciones con poca evidencia
-- -------------------------------------------------------------------
create or replace view research_gaps as
select edge_id, relation, from_name, to_name, confidence, jsonb_array_length(evidence) as evidence_count
from edge_evidence
where jsonb_array_length(evidence) <= 1 or confidence < 0.4;

-- -------------------------------------------------------------------
-- Seguridad: el grafo es público de lectura, escritura solo service role
-- -------------------------------------------------------------------
alter table sources        enable row level security;
alter table entities       enable row level security;
alter table entity_aliases enable row level security;
alter table edges          enable row level security;
alter table evidence       enable row level security;
alter table embeddings     enable row level security;
alter table ingest_jobs    enable row level security;

create policy "graph public read" on sources        for select using (true);
create policy "graph public read" on entities       for select using (true);
create policy "graph public read" on entity_aliases for select using (true);
create policy "graph public read" on edges          for select using (true);
create policy "graph public read" on evidence       for select using (true);
create policy "graph public read" on embeddings     for select using (true);
-- ingest_jobs: sin políticas para anon/authenticated => solo service role.

-- Fuentes iniciales
insert into sources (id, name, license, base_url) values
  ('orphanet',     'Orphanet / Orphadata',          'CC BY 4.0',        'https://api.orphadata.com'),
  ('hpo',          'Human Phenotype Ontology',      'HPO license',      'https://ontology.jax.org/api/hp'),
  ('monarch',      'Monarch Initiative',            'CC BY 4.0',        'https://api-v3.monarchinitiative.org/v3/api'),
  ('clinvar',      'ClinVar (NCBI)',                'Public domain',    'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'),
  ('ctgov',        'ClinicalTrials.gov',            'Public domain',    'https://clinicaltrials.gov/api/v2'),
  ('opentargets',  'Open Targets Platform',         'CC0',              'https://api.platform.opentargets.org/api/v4/graphql'),
  ('pubmed',       'PubMed (NCBI E-utilities)',     'Public domain',    'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'),
  ('patient_orgs', 'Organizaciones de pacientes (curado)', 'Public data', 'seed')
on conflict (id) do nothing;
