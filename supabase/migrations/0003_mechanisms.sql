-- 0003_mechanisms.sql
-- Alinea el esquema de Postgres con el snapshot (data/atlas.json): capa de mecanismo, investigadores,
-- aristas inferidas y extraídas. Así `npm run ingest -- --target=supabase` acepta todo lo que produce la ingesta.

alter type entity_type add value if not exists 'pathway';
alter type entity_type add value if not exists 'investigator';
alter type relation_type add value if not exists 'participates_in';   -- gene -> pathway (Reactome)
alter type relation_type add value if not exists 'similar_to';        -- disease <-> disease (INFERIDA)

-- observed: lo afirma una fuente · inferred: lo calcula el análisis · extracted: lo extrajo un LLM de un texto citado
do $$ begin
  create type edge_kind as enum ('observed', 'inferred', 'extracted');
exception when duplicate_object then null; end $$;
alter table edges add column if not exists kind edge_kind not null default 'observed';

insert into sources (id, name, license, base_url) values
  ('reactome',          'Reactome (vía Open Targets)',                 'CC BY 4.0',          'https://reactome.org'),
  ('nih_reporter',      'NIH RePORTER',                                'Public domain',      'https://api.reporter.nih.gov'),
  ('atlas_analysis',    'Análisis del atlas (inferido)',               'MIT',                'scripts/analyze.ts'),
  ('openai_extraction', 'Extracción con OpenAI sobre abstracts citados','Derivado de PubMed', 'scripts/extract.ts')
on conflict (id) do nothing;
