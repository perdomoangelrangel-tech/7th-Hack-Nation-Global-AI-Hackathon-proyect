# Nedamex · the AI atlas for rare diseases

> Hack-Nation 7th Global AI Hackathon · **Challenge 05: AI Atlas for Rare Diseases** (OpenAI × Buffalo Initiative)
>
> One rule governs the whole system: **no claim without evidence.** Every link in the graph and every sentence the AI writes or speaks carries its source, its relationship type and how sure we are.

Nedamex is an evidence knowledge graph of rare diseases — diseases, genes and variants, mechanisms and pathways, symptoms, patient groups, papers, studies, reusable research assets and researchers — with a patient-first interface on top. It carries a family like Maria's (STXBP1) from an isolated diagnosis to a shared mechanism, a reusable asset, a collaborator and a concrete next step, and it says so honestly when there is no supported route.

**Not medical advice.** Nedamex shows sourced information to discuss with a clinician.

## Live

| Deliverable | URL |
| --- | --- |
| Website (story, videos, how it works) | https://nedamex.vercel.app |
| The Nedamex app (atlas, route, evidence, voice) | https://nedamex.vercel.app/atlas |
| Nedamex on Lovable (home + embedded atlas + research page) | https://nedamex.lovable.app |
| Maria's demo route (STXBP1-DEE, family mode) | https://nedamex.vercel.app/atlas?p=maria&d=disease:ORPHA:599373 |

Videos: pitch · demo · functionality — `[links added when recorded]`.

## What it does

- **Evidence graph.** 21 monogenic diseases across 5 mechanism clusters: 5,933 edges backed by 6,846 evidence rows from 10 open sources (live numbers: [`/api/atlas/stats`](https://nedamex.vercel.app/api/atlas/stats)). An edge without evidence cannot exist (Postgres trigger + loader filter).
- **Four kinds of link, always visible.** `observed` (a source states it · solid line) · `inferred` (Nedamex analysis · dashed, "needs expert review") · `extracted` (OpenAI pulled it from a cited paper · dotted, "needs expert review") · `proposed` (community draft · ghost, never evidence).
- **Mechanism clusters, not name lists.** Louvain communities over phenotype information content, Reactome pathways and shared genes; each cluster is named by its dominant mechanism with the basis shown. Counterexamples ("same symptoms, different mechanism") are first-class.
- **A route, not a map.** Four questions answered only from the graph, each with its evidence one click away: who shares our disease characteristics → what useful work already exists → who could help → what we should do together next. Steps are labelled *Strong / Possible / Weak lead* and step 4 is a recommendation, never "observed".
- **Four modes.** Patient or caregiver · Family & patient group · Researcher · Pharma & biotech — same graph, different order and depth (plain-language cards, research tabs, a cluster table ranked by unmet need).
- **Co-creation.** Propose a hypothesis, a collaboration or missing evidence; drafts appear as ghost lines and never count as evidence.
- **The 10× route.** Typical vs Nedamex route to a shared natural-history study, every duration labelled as an assumption.

## Architecture

```mermaid
flowchart LR
  subgraph Sources[Open sources]
    ORPHA[Orphanet] & HPO[HPO] & MON[Monarch] & CV[ClinVar] & CT[ClinicalTrials.gov] & OT[Open Targets / Reactome] & PM[PubMed] & NIH[NIH RePORTER] & FDA[FDA] & PO[Patient orgs]
  end
  Sources -->|Edge Function ingest · pg_cron daily| DB[(Supabase Postgres<br/>entities · edges · evidence<br/>RLS · RPCs)]
  Sources -->|local pipeline| SNAP[data/atlas.json<br/>bundled snapshot]
  DB --> API
  SNAP --> API
  subgraph Vercel[Next.js 16 on Vercel]
    API[API routes<br/>/api/atlas · journey · match · proposals<br/>ask · narrate · explain · extract · reconcile · speak · tools]
    UI[Website / and app /atlas<br/>3D/2D graph · route stepper · evidence drawer]
    VER[Deterministic verifier]
  end
  API --> UI
  OAI[OpenAI gpt-4o-mini] <-->|structured JSON| API
  API --> VER --> UI
  EL[ElevenLabs<br/>TTS + 4 voice agents] <-->|server tools /api/tools/*| API
  LOV[Lovable app] -->|embeds /atlas · reads Supabase| Vercel
  BL[Blender] -->|GLB + posters| UI
```

- **Frontend** — Next.js 16 App Router, React 19, Tailwind 4, `react-force-graph-3d/2d` (3D with a 2D fallback for reduced motion, small screens and no WebGL), three.js / React Three Fiber, `motion`, `lucide-react`.
- **Backend** — Next.js route handlers on Vercel; CORS for the Lovable app is exact-origin only (`src/proxy.ts`).
- **Data** — Supabase Postgres as a property graph (migrations in `supabase/migrations/`), Edge Function `ingest` triggered by `pg_net` and scheduled with `pg_cron`; RLS on every table; community drafts and AI extractions written only through `security definer` RPCs. The app serves the richer bundled snapshot until the live graph reaches parity (coverage guard in `src/lib/atlas/source.ts`).
- **Verifier** — `src/lib/verifier.ts` is deterministic and unit-tested: a sentence without evidence ids from the graph is dropped before it is shown or spoken; doses, cure promises and PII are blocked; inferred links are always hedged. Red-team suite: `node .claude/qa/redteam.mjs <url>`.
- **OpenAI** — Explain (plain language that cites every sentence), Reconcile (names → graph entities, choosing only among our candidates) and Extract (claims with the exact quote from a cited paper, saved as `extracted` edges that need expert review). Every response reports `mode: "openai" | "deterministic"`; everything has a deterministic fallback. Details: [`docs/OPENAI.md`](docs/OPENAI.md).
- **ElevenLabs** — one voice per mode for narration (`/api/speak`, browser speech as fallback) and four conversational agents (Patient Guide, Family & Patient-Group Navigator, Research Analyst, Pharma Scout) whose server tools read the graph through `/api/tools/*` and return evidence ids.
- **Blender** — the hero (a DNA helix growing from the logo's forest into the graph), the voice-agent avatar and one glyph per entity type, built reproducibly with `blender/*.py` and exported as compressed GLB (`public/models/`).

More: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) · [`DESIGN.md`](DESIGN.md).

## Run it locally

Requirements: Node 20+ and npm.

```bash
git clone https://github.com/perdomoangelrangel-tech/7th-Hack-Nation-Global-AI-Hackathon-proyect.git nedamex
cd nedamex
npm install
npm run dev            # http://localhost:3000 (website) · /atlas (app) · /api/health
```

No configuration is needed to explore: the public Supabase URL and publishable key are built in (read-only by RLS) and the app falls back to the bundled `data/atlas.json`. Without model keys every AI feature runs in a deterministic, fully cited mode.

Optional `.env.local` (see `.env.example`; never commit it):

| Variable | Enables |
| --- | --- |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_MODEL_FAST` | Live Explain / Ask / Narrate / Reconcile / Extract (`gpt-4o-mini` recommended) |
| `ELEVENLABS_API_KEY` | ElevenLabs voices for narration (`/api/speak`) |
| `NCBI_API_KEY` | Faster PubMed / ClinVar ingest |

Checks: `npm run typecheck && npm run lint && npm test && npm run build`.

## Reproduce the dataset

1. **Disease slice.** `npx tsx scripts/resolve-seed.ts` resolves and verifies every id of the 21 diseases (Orphadata preferred term + disease-causing gene, HGNC, MONDO, OMIM, ClinVar trait). Unverifiable candidates are left out, never guessed.
2. **Ingest to the bundled snapshot.** `npm run ingest` runs the local pipeline over all sources into `data/atlas.json` (`--orpha=ORPHA:…` for one disease, `--only=<source>` for one source, `--fresh` to rebuild).
3. **Analytics.** `npm run analyze` computes mechanism clusters, similarity explanations, bridges, gaps and counterexamples (`src/lib/atlas/analyze.ts`, pure and deterministic).
4. **Live graph.** Apply `supabase/migrations/*` to a Supabase project, deploy the Edge Function `supabase/functions/ingest`, and trigger it per disease (`pg_net`, or the `ingest` GitHub workflow); `0012_nexmed_cron.sql` schedules a daily refresh. `npm run snapshot` exports the live graph back to the snapshot format.
5. **AI extraction (optional).** With `OPENAI_API_KEY`: `npm run extract -- --limit 40` extracts claims from the PubMed papers in the graph (idempotent by PMID) and saves them with `save_extraction`.

Integrity checks: `.claude/qa/integrity.sql` (every `expect = 0` row must be 0).

## Data and licenses

| Source | License |
| --- | --- |
| Orphanet / Orphadata, Monarch, Reactome | CC BY 4.0 |
| Human Phenotype Ontology | HPO license |
| Open Targets | CC0 |
| ClinVar, PubMed metadata, ClinicalTrials.gov, NIH RePORTER, FDA | Public domain |
| Patient organizations | Public information from each organization's official site |

Every evidence row stores `source`, `external_id`, `url` and `retrieved_at`. Code license: `[to be chosen by the team]`.

## Team

`[Name] · [Role]` — Nedamex. Team names are added by the team; we do not invent people.

---

Nedamex is a product of **Nedamex**. Built with OpenAI · ElevenLabs · Supabase · Vercel · Lovable · Blender.
