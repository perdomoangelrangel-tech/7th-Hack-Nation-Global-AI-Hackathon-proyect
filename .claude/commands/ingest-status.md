---
description: Ingestion health covering latest ingest_runs, graph_stats, evidence per source, pg_cron jobs and recent pg_net responses
allowed-tools: mcp__supabase__execute_sql, mcp__supabase__list_*, mcp__supabase__get_*
---

Run these read-only queries with the Supabase MCP `execute_sql` (project `zuqwmvshkhniqebtxlks`):

```sql
select * from graph_stats;

select disease, source_id, status, entities_upserted as ent, edges_upserted as edges, evidence_upserted as ev,
       left(error, 120) as error, started_at, finished_at - started_at as took
from ingest_runs order by started_at desc limit 25;

select source_id, count(*) as evidence, max(retrieved_at) as last_retrieved from evidence group by 1 order by 1;

select jobname, schedule, active from cron.job order by jobname;

select j.jobname, d.status, d.start_time, left(d.return_message, 120) as msg
from cron.job_run_details d join cron.job j using (jobid) order by d.start_time desc limit 10;

select id, status_code, timed_out, left(error_msg, 120) as err, created
from net._http_response order by created desc limit 10;
```

If a query fails because an object doesn't exist yet, note it and continue.

**Output:** up to 8 lines of summary, then the tables. Flag in bold:
- runs with `failed`, or `running` for more than 10 min
- sources with 0 evidence
- cron jobs inactive or with no run in 25 h
- pg_net `status_code` ≠ 2xx or `timed_out`
