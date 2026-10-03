# Data sources

All public. Each edge stores source, external id, URL, quote and dates. Code: `scripts/ingest/sources/*`.

| Source | What it feeds | Edge(s) | Confidence basis | Access |
| --- | --- | --- | --- | --- |
| **Orphanet / Orphadata** | Disease definition, synonyms, xrefs, causal genes (incl. stated loss/gain of function), HPO phenotypes with frequency, prevalence | `causes`, `has_phenotype` | `orphanet_gene_association`, `hpo_frequency` | api.orphadata.com (CC BY 4.0) |
| **Monarch** | Causal genes / phenotypes when Orphanet has none for the code (Angelman, FOXG1, CLN2, CLN3) — primary source OMIM/ClinGen | `causes`, `has_phenotype` | `monarch_*_causal`, `monarch_annotation_no_frequency` | api.monarchinitiative.org |
| **HPO (JAX)** | Term definition, synonyms, Spanish names, ancestors, number of annotated diseases (→ information content) | node props | — | ontology.jax.org |
| **ClinVar (NCBI)** | Pathogenic/likely pathogenic variants; full counts per disease by consequence (missense vs truncating); conflicting interpretations | `has_variant`, counts on `causes` | `clinvar_significance` | E-utilities |
| **ClinicalTrials.gov** | Trials and reusable assets (natural history, registries, biomarker studies, cohorts), sponsors, countries, outcomes, stop reasons | `studies` | `clinical_phase`, `trial_stopped` | API v2 |
| **Open Targets** | Drugs and clinical candidates per disease, mechanism of action, stopped reports | `treats` | `clinical_stage` | GraphQL (`drugAndClinicalCandidates`) |
| **Reactome** (via Open Targets) | Pathways of each causal gene — the mechanism layer | `participates_in` | `reactome_curated` | GraphQL `target.pathways` |
| **PubMed** | Recent papers (2019+), senior author as investigator | `studies`, `researches` | `publication_type`, `senior_author_name_match` | E-utilities |
| **NIH RePORTER** | Funded projects (last 4 fiscal years), PIs with stable profile ids, institutions | `researches` | `nih_funded_project` | api.reporter.nih.gov |
| **Patient groups** | Curated official sites, checked live at ingest | `supports`, `researches` | `curated_official_site` / `curated_site_unverified` | `supabase/seed/organizations.json` |
| **OpenAI extraction** (optional) | Assets and variant-effect statements from abstracts, quote-verified | `studies`, `causes` (kind `extracted`) | `llm_extraction_quote_verified` | `scripts/extract.ts` |

## First slice (seed)

Nine monogenic neurodevelopmental diseases chosen to test the brief's key insight — different genes, shared mechanisms; similar symptoms, different mechanisms:

| Disease | Gene | ORPHA | MONDO |
| --- | --- | --- | --- |
| STXBP1-related DEE (Maria's case: no approved drug) | STXBP1 | 599373 | 0012812 |
| Dravet syndrome | SCN1A | 33069 | 0011794 |
| KCNQ2-related DEE | KCNQ2 | 439218 | 0013387 |
| CDKL5 deficiency disorder | CDKL5 | 505652 | 0010396 |
| Rett syndrome | MECP2 | 778 | 0010726 |
| FOXG1 syndrome | FOXG1 | 561854 | 0100040 |
| Angelman syndrome | UBE3A | 72 | 0007113 |
| CLN2 disease | TPP1 | 228349 | 0008769 |
| CLN3 disease | CLN3 | 228346 | 0008767 |

Codes were verified against Orphanet's ExternalReference and Monarch (the original seed had 3 wrong MONDO ids and a wrong ORPHA code for CLN2). Open Targets does not index KCNQ2-DEE: reported as a coverage gap.

## What does not enter

- Relations without a source, and organizations without an official site.
- "Excluded (0%)" Orphanet phenotypes as edges (kept out; they are evidence against).
- Candidate genes ("Candidate gene tested in") are kept with confidence 0.3, not as causal.
