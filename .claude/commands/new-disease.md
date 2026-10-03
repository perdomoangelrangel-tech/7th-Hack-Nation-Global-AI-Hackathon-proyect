---
description: Add a rare disease by ORPHA code. It appends to the seed, redeploys the `ingest` Edge Function, triggers it via pg_net and shows graph counts (data lane)
argument-hint: "ORPHA:<code> [english name]"
allowed-tools: Read, Edit, Bash(node scripts/ingest/build-edge-seed.mjs), Bash(supabase --version), Bash(supabase functions deploy *), WebFetch(domain:api.orphadata.com), WebFetch(domain:api-v3.monarchinitiative.org), mcp__supabase
---

Target: `$ARGUMENTS`. Delegate to the **data-engineer** subagent if the session isn't the data lane.

1. **Validate:** `$0` must match `^ORPHA:\d+$`. Otherwise stop.
2. **Exists?** If `$0` is already in `supabase/seed/diseases.json`, skip to step 6 (re-ingest).
3. **Resolve fields from sources only. Never guess.**
   - Orphadata: `https://api.orphadata.com/rd-cross-referencing/orphacodes/<n>?lang=en` (name), `…?lang=es` (`name_es`), `https://api.orphadata.com/rd-associated-genes/orphacodes/<n>?lang=en` (gene symbols + HGNC IDs).
   - MONDO: `https://api-v3.monarchinitiative.org/v3/api/search?q=<name>&category=biolink:Disease` and keep only the hit whose xrefs include `Orphanet:<n>`. `efo` = MONDO with `_` (Open Targets format).
   - If a source is unreachable or ambiguous, **ask the user** for that field and show what was resolved.
4. **Entry:** same keys and order as the existing entries: `slug` (short kebab), `orpha`, `mondo`, `efo`, `name`, `name_es`, `genes`, `search_terms`, `hgnc`. Show the JSON, get a yes, then append it with 2-space formatting.
5. **Bundle + deploy:** `node scripts/ingest/build-edge-seed.mjs` (regenerates `supabase/functions/ingest/seed.ts`). Then deploy `ingest`: use `supabase functions deploy ingest --project-ref zuqwmvshkhniqebtxlks` if the CLI is present, else Supabase MCP `deploy_edge_function` with every file under `supabase/functions/ingest/`, keeping the current `verify_jwt` (check with `get_edge_function`).
6. **Trigger:** `select private.invoke_ingest('$0') as request_id;`
   If that helper is missing, mirror the `net.http_post` call from the latest migration.
7. **Poll** every ~20 s, for up to 3 min:
   ```sql
   select status_code, timed_out, left(error_msg,200) err, left(content::text,300) body from net._http_response where id = <request_id>;
   select source_id, status, entities_upserted, edges_upserted, evidence_upserted, left(error,150) error
   from ingest_runs where disease in ('$0', '<slug>') order by started_at desc limit 12;
   ```
8. **Counts:**
   ```sql
   with d as (select id from entities where type = 'disease' and canonical_id = '$0')
   select ee.relation, count(*) as edges, sum(jsonb_array_length(ee.evidence)) as evidence
   from edge_evidence ee join d on ee.from_id = d.id or ee.to_id = d.id group by 1 order by 1;
   select * from graph_stats;
   ```
9. **Schedule:** if per-disease cron jobs exist (`select jobname, schedule, command from cron.job where jobname ilike '%ingest%'`), add one for the new slug by copying the existing pattern (`cron.schedule` upserts by name).

Report: a resolved-fields table with the source URL per field, a relation | edges | evidence table, failed sources, and a reminder to commit `diseases.json` + `seed.ts` on `feat/data`. **No DROP/TRUNCATE/DELETE**: the MCP blocks ~180 s waiting for a human.
