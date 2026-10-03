@AGENTS.md

# Nexmed · agent guide

**AI atlas for rare diseases.** An evidence knowledge graph (diseases, genes/variants, mechanisms/pathways, symptoms, patient groups, papers, studies, assets, researchers) where every edge shows its source, relationship type, confidence and contradicting evidence — and a patient-first interface that carries Maria from her disease to a shared mechanism, a reusable asset, a collaborator and a next step.
Hack-Nation 7 · Challenge 05 (OpenAI × Buffalo Initiative). Hard deadline **Sun 4 Oct 07:00 America/Mexico_City**.
Team plan, lanes, contracts and timeline: [docs/WORKFLOW.md](docs/WORKFLOW.md). Live team log: `/home/claude/nexmed-shared/BITACORA.md` (copied to `docs/BITACORA.md` at merge).

## Non-negotiables

1. **No claim without evidence.** Every sentence an agent says/shows cites edge or evidence ids; the deterministic verifier (`src/lib/verifier.ts`) drops the rest. Never weaken it to make a demo pass.
2. **Never invent** data, IDs (ORPHA, MONDO, HP, HGNC, NCT, PMID, DOI), numbers, quotes, people, organizations, testimonials or logos. Unknown → say so, or a visible `sample` / `assumption` label.
3. **Observed ≠ inferred ≠ AI-extracted ≠ community draft.** Edge `kind` is always shown: `observed` (a source states it, solid line), `inferred` (computed by Nexmed analysis, dashed), `extracted` (pulled by OpenAI from a cited paper, dotted + "needs review"), `proposed` (community draft, never evidence).
4. **"Not medical advice"** on every surface that renders answers. No doses, no cure promises.
5. **No secrets client-side.** Only `NEXT_PUBLIC_*` reaches the browser. Never read `.env*` files (only `.env.example`).
6. **English UI.** Spanish strings are optional (existing `{ en, es }` copy may stay; new copy may be English-only with fallback).
7. **Design:** light only, logo blues (`--brand #3a86bf`, `--brand-deep`, `--brand-ink`, `--brand-soft`), white surfaces, no dark backgrounds (medical context). Animated elements should be **3D** where it adds meaning (three.js / R3F / react-force-graph-3d), always with a reduced-motion fallback. Tokens only from `src/app/globals.css` — no raw hex in components except data-viz palettes defined in one file.

## Stack & commands

Next.js 16 App Router (read `node_modules/next/dist/docs/` before writing Next code) · React 19 · Tailwind 4 · motion · three / @react-three/fiber / drei · react-force-graph-2d/3d · graphology (+ louvain) · OpenAI SDK · @elevenlabs/react · Supabase (Postgres graph, RLS, Edge Functions, pg_net, pg_cron) · Vercel.

| Command | What |
|---|---|
| `npm run dev -- -p <lane port>` | local server (reads bundled `data/atlas.json` when Supabase is unreachable) |
| `npm run typecheck` · `npm run lint` · `npm test` | tsc · eslint · vitest |
| `flock /home/claude/nexmed-shared/build.lock npm run build` | production build — **always through flock** (2 CPUs shared by 6 agents) |
| `node /home/claude/tools/shot.mjs <url> <out.png> [w] [h]` | Playwright screenshot |

IDs: Supabase project `zuqwmvshkhniqebtxlks` (ca-central-1) · Vercel team `team_F1iFknfdTi4UpLcGBEYjUkV5` · GitHub `perdomoangelrangel-tech/7th-Hack-Nation-Global-AI-Hackathon-proyect` · ElevenLabs agents tagged `nedamex` (rename to Nexmed).

## Sandbox network (important)

This cloud sandbox reaches **only npm, PyPI and GitHub**. It can NOT reach supabase.co, api.openai.com, api.elevenlabs.io or the biomedical APIs. So:
- Database work goes through the **Supabase MCP tools** (`execute_sql`, `apply_migration`, `deploy_edge_function`, `list_tables`, `get_advisors`). Fetching from sources happens **inside Supabase** (Edge Function `ingest`, triggered with `pg_net`).
- ElevenLabs configuration goes through the **ElevenLabs MCP tools**.
- OpenAI code must have a deterministic fallback when `OPENAI_API_KEY` is missing (it is missing here); unit-test with mocks. Live tests happen on Vercel later.
- The app must always render from the bundled snapshot `data/atlas.json` when Supabase is not reachable.

## Data model (in-memory, `src/lib/atlas/`)

`types.ts` (AtlasSnapshot: entities, edges with evidence[], analytics) · `store.ts` (`await loadAtlas()` at the top of every server entry, then sync `atlas()` views) · `source.ts` (Supabase loader, data lane) · analytics = clusters, similarity, bridges, gaps, counterexamples. Entity ids are `${type}:${canonical_id}` (e.g. `disease:ORPHA:599373`).

## Personas (`src/lib/agents/profiles.ts`)

| Mode (UI) | Persona id | Who |
|---|---|---|
| Patient | `devon` | newly diagnosed patient / caregiver, no medical background |
| Family & patient group | `maria` | patient-organization leader (the main journey) |
| Researcher | `osei` | academic clinician-scientist |
| Pharma | `priya` | biotech / pharma scout |

## Git

One branch per lane `feat/<lane>` in its own worktree under `/home/claude/wt/<lane>`. Small commits (`feat(explorer): …`). Never push, never touch another lane's paths (see WORKFLOW.md §2) — write a HANDOFF entry in the bitácora instead. The brain merges in order: data → ai → explorer → voice → action → brand.

## Done = verified

`npm run typecheck && npm run lint && npm test && flock /home/claude/nexmed-shared/build.lock npm run build`, plus screenshots at 1440 and 390 px for UI changes. Report exactly what ran and what could not be verified.
