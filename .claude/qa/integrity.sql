-- Nedamex graph integrity. Run with the Supabase MCP `execute_sql`, which is read-only apart from the guard probe below.
-- Expected: every row with expect = 0 has value 0.
select 'orphan_active_edges' as check, count(*) as value, 0 as expect
  from edges e where e.status = 'active' and not exists (select 1 from evidence v where v.edge_id = e.id)
union all select 'evidence_missing_url', count(*), 0 from evidence where coalesce(url, '') = ''
union all select 'evidence_missing_external_id', count(*), 0 from evidence where coalesce(external_id, '') = ''
union all select 'public_tables_without_rls', count(*), 0 from pg_tables where schemaname = 'public' and not rowsecurity
union all select 'anon_can_read_app_secrets', (has_table_privilege('anon', 'public.app_secrets', 'select'))::int, 0
union all select 'pending_edges (info)', count(*), null from edges where status = 'pending'
union all select 'diseases (info)', count(*), null from entities where type = 'disease'
union all select 'active_edges (info)', count(*), null from edges where status = 'active'
union all select 'evidence (info)', count(*), null from evidence;

-- Guard probe: activating an edge without evidence must raise. Everything is rolled back (no residue).
do $$
declare a uuid; b uuid; eid uuid;
begin
  begin
    insert into entities (type, canonical_id, name) values ('disease', 'QA:probe-a', 'qa probe a') returning id into a;
    insert into entities (type, canonical_id, name) values ('gene', 'QA:probe-b', 'qa probe b') returning id into b;
    insert into edges (from_id, to_id, relation) values (b, a, 'causes') returning id into eid;
    update edges set status = 'active' where id = eid;
    raise exception 'GUARD_MISSING';
  exception when others then
    if sqlerrm = 'GUARD_MISSING' then raise exception 'FAIL: edge became active without evidence'; end if;
    raise notice 'guard ok: %', sqlerrm;
  end;
end $$;
