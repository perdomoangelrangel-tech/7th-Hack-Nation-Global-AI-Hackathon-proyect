-- 0006_ingest_cron.sql
-- Daily refresh per disease (staggered 5 min apart, UTC) + weekly HPO enrichment.
-- cron.schedule() with an existing job name updates that job, so this file is idempotent.
select cron.schedule('ingest-dravet',   '0 3 * * *',  $$select private.invoke_ingest('ORPHA:33069', 'all')$$);
select cron.schedule('ingest-rett',     '5 3 * * *',  $$select private.invoke_ingest('ORPHA:778', 'all')$$);
select cron.schedule('ingest-cdkl5',    '10 3 * * *', $$select private.invoke_ingest('ORPHA:505652', 'all')$$);
select cron.schedule('ingest-angelman', '15 3 * * *', $$select private.invoke_ingest('ORPHA:72', 'all')$$);
select cron.schedule('ingest-cln2',     '20 3 * * *', $$select private.invoke_ingest('ORPHA:228349', 'all')$$);
select cron.schedule('ingest-hpo',      '0 4 * * 0',  $$select private.invoke_ingest(null, 'hpo')$$);
