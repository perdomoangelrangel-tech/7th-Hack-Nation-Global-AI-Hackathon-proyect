-- 0010_fda_source.sql
-- Curated regulatory approvals (supabase/seed/approvals.json) cite official FDA pages.
insert into public.sources (id, name, license, base_url)
values ('fda', 'U.S. Food and Drug Administration', 'Public domain', 'https://www.fda.gov')
on conflict (id) do nothing;
