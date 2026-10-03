-- 0007_advisor_fixes.sql
-- Supabase advisors: cover foreign keys with indexes; the platform's RLS event-trigger function
-- must not be callable through /rest/v1/rpc (event triggers fire regardless of EXECUTE grants).
create index if not exists ingest_runs_source on public.ingest_runs (source_id);
create index if not exists ingest_jobs_source on public.ingest_jobs (source_id);

do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
