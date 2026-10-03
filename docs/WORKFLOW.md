# Nexmed · build workflow (brain + 6 lane agents)

The **brain** (orchestrator session) owns integration, GitHub, Vercel, env and QA. Six lane agents build in parallel, each on `feat/<lane>` in `/home/claude/wt/<lane>`, and coordinate through the shared log `/home/claude/nexmed-shared/BITACORA.md`.

## 1. Timeline (CDMX, Sat 3 → Sun 4 Oct)

| Slot | Goal |
|---|---|
| 17:00–17:30 | Foundation on `main` (done by brain): merged codebase, rename, logo palette, contracts, stubs |
| 17:30–21:00 | **Wave 1** — six lanes in parallel, commit early and often |
| 21:00–22:30 | Integration: merge data → ai → explorer → voice → action → brand; build; deploy to Vercel; connect keys |
| 22:30–01:00 | **Wave 2** — QA, evidence audit, demo journey polish, README |
| 01:00–06:30 | Videos + submission (humans) · hotfixes only |

## 2. Lanes and path ownership (edit ONLY your paths)

| Lane | Port | Owns |
|---|---|---|
| **data** | 3101 | `supabase/**` · `scripts/**` · `src/lib/atlas/source.ts` · `src/lib/atlas/analyze.ts` (new) · `src/lib/atlas/types.ts` · `data/atlas.json` · `src/lib/supabase/**` · `.github/workflows/**` · `docs/DATA_SOURCES.md` · `docs/ARCHITECTURE.md` |
| **ai** | 3102 | `src/lib/ai/**` (new) · `src/lib/openai.ts` · `src/lib/agents/**` · `src/lib/atlas/narrate.ts` · `src/lib/verifier*` · `src/lib/graph.ts` · `src/app/api/{ask,narrate,explain,extract,reconcile,tools}/**` · `src/components/ai/**` (new: extraction/explain UI pieces the explorer mounts) |
| **explorer** | 3103 | `src/app/atlas/**` · `src/components/atlas/**` except `JourneyPanel.tsx`, `NarrationBar.tsx`, `useNarration.ts` · `src/app/api/atlas/**` · `src/lib/atlas/store.ts` · `src/lib/i18n.ts` · `src/lib/prefs/**` · `src/lib/motion.ts` |
| **voice** | 3104 | `src/components/voice/**` · `src/components/atlas/NarrationBar.tsx` · `src/components/atlas/useNarration.ts` · `src/lib/voice/**` (new) · `src/app/api/{speak,voice}/**` · ElevenLabs agents (MCP) |
| **action** | 3105 | `src/components/atlas/JourneyPanel.tsx` · `src/components/cocreate/**` · `src/components/journey/**` (new) · `src/lib/journey/**` (new) · `src/app/api/{journey,proposals,match}/**` · `src/app/plan/**` (new, optional) |
| **brand** | 3106 | `src/app/page.tsx` · `src/components/landing/**` (new) · `src/components/brand/**` (new) · `src/components/three/**` (new, shared 3D primitives) · `public/**` · `blender/**` (new) · `src/app/globals.css` · `src/app/layout.tsx` · `src/lib/site.ts` · `DESIGN.md` · old `src/components/FlowDiagram.tsx`, `VideoSlot.tsx` (delete or reuse) |

Brain only: `package.json`, `package-lock.json`, `next.config.ts`, `vercel.json`, `CLAUDE.md`, `AGENTS.md`, `docs/WORKFLOW.md`, `README.md`, `.env.example`.
Need a dependency or a change in someone else's path? Append a `HANDOFF` entry to the bitácora. Pre-installed deps: react-force-graph-2d/3d, three, @react-three/fiber, @react-three/drei, three-spritetext, graphology, graphology-communities-louvain, openai, @elevenlabs/react, motion, zod, @supabase/supabase-js.

## 3. Contracts (code against these; change them only via a bitácora `CONTRACT` entry)

### 3.1 Graph (data lane provides, everyone reads)
- `await loadAtlas()` then `atlas()` → `{ snap: AtlasSnapshot, byId, edgeById, out, in, evidenceById }`.
- `Edge.kind`: `"observed" | "inferred" | "extracted" | "proposed"`. `Edge.evidence.length >= 1` for observed/inferred/extracted.
- Entity types: disease, gene, variant, phenotype, pathway (mechanism), trial, study, treatment, organization (patient group / research org), investigator.
- Supabase (migration `0011_nexmed.sql`, data lane):
  - `edges.kind` column; entity types `pathway`, `investigator`; relations `participates_in`, `similar_to`.
  - `proposals` table + RPC `submit_proposal(p_kind text, p_title text, p_body text, p_persona text, p_disease text, p_entities text[], p_edges text[], p_contact text) returns uuid` (security definer, executable by `anon`; `p_kind` ∈ hypothesis | collaboration | evidence). Public read view `proposals_public` (no contact column).
  - `extractions` table + RPC `save_extraction(p_pmid text, p_model text, p_payload jsonb) returns uuid` (security definer, `anon`). The loader maps saved extractions into `kind: "extracted"` edges with a PubMed evidence row.
  - RPC `atlas_snapshot()` (or paginated reads) consumed only by `src/lib/atlas/source.ts`.

### 3.2 HTTP API
| Route | Owner | Contract |
|---|---|---|
| `GET /api/atlas/{search,graph,journey,edge,constellation,diseases,stats}` | explorer | existing (see route file); `edge` returns source, relation, kind, confidence + basis, evidence[], contradicting[] |
| `POST /api/ask` | ai | `{ question, persona, locale, focus?, simple? }` → verified answer `{ claims:[{text, evidence_ids[]}], dropped, mode }` |
| `POST /api/narrate` | ai | existing; persona-ordered, verified narration |
| `POST /api/explain` | ai | `{ edgeIds: string[], persona, locale, simple? }` → `{ sentences:[{ text, edge_ids[], evidence_ids[] }], dropped, mode:"openai"|"deterministic", model? }` |
| `POST /api/extract` | ai | `{ pmid?: string, text?: string, title?: string }` → `{ source:{pmid?,url?}, entities:[{ mention, type, entity_id|null, canonical_id|null, match:"exact"|"alias"|"fuzzy"|"llm"|"new", confidence }], claims:[{ subject, relation, object, polarity:"supports"|"contradicts", quote, confidence, entity_ids[] }], saved, mode }` |
| `POST /api/reconcile` | ai | `{ names: string[], type? }` → `{ matches:[{ name, entity_id|null, canonical_id|null, label, method, confidence, candidates[] }] }` |
| `GET /api/tools/[tool]` | ai | ElevenLabs server tools (header `x-atlas-key`) |
| `POST /api/speak` | voice | `{ text, persona, locale }` → `audio/mpeg` (ElevenLabs); `503` → client falls back to browser speech |
| `GET /api/voice/agents` | voice | `{ agents: { devon, maria, osei, priya } }` public ElevenLabs agent ids |
| `GET /api/journey?d=&p=&l=` | action | extended journey: connection → asset (what differs, what needs expert review) → collaborator → next step, honest gaps, 10× plan |
| `GET/POST /api/proposals` | action | list drafts for a disease / submit a draft (via RPC) |
| `GET /api/match?d=&p=` | action | ranked collaborator suggestions with reasons + evidence edges |

### 3.3 UI mount points inside `AtlasApp` (explorer keeps them)
- `<VoiceDock persona locale disease diseaseName />` from `src/components/voice/VoiceDock.tsx` (voice)
- `<CoCreate persona locale disease diseaseName edgeIds? />` from `src/components/cocreate/CoCreate.tsx` (action)
- `<JourneyPanel …/>` (action) · `<NarrationBar …/>` + `useNarration()` (voice)
- `usePrefs()` from `src/lib/prefs` (textScale, highContrast, reduceMotion, simpleLanguage, autoRead, voiceRate, captions)

## 4. Bitácora protocol

Append only (never rewrite) to `/home/claude/nexmed-shared/BITACORA.md`:

```bash
cat >> /home/claude/nexmed-shared/BITACORA.md <<'EOF'

## 18:05 · explorer · PROGRESS
- 3D graph renders from /api/atlas/graph; edge click opens evidence panel
- NEED(ai): /api/explain returns 500 when edgeIds is empty
EOF
```

Types: `START` · `PROGRESS` (every ~30–45 min) · `CONTRACT` (you changed/added an interface others use) · `HANDOFF` (you need something from another lane: `NEED(<lane>): …`) · `BLOCKED` · `DONE`. Read the whole file at start and before touching any shared interface; answer `NEED(<your lane>)` items addressed to you.

## 5. Merge order

data → ai → explorer → voice → action → brand → `main` → Vercel production. The brain resolves conflicts and re-runs the full verification after each merge.
