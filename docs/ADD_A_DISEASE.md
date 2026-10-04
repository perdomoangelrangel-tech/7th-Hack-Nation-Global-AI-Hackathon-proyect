# Add a disease to Nedamex

Adding a disease is data, not code: put its ORPHA code in the seed, verify it, run the ingest, refresh the snapshot. Nothing in the app changes — the disease shows up in search, the graph, clusters, journeys and `/api/atlas/sources` on the next load.

**Rule:** never type an identifier by hand. Every ORPHA, MONDO, HGNC, OMIM id and every patient-group URL is checked against its authority before it enters the seed.

## 1. Add and verify the seed entry

1. Add a candidate to `CANDIDATES` in `scripts/resolve-seed.ts`: `{ slug, orpha, gene, cluster }`, where `orpha` is the ORPHA code and `gene` is the HGNC symbol of the disease-causing gene (`cluster` is only a note on the expected mechanism; the app computes its own clusters).
2. Run:

   ```bash
   npx tsx scripts/resolve-seed.ts --dry   # report only
   npx tsx scripts/resolve-seed.ts         # writes supabase/seed/diseases.json
   ```

   For each candidate it checks: Orphadata preferred term; the gene is *disease-causing* for that ORPHA code (Orphadata, else Monarch causal-gene associations); the HGNC id matches genenames.org; the MONDO id comes from Monarch's Orphanet mapping / Orphanet cross-references and exists in Open Targets (flagged `opentargets_indexed: false` otherwise); OMIM is Orphanet's exact mapping; the ClinVar trait name comes from MedGen. A candidate that fails any check is **rejected and reported**, never written.
3. Optional: a short display name in `SHORT` (same script) — a label, not an identifier.
4. Classification groups (search by class, e.g. "lysosomal storage disease"):

   ```bash
   npx tsx scripts/classify-seed.ts        # supabase/seed/groups.json (Orphadata classification + MONDO names)
   npx tsx scripts/build-group-aliases.ts  # regenerates supabase/migrations/0013_orphanet_group_aliases.sql
   ```

## 2. Patient groups (optional, recommended)

Add the organization to `supabase/seed/organizations.json` (`name`, `country`, `url`, `kind`, `diseases: ["ORPHA:…"]`) **only** if its official site answers HTTP 200 and the page names the disease; record how it was checked in `verified`. If only a sub-page names the disease, put that page in `disease_urls: { "ORPHA:…": "<url>" }` — it becomes the evidence link.

## 3. Ingest into Supabase (live graph)

```bash
npx tsx scripts/build-edge-seed.ts       # regenerates supabase/functions/ingest/seed.ts from supabase/seed/*.json
```

Deploy the Edge Function `ingest` (Supabase dashboard / CLI `supabase functions deploy ingest --no-verify-jwt`, or the Supabase MCP `deploy_edge_function`; the function authenticates with `x-ingest-key`). Then run the new disease from SQL with `pg_net`:

```sql
select private.invoke_ingest('ORPHA:<code>', 'all');      -- returns a pg_net request id
select private.invoke_ingest('ORPHA:<code>', 'reactome'); -- or one step: orphanet | opentargets | ctgov | pubmed
                                                           -- | community | clinvar | variants | reactome | reporter | orgs
select private.invoke_ingest(null, 'hpo');                 -- enrich new phenotypes (definitions, is_a parents)
```

or the manual GitHub workflow **Ingest backfill** (`.github/workflows/ingest.yml`, secret `INGEST_KEY`). Watch progress:

```sql
select source_id, status, entities_upserted, edges_upserted, evidence_upserted, error
from ingest_runs where disease = 'ORPHA:<code>' order by id desc;
```

A full run is 11 steps (~1–2 min). Run diseases a few at a time: NCBI allows ~3 requests/s without `NCBI_API_KEY`. To keep it refreshed daily, add a `cron.schedule('ingest-<slug>', …)` line like the ones in `supabase/migrations/0012_nexmed_cron.sql` in a new migration.

Then the integrity check (every `expect = 0` row must be 0): `.claude/qa/integrity.sql`.

## 4. Refresh the snapshot

```bash
npm run snapshot -- --check   # fetch the live graph + analytics, print counts, write nothing
npm run snapshot              # write data/atlas.json (must stay < 8 MB)
```

`data/atlas.json` is what the app serves when Supabase is unreachable, and while the live graph is poorer than the file (it must contain every bundled disease and ≥ 80% of its observed edges — `src/lib/atlas/source.ts`). Either way the live overlays (OpenAI extractions as `extracted` edges, community drafts) are applied on top.

If you also maintain the bundled file with the local pipeline (`npm run ingest`, `npm run analyze`, `npx tsx scripts/apply-groups.ts`, `npx tsx scripts/gene-aliases.ts`), run them for the new disease too so file and live stay comparable.

## 5. Check it in the app

```bash
npm run dev
curl -s localhost:3000/api/atlas/stats
curl -s "localhost:3000/api/atlas/search?q=<disease name>"
curl -s localhost:3000/api/atlas/sources
```

Open `/atlas?d=disease:ORPHA:<code>`: the disease appears with its cluster, neighbors (inferred, dashed), patient groups, studies and gaps. A disease with few phenotypes or no shared pathway may land in its own cluster ("no close neighbor") — that is the honest answer, not a bug.
