@AGENTS.md

# Nexmed by Nedamex · Claude Code guide

**Nexmed** (product) by **Nedamex** (company): the AI atlas for rare diseases. An evidence knowledge graph — diseases, genes/variants, mechanisms/pathways, symptoms, patient groups, papers, studies, reusable assets, researchers — where every edge shows its source, relationship type, confidence and contradicting evidence, plus a patient-first interface that carries Maria from her disease to a shared mechanism, a reusable asset, a collaborator and a next step this week.
Hack-Nation 7 · Challenge 05 (OpenAI × Buffalo Initiative). Hard deadline **Sun 4 Oct 07:00 America/Mexico_City**.

Plan, lanes, path ownership and contracts: [docs/WORKFLOW.md](docs/WORKFLOW.md). Lane specs: `.claude/agents/*.md`. **Live team log (bitácora): `../nexmed-shared/BITACORA.md`** (one level above every checkout; the brain copies it to `docs/BITACORA.md` at each merge).

## Naming

- Product / app / UI name: **Nexmed**. Company: **Nedamex** (footer, legal line, metadata `publisher`, ElevenLabs agent tags, "Nexmed by Nedamex"). Both live in `src/lib/site.ts` (`site.name`, `site.company`) — never hardcode either.

## Non-negotiables

1. **No claim without evidence.** Every sentence an agent says or shows cites edge/evidence ids; the deterministic verifier (`src/lib/verifier.ts`) drops the rest. Never weaken it to make a demo pass.
2. **Never invent** data, IDs (ORPHA, MONDO, OMIM, HP, HGNC, NCT, PMID, DOI), numbers, quotes, people, organizations, testimonials or logos. Unknown → say so, or show a visible `sample` / `assumption` label.
3. **Observed ≠ inferred ≠ AI-extracted ≠ community draft.** Edge `kind` is always visible: `observed` (a source states it · solid line), `inferred` (Nexmed analysis · dashed), `extracted` (OpenAI pulled it from a cited paper · dotted + "needs expert review"), `proposed` (community draft · ghost, never evidence).
4. **"Not medical advice"** on every surface that renders answers. No doses, no cure promises; treatments from other diseases are questions for an expert.
5. **No secrets client-side.** Only `NEXT_PUBLIC_*` reaches the browser. Never read `.env*` files except `.env.example` (enforced in `.claude/settings.json`).
6. **English UI.** Existing `{ en, es }` copy may stay; new copy may be English-only with fallback.
7. **Design:** light only, logo blues (`--brand #3a86bf`, `--brand-deep`, `--brand-ink`, `--brand-soft`, `--brand-mist`) on white. No dark backgrounds (medical context). Animated elements are **3D** where it adds meaning (three.js / R3F / react-force-graph-3d / Blender GLB), always with a `prefers-reduced-motion` + low-power 2D fallback. Use tokens from `src/app/globals.css`; raw hex only inside one data-viz palette file.

## Stack & commands

Next.js 16 App Router (**read `node_modules/next/dist/docs/` before writing Next code**) · React 19 · Tailwind 4 · motion · three / @react-three/fiber / drei · react-force-graph-2d/3d · graphology + louvain · OpenAI SDK · @elevenlabs/react · Supabase (Postgres graph, RLS, Edge Functions, pg_net, pg_cron) · Vercel.

| Command | What |
|---|---|
| `npm run dev -- -p <lane port>` | local server (live Supabase; falls back to bundled `data/atlas.json` if unreachable) |
| `npm run typecheck` · `npm run lint` · `npm test` | tsc · eslint · vitest |
| `npm run build` | production build (run before saying DONE) |

IDs: Supabase `zuqwmvshkhniqebtxlks` (ca-central-1, public URL + publishable key baked into `src/lib/supabase/config.ts`) · Vercel team `team_F1iFknfdTi4UpLcGBEYjUkV5` (`perdomoangelrangel-techs-projects`) · GitHub `perdomoangelrangel-tech/7th-Hack-Nation-Global-AI-Hackathon-proyect` · ElevenLabs: 3 existing agents tagged `nedamex` (Family Guide, Clinical Analyst, Research Analyst) to be reworked into the 4 Nexmed modes.

## Data model (`src/lib/atlas/`)

`types.ts` (AtlasSnapshot: entities, edges with evidence[], analytics) · `store.ts` (`await loadAtlas()` at the top of every server entry, then synchronous `atlas()` views) · `source.ts` (Supabase loader) · analytics = mechanism clusters (Louvain over phenotype IC + Reactome pathway + gene similarity), similarity explanations, bridges (shared researchers/orgs/sponsors), gaps, counterexamples. Entity ids are `${type}:${canonical_id}` (e.g. `disease:ORPHA:599373`).

## Personas (`src/lib/agents/profiles.ts`)

| Mode in the UI | id | Who |
|---|---|---|
| Patient | `devon` | newly diagnosed patient / caregiver, no medical background |
| Family & patient group | `maria` | patient-organization leader — the main demo journey |
| Researcher | `osei` | academic clinician-scientist |
| Pharma | `priya` | biotech / pharma scout |

## Git

- Brain session: main checkout `nexmed/` on `main`. Lanes: `../nexmed-<lane>` on `feat/<lane>` (git worktrees).
- Edit only your lane's paths (WORKFLOW.md §2). Need something elsewhere → `HANDOFF` entry in the bitácora, never edit it yourself.
- Small commits (`feat(explorer): …`, `fix(data): …`). Lanes never push `main` and never force-push. The brain merges in order: data → ai → explorer → voice → action → brand, then deploys.

## Done = verified

`npm run typecheck && npm run lint && npm test && npm run build`, plus screenshots at 1440 and 390 px for UI changes (Playwright or the browser tool). Report exactly what ran and what could not be verified. The **user-verifier** agent re-tests every merged journey as a real user before the brain calls anything shipped.
