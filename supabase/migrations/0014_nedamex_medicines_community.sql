-- 0014 · Nedamex · Medicines bank + Community (applied by head-brain via Supabase MCP 04-Oct ~00:00 CDMX)
-- Data lane: commit this file as supabase/migrations/0014_nedamex_medicines_community.sql (do not re-apply).

-- 1) Medicines bank: one row per treatment that has a `treats` edge to a disease in the graph.
--    approved_for_listed_disease = Open Targets/ChEMBL indication stage APPROVAL for at least one disease here.
--    links (props.links) is filled by the data lane from regulators: fda_label, dailymed, drugs_fda, ema_epar.
create or replace view public.medicines_public with (security_invoker = true) as
select
  t.id,
  'treatment:' || t.canonical_id as entity_id,
  t.canonical_id,
  t.name,
  t.props->>'chembl_id'                              as chembl_id,
  t.props->>'drug_type'                              as drug_type,
  t.props->>'mechanism'                              as mechanism,
  coalesce(t.props->'targets', '[]'::jsonb)          as targets,
  coalesce(t.props->'trade_names', '[]'::jsonb)      as trade_names,
  coalesce((t.props->>'approved')::boolean, false)   as approved_anywhere,
  t.props->>'max_stage'                              as max_stage,
  t.props->>'opentargets_url'                        as opentargets_url,
  coalesce(t.props->'links', '{}'::jsonb)            as links,
  bool_or(ed.props->>'stage' = 'APPROVAL')           as approved_for_listed_disease,
  jsonb_agg(distinct jsonb_build_object(
    'disease_id', 'disease:' || d.canonical_id,
    'disease',    d.name,
    'stage',      ed.props->>'stage',
    'status',     ed.props->>'status',
    'nct_ids',    coalesce(ed.props->'nct_ids', '[]'::jsonb),
    'edge_id',    ed.id,
    'sources',    (select coalesce(jsonb_agg(jsonb_build_object('source', ev.source_id, 'url', ev.url, 'external_id', ev.external_id)), '[]'::jsonb)
                   from public.evidence ev where ev.edge_id = ed.id)
  )) as indications
from public.entities t
join public.edges ed   on ed.from_id = t.id and ed.relation = 'treats'
join public.entities d on d.id = ed.to_id and d.type = 'disease'
where t.type = 'treatment'
group by t.id;

-- 2) Community: researchers already in the graph (public NIH RePORTER grant records), no contact data.
create or replace view public.community_profiles_public with (security_invoker = true) as
select
  i.id,
  'investigator:' || i.canonical_id as entity_id,
  i.canonical_id,
  i.name,
  i.props->>'institution' as institution,
  i.props->>'location'    as location,
  i.props->>'identity'    as identity_source,
  count(distinct ed.to_id) as diseases_count,
  jsonb_agg(distinct jsonb_build_object('disease_id', 'disease:' || d.canonical_id, 'disease', d.name)) as diseases,
  jsonb_agg(distinct jsonb_build_object(
    'title',       ed.props->>'title',
    'project',     ed.props->>'project',
    'fiscal_year', ed.props->>'fiscal_year',
    'institute',   ed.props->>'institute',
    'url',         ev.url)) as projects
from public.entities i
join public.edges ed   on ed.from_id = i.id and ed.relation = 'researches'
join public.entities d on d.id = ed.to_id and d.type = 'disease'
left join public.evidence ev on ev.edge_id = ed.id
where i.type = 'investigator'
group by i.id;

-- 3) Self-submitted clinician/researcher profiles ("Create your profile"). Never evidence; shown as "self-submitted · not verified".
create table if not exists public.profile_submissions (
  id           uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 2 and 120),
  role         text not null check (role in ('clinician', 'researcher', 'genetic_counselor', 'other')),
  institution  text check (institution is null or char_length(institution) <= 200),
  diseases     text[] not null default '{}',
  focus        text check (focus is null or char_length(focus) <= 1000),
  orcid        text check (orcid is null or orcid ~ '^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$'),
  link         text check (link is null or link ~ '^https://'),
  status       text not null default 'unverified' check (status in ('unverified', 'verified', 'rejected')),
  created_at   timestamptz not null default now()
);
alter table public.profile_submissions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profile_submissions' and policyname = 'profile_submissions_read') then
    create policy profile_submissions_read on public.profile_submissions for select to anon, authenticated using (status <> 'rejected');
  end if;
end $$;

create or replace function public.submit_profile(
  p_display_name text, p_role text, p_institution text, p_diseases text[],
  p_focus text, p_orcid text, p_link text, p_consent boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_consent is not true then raise exception 'consent required'; end if;
  insert into public.profile_submissions (display_name, role, institution, diseases, focus, orcid, link)
  values (trim(p_display_name), p_role, nullif(trim(p_institution), ''), coalesce(p_diseases, '{}'),
          nullif(trim(p_focus), ''), nullif(trim(p_orcid), ''), nullif(trim(p_link), ''))
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.submit_profile(text, text, text, text[], text, text, text, boolean) from public;
grant execute on function public.submit_profile(text, text, text, text[], text, text, text, boolean) to anon, authenticated;
grant select on public.profile_submissions to anon, authenticated;
grant select on public.medicines_public, public.community_profiles_public to anon, authenticated;
