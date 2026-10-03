# Data sources

Every source is open, has a public API, and has a license that allows reuse with attribution. Every edge in the graph has at least one `evidence` row with `source_id`, `external_id`, `url`, `published_on` (when the source gives one) and `retrieved_at`. A trigger flips an edge from `pending` to `active` on its first evidence row, and a guard blocks any `active` edge without evidence.

## Sources

| Source | What we take | Endpoint | Graph output | License |
| --- | --- | --- | --- | --- |
| **Orphanet / Orphadata** | Definition, synonyms, cross-references (OMIM, ICD-10/11, MONDO), associated genes and their association type, HPO phenotypes with frequency, prevalence, age of onset, inheritance | `api.orphadata.com/{rd-cross-referencing, rd-associated-genes, rd-phenotypes, rd-epidemiology, rd-natural_history}/orphacodes/{code}?lang=en` | disease props, `gene -causes-> disease`, `disease -has_phenotype-> phenotype` | CC BY 4.0 |
| **Monarch Initiative v3** | Fallback when Orphanet has no genes (ORPHA:72, where the genes sit on its subtypes) or fewer than 5 phenotypes (ORPHA:228349) | `api-v3.monarchinitiative.org/v3/api/association?…&category=biolink:CausalGeneToDiseaseAssociation \| DiseaseToPhenotypicFeatureAssociation` | `causes`, `has_phenotype` (props `via: "monarch"`) | CC BY 4.0 |
| **HPO (JAX)** | Definition, synonyms and parent terms for every phenotype linked to a disease | `ontology.jax.org/api/hp/terms/{HP:id}` and `/parents` | phenotype props, `phenotype -is_a-> phenotype` | HPO license |
| **Open Targets Platform** | Drug and clinical candidates per disease: max clinical stage (`APPROVAL`, `PHASE_3`, …), mechanism of action, targets, trade names, regulator and trial reports. **API change:** `knownDrugs` was removed; we use `drugAndClinicalCandidates` | `POST api.platform.opentargets.org/api/v4/graphql` | `treatment -treats-> disease` (props `origin: "opentargets"`) | CC0 |
| **ClinicalTrials.gov v2** | Active trials only (`RECRUITING`, `NOT_YET_RECRUITING`, `ACTIVE_NOT_RECRUITING`, `ENROLLING_BY_INVITATION`) with phase, sites, countries, dates, ages and interventions. A trial is kept only if its title or conditions name the disease (`trial_keywords` in the seed), because the API expands condition queries. Trials that stop being active are retracted. | `clinicaltrials.gov/api/v2/studies?query.cond=…&filter.overallStatus=…` | `trial -studies-> disease`. Drug, biologic, genetic and supplement interventions become `treats` edges, marked `investigational`. Devices are skipped. Arm labels such as "Fixed Dose Cohort" or "for the treatment of …" are stripped, and any name that reads like a title (longer than 60 characters, ends with a period, or contains words like trial, study or randomized) is rejected. | Public domain |
| **PubMed (E-utilities)** | 30 most recent reviews, trials and treatment papers per disease from the last 5 years, plus authors, affiliations and ORCID iDs | `esearch` → `esummary` → `efetch` (XML) | `study -studies-> disease`, and `research_community` rows | Public domain (metadata) |
| **ClinVar (E-utilities)** | 25 pathogenic or likely pathogenic germline variants per seed gene | `esearch db=clinvar term={GENE}[gene] AND clinsig_pathogenic[prop]…` → `esummary` | `gene -has_variant-> variant` | Public domain |
| **FDA (curated approvals)** | Regulatory approvals that Open Targets misses, each tied to an official FDA page (`supabase/seed/approvals.json`). Today there is one: ganaxolone (Ztalmy, CHEMBL1568698) for CDKL5 deficiency disorder, FDA announcement dated 2022-03-18. Only add an approval with a verified official URL. | Curated seed | `treatment -treats-> disease` with `approved_for_indication: true`, `phase: 4`, `approval{agency,date,url,indication}`. Re-applied at the end of every ingest call, so a refresh can never revert it. | Public domain |
| **Patient organizations** | Curated list: name, country, website, kind | `supabase/seed/organizations.json` | `organization -supports\|researches-> disease` (evidence url = the org's website) | Public data |

No API keys are needed. If you set `NCBI_API_KEY` as an Edge Function secret, PubMed and ClinVar go from 3 to 10 requests per second.

## How ingestion runs

The container that builds the app cannot reach these sources, so ingestion runs inside Supabase:

1. **Edge Function `ingest`** (`supabase/functions/ingest/`, `verify_jwt = false`). Every request must send the header `x-ingest-key` with the value of `app_secrets.ingest_key`. That table has RLS enabled and no policies, so only the service role can read it.
   - Body: `{ orpha?: "ORPHA:33069" | "dravet", step?: "orphanet"|"opentargets"|"ctgov"|"pubmed"|"community"|"clinvar"|"orgs"|"hpo"|"approvals"|"all", dry?: boolean }`. Every call that is not a dry run ends with the curated `approvals` step.
   - `all` runs the disease steps in dependency order: orphanet → opentargets → ctgov → pubmed → community → clinvar → orgs. That takes about 10 s per disease, well under the 125 s budget.
   - `dry: true` writes nothing and returns small raw API samples. `dry + step:"opentargets" + gql:"…"` runs any GraphQL query, which is how we debugged the Open Targets schema change.
   - All writes go through `public.ingest_upsert(entities, edges, aliases)`, which can only be executed by the service role. It is idempotent on `(type, canonical_id)` and `(from, to, relation)`, merges props instead of overwriting them, ignores any edge without evidence, and re-activates a retracted edge when a source reports it again.
   - Every step logs to `ingest_runs` (status, counts, notes) and updates `sources.last_synced_at`.
2. **pg_net**: `select private.invoke_ingest('ORPHA:33069', 'all');` posts to the function. Responses land in `net._http_response` and are kept for 6 h.
3. **pg_cron** jobs (UTC):

| Job | Schedule | Job | Schedule |
| --- | --- | --- | --- |
| `ingest-dravet` | `0 3 * * *` | `ingest-angelman` | `15 3 * * *` |
| `ingest-rett` | `5 3 * * *` | `ingest-cln2` | `20 3 * * *` |
| `ingest-cdkl5` | `10 3 * * *` | `ingest-hpo` | `0 4 * * 0` (weekly) |

The seed JSON is compiled into the function. After editing `supabase/seed/*.json`, run `node scripts/ingest/build-edge-seed.mjs` and redeploy. `npm run ingest` (Node, `scripts/ingest/`) is a local fallback only.

## Prop keys the UI and agents can rely on

- **`treats` edge** (`edge_props`): `phase` (0–4; 4 = approved), `stage` (Open Targets stage), `status`, `approved_for_indication` (bool), `investigational` (bool), `origin` (`opentargets` | `clinicaltrials` | `fda`), `mechanism`, `intervention_type`, `nct_ids[]`, `regulators[]`. Curated approvals add `approval{agency, date, url, indication, trade_name}`. Trial info merged onto an Open Targets edge is added as `trial_status`, `trial_phase` and `trial_statuses`.
- **treatment entity**: `chembl_id`, `drug_type`, `approved` (approved for any indication), `max_stage`, `mechanism`, `targets[]`, `trade_names[]`, `synonyms[]`. Nodes from ClinicalTrials.gov only use the id `CTGOV:<slug>`.
- **trial entity**: `nct_id`, `status`, `phase` (e.g. `PHASE2/PHASE3`), `phases[]`, `countries[]`, `countries_count`, `sites_count`, `sites[]` (facility, city, country, status; first 25), `start_date`, `primary_completion_date`, `enrollment`, `min_age`, `max_age`, `sponsor`, `interventions[]`, `conditions[]`, `url`.
- **disease entity**: `definition`, `name_es`, `mondo`, `xrefs{OMIM,ICD-10,…}`, `prevalence[]`, `age_of_onset[]`, `inheritance[]`, `orphanet_url`. Spanish names are also stored in `entity_aliases` with `lang = 'es'`.
- **study entity**: `pmid`, `journal`, `pub_date`, `authors[]`, `pubtype[]`, `doi`, `first_author`, `last_author` (`{name, affiliation, orcid, country}`).
- **`research_community`**: one row per first or last author of each paper (`source = 'pubmed_author'`, `source_ref = 'PMID:…'`). These are public profiles and `open_to_contact = false`.

## Demo diseases (seed)

| Disease | ORPHA | MONDO | Gene |
| --- | --- | --- | --- |
| Dravet syndrome | ORPHA:33069 | MONDO:0100135 | SCN1A |
| Rett syndrome | ORPHA:778 | MONDO:0010726 | MECP2 |
| CDKL5 deficiency disorder | ORPHA:505652 | MONDO:0100039 | CDKL5 |
| Angelman syndrome | ORPHA:72 | MONDO:0007113 | UBE3A |
| CLN2 disease | **ORPHA:228349** | MONDO:0008769 | TPP1 |

The original seed used ORPHA:228354, which is **CLN8** disease, and MONDO:0011122 for Dravet. Both are fixed. The CLN8 node has been renamed, all of its edges retracted and its aliases neutralized. Removing it completely needs a human-run `DELETE` (see below).

## Counts (2026-10-03, after the data-integrity pass)

`graph_stats`: 751 entities · 877 active edges · 1,006 evidence rows · 5 diseases · 75 trials · 63 treatments · 9 sources · 263 researchers. Zero active edges lack evidence.

| Disease | causes | has_phenotype | treats | studies (trials + papers) | variants | orgs | researchers |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dravet | 7 | 46 | 17 | 54 | 25 | 5 | 59 |
| Rett | 1 | 35 | 29 | 59 | 25 | 5 | 52 |
| CDKL5 | 1 | 52 | 3 | 34 | 25 | 5 | 52 |
| Angelman | 1 (Monarch) | 71 | 16 | 48 | 25 | 5 | 50 |
| CLN2 | 1 (Monarch) | 15 (Monarch) | 2 | 34 | 25 | 4 | 50 |

Treatments approved for the indication: Dravet (cannabidiol, fenfluramine, stiripentol; Open Targets), Rett (trofinetide; Open Targets), CLN2 (cerliponase alfa; Open Targets), CDKL5 (ganaxolone; curated FDA approval). Angelman has none.

Integrity rules applied by ingestion: salt forms are folded into their parent molecule (`parent_chembl`), Open Targets edges that the source no longer reports are retracted, device interventions and title-like intervention names are never treatments, and trials must name the disease.

## What does not come in

- Data about individual patients, from any source.
- Forums or social media as clinical evidence.
- Any row without a `url` and `retrieved_at`.
