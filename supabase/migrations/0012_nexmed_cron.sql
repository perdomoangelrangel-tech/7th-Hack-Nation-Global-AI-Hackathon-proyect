-- 0012_nexmed_cron.sql
-- Daily refresh for the 21-disease slice (staggered 4 min apart from 02:00 UTC) + weekly HPO enrichment.
-- cron.schedule() with an existing job name updates that job (idempotent). Requires 0011 (pathway/investigator types).

select cron.schedule('ingest-dravet', '0 2 * * *', $$select private.invoke_ingest('ORPHA:33069', 'all')$$);
select cron.schedule('ingest-rett', '4 2 * * *', $$select private.invoke_ingest('ORPHA:778', 'all')$$);
select cron.schedule('ingest-cdkl5', '8 2 * * *', $$select private.invoke_ingest('ORPHA:505652', 'all')$$);
select cron.schedule('ingest-angelman', '12 2 * * *', $$select private.invoke_ingest('ORPHA:72', 'all')$$);
select cron.schedule('ingest-cln2', '16 2 * * *', $$select private.invoke_ingest('ORPHA:228349', 'all')$$);
select cron.schedule('ingest-kcnq2-dee', '20 2 * * *', $$select private.invoke_ingest('ORPHA:439218', 'all')$$);
select cron.schedule('ingest-kcnt1-emfs', '24 2 * * *', $$select private.invoke_ingest('ORPHA:293181', 'all')$$);
select cron.schedule('ingest-stxbp1-dee', '28 2 * * *', $$select private.invoke_ingest('ORPHA:599373', 'all')$$);
select cron.schedule('ingest-syngap1-dee', '32 2 * * *', $$select private.invoke_ingest('ORPHA:544254', 'all')$$);
select cron.schedule('ingest-foxg1', '36 2 * * *', $$select private.invoke_ingest('ORPHA:561854', 'all')$$);
select cron.schedule('ingest-cln3', '40 2 * * *', $$select private.invoke_ingest('ORPHA:228346', 'all')$$);
select cron.schedule('ingest-cln8', '44 2 * * *', $$select private.invoke_ingest('ORPHA:228354', 'all')$$);
select cron.schedule('ingest-pompe', '48 2 * * *', $$select private.invoke_ingest('ORPHA:365', 'all')$$);
select cron.schedule('ingest-fabry', '52 2 * * *', $$select private.invoke_ingest('ORPHA:324', 'all')$$);
select cron.schedule('ingest-gaucher', '56 2 * * *', $$select private.invoke_ingest('ORPHA:355', 'all')$$);
select cron.schedule('ingest-npc', '0 3 * * *', $$select private.invoke_ingest('ORPHA:646', 'all')$$);
select cron.schedule('ingest-mps1', '4 3 * * *', $$select private.invoke_ingest('ORPHA:579', 'all')$$);
select cron.schedule('ingest-krabbe', '8 3 * * *', $$select private.invoke_ingest('ORPHA:487', 'all')$$);
select cron.schedule('ingest-mld', '12 3 * * *', $$select private.invoke_ingest('ORPHA:512', 'all')$$);
select cron.schedule('ingest-sma', '16 3 * * *', $$select private.invoke_ingest('ORPHA:70', 'all')$$);
select cron.schedule('ingest-duchenne', '20 3 * * *', $$select private.invoke_ingest('ORPHA:98896', 'all')$$);
select cron.schedule('ingest-hpo', '0 4 * * 0', $$select private.invoke_ingest(null, 'hpo')$$);
