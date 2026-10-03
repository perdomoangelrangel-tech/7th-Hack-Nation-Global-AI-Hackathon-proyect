# Architecture

> **Nexmed** by **Nedamex** · Hack-Nation 7 · Challenge 05 — AI Atlas for Rare Diseases (OpenAI × Buffalo Initiative)
>
> The rule that governs the whole system: **the AI knows nothing on its own. It can only say what the graph supports with a source and a date.**

## 1. What we built

An evidence knowledge graph that connects rare diseases, genes and variants, mechanisms (Reactome pathways), symptoms (HPO), patient groups, papers, studies, reusable assets (natural history studies, registries, biomarker studies), treatments and researchers. Every edge shows its source, relation, kind, confidence and contradicting evidence. On top of it, a patient-first interface with four modes that carries a user from their disease to a shared mechanism, a reusable asset, a collaborator and a next step this week.

| Mode | Persona id | Who |
| --- | --- | --- |
| Patient | `devon` | newly diagnosed patient / caregiver |
| Family & patient group | `maria` | patient-organization leader (main demo journey, STXBP1-DEE) |
| Researcher | `osei` | clinician-scientist |
| Pharma | `priya` | biotech / pharma scout |

## 2. The flow

```mermaid
flowchart TB
  subgraph INGEST["Ingest (Edge Function `ingest` + pg_cron, or `npm run ingest`)"]
    S1[Orphanet] --> N
    S2[HPO] --> N
    S3[Monarch] --> N
    S4[ClinVar] --> N
    S5[ClinicalTrials.gov] --> N
    S6[Open Targets + Reactome] --> N
    S7[PubMed] --> N
    S8[NIH RePORTER] --> N
    S9[Curated orgs + FDA] --> N
    N[ingest_upsert()\nentities + edges + evidence, idempotent]
  end
  N --> G[(Supabase Postgres\nevidence graph · RLS public read)]
  G --> L[loadAtlas() → source.ts\nparallel paginated reads]
  F[(data/atlas.json\nbundled snapshot)] --> L
  L --> AN[analyze()\nIC · similarity · clusters · bridges · gaps · counterexamples]
  AN --> IDX[atlas() index\nbyId · edgeById · out/in · evidenceById]
  IDX --> UI[/atlas explorer · journey · co-create/]
  IDX --> API[/api/ask · narrate · explain · tools/]
  API --> V{Deterministic verifier\nevery claim cites edge/evidence ids}
  V --> R[Answer / voice with citations\n+ "not medical advice"]
  UI --> P[submit_proposal() → proposals\ncommunity drafts, never evidence]
  API --> X[save_extraction() → extractions\nkind "extracted", needs review]
  P --> G
  X --> G
```

## 3. Data layer

### Graph model (Postgres as a property graph)

`entities (type, canonical_id, name, props)` · `entity_aliases` · `edges (from_id, to_id, relation, kind, confidence, confidence_basis, status, props)` · `evidence (edge_id, source_id, external_id, url, quote, published_on, retrieved_at)` · `sources`.

- Entity types: disease, gene, variant, phenotype, pathway, trial, study, treatment, organization, investigator.
- Relations: `causes`, `has_phenotype`, `has_variant`, `studies`, `treats`, `supports`, `researches`, `participates_in`, `is_a`, `similar_to` (inferred only).
- `edges.kind`: `observed` · `inferred` · `extracted` · `proposed` (migration `0011_nexmed.sql`).
- Hard rules: an **active edge without evidence cannot exist** (trigger `guard_edge_active`); every evidence row has `url` + `retrieved_at`; entities are keyed by their external canonical id so the ingest is idempotent; user data lives apart with RLS.
- Community layer: `proposals` (+ `submit_proposal()` security-definer RPC with length limits and a flood guard, `proposals_public` view without the contact column) and `extractions` (+ `save_extraction()`); both are anon-callable, both RLS-protected.

### Loader (`src/lib/atlas/source.ts` + `src/lib/supabase/snapshot.ts`)

1. HEAD count per table, then every 1,000-row page in parallel (PostgREST row cap, 3 s anon statement timeout) — ~1 s for the current graph.
2. Map rows to the `AtlasSnapshot` contract (`src/lib/atlas/types.ts`): ids `${type}:${canonical_id}`, edges `edge:<uuid>` with their evidence, aliases, props; drop edges without evidence; keep only entities that take part in an edge.
3. Saved extractions → `kind: "extracted"` edges (subject/object = `entity_ids[0..1]`, PubMed evidence row, `needs_review`); proposals → `snapshot.proposals` overlay.
4. `withAnalytics()` in-process; `store.ts` caches the result for 5 minutes and falls back to `data/atlas.json` if Supabase is unreachable or (coverage guard) misses a disease the bundled snapshot has. `NEXMED_DATA_SOURCE=file|supabase` forces either.

### Analytics (`src/lib/atlas/analyze.ts`, pure and deterministic)

| Output | How |
| --- | --- |
| Phenotype IC | `-ln(n/N)/ln(N)` from HPO annotation counts; fallback: frequency of the term in the atlas diseases' phenotype closure (`ic_basis` says which) |
| Disease similarity | `0.55 · simGIC phenotypes (confidence × IC, with HPO ancestors) + 0.35 · (0.7 Reactome pathway Jaccard + 0.3 top-level Jaccard) + 0.10 · shared gene` |
| `similar_to` edges | top 3 per disease above 0.06, kind **inferred**, evidence = Nexmed analysis row + the observed evidence of the supporting edges |
| Clusters | Louvain (seeded) over the similarity graph; named after the most specific shared Reactome pathway, else the most informative shared phenotype; `label_basis` explains it with counts |
| Variant effect | per disease (not per gene): ClinVar P/LP counts for the gene **and** the disease's ClinVar trait → truncating vs missense |
| Bridges | investigators / organizations / trial sponsors linked to ≥ 2 diseases, flagged when they cross clusters |
| Gaps | no approved treatment · no natural history · no registry · no active trial · no NIH funding · no patient group · few phenotypes — each with "what would change it" |
| Counterexamples | same symptoms, different mechanism (phenotype-similar, no shared pathway, different clusters) · same gene, different mechanism (shared gene, different variant effect) |

## 4. Contracts

The graph contract (`docs/WORKFLOW.md` §3.1) is additive-only: `await loadAtlas()` then `atlas()` → `{ snap, byId, edgeById, out, in, evidenceById }`. Changes are announced as `CONTRACT` entries in the bitácora. HTTP routes and UI mount points are listed in WORKFLOW §3.2–3.3.

## 5. Verifier

The LLM answers in JSON `{ claims: [{ text, evidence_ids[] }] }`; `src/lib/verifier.ts` drops any claim whose ids are empty or were not returned by the graph in that turn. It is deterministic — no second LLM checks the first — and it is never weakened to make a demo pass.

## 6. Scaling

| Dimension | Now | Next |
| --- | --- | --- |
| Diseases | 21 verified monogenic diseases | thousands, by feeding the same ingest with Orphadata `rd-classification` |
| Ingest | Edge Function per disease via `pg_net`, daily `pg_cron`, run log in `ingest_runs` | queue in `ingest_jobs` (`FOR UPDATE SKIP LOCKED`) |
| Reads | paginated public reads + in-process analytics, 5-minute cache | materialized analytics table refreshed after each ingest |
| Graph store | Postgres | Postgres to ~10M edges; a graph DB behind the same loader contract afterwards |

## 7. Decisions and trade-offs

| Decision | Alternative | Why |
| --- | --- | --- |
| Postgres as the graph | Neo4j | one platform with RLS, RPCs, vector, cron; enough for millions of edges |
| Analytics in-process, pure | SQL / stored analytics | deterministic, unit-tested, same code for the live graph and the offline snapshot |
| Inferred / extracted / proposed kept apart from observed | one undifferentiated graph | a user always sees whether a source said it, Nexmed inferred it, an LLM extracted it or the community proposed it |
| Deterministic verifier | LLM-checks-LLM | reproducible, cheap, cannot hallucinate the check |
| Ids verified against Orphadata / Monarch / HGNC before seeding | hand-typed ids | never invent an ORPHA / MONDO / HGNC id |

## 8. What we do not do, on purpose

- No medical advice: no doses, no cure promises; treatments from other diseases are questions for an expert.
- No relation without a source; a gap is shown as a gap.
- No patient data; contact for collaboration only with explicit consent.
