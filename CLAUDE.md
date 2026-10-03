@AGENTS.md

# Nedamex · Claude Code guide

**Evidence knowledge graph of rare diseases + voice agents that never invent.** Every answer is traced to a source and a date.
Hack-Nation 7 · Challenge 5 · hard deadline **07:00 America/Mexico_City**. Team plan, lanes and timeline: [docs/WORKFLOW.md](docs/WORKFLOW.md).

## Non-negotiables

1. **No claim without an `evidence_id`.** The deterministic verifier (`src/lib/verifier.ts`) drops anything else. Never weaken it to make a demo pass.
2. **Never invent** data, IDs (ORPHA, HP, HGNC, NCT, PMID), numbers, quotes, people, orgs, testimonials or logos, whether in UI, seed, docs or video. Unknown → `[placeholder]` or a visible "sample" label.
3. **"Not medical advice" on every answer** (`DISCLAIMER_EN/ES`) and on every surface that renders answers.
4. **Never sell patient data.** Trial contact only with explicit consent (`trial_contact_consents`).
5. **No secrets client-side.** Only `NEXT_PUBLIC_*` reaches the browser; never give a secret that prefix.
6. **Service role only on server/edge** (`src/lib/supabase/server.ts`, API routes, Edge Functions). Never in `"use client"` files, never logged.
7. Don't read `.env*` (only `.env.example`). This is enforced in `.claude/settings.json`.

## Stack & commands

Next.js 16 App Router (**read `node_modules/next/dist/docs/` before writing Next code**) · React 19 · Tailwind 4 · Supabase (Postgres graph, RLS, pg_net, pg_cron, Edge Functions) · ElevenLabs Agents · OpenAI/Claude drafting · Vercel · Lovable researcher portal (same Supabase).

| Command | What |
|---|---|
| `npm run dev` | localhost:3000 · `/atlas` · `/api/health` |
| `npm run typecheck` · `npm run lint` · `npm test` | tsc · eslint · vitest (verifier) |
| `NEXT_DIST_DIR=.next-<lane> npm run build` | build without clobbering another session's `.next` |
| `npm run ingest -- --orpha=ORPHA:x` | local fallback only; production ingest = Edge Function `ingest` |

IDs: Supabase `zuqwmvshkhniqebtxlks` (ca-central-1) · Vercel team `perdomoangelrangel-techs-projects` · GitHub `perdomoangelrangel-tech/7th-Hack-Nation-Global-AI-Hackathon-proyect`.

## Repo map & ownership (edit only your lane)

| Lane | Owns | Subagent |
|---|---|---|
| lead | `src/app/globals.css` `src/app/layout.tsx` `DESIGN.md` `src/components/brand/**` `src/lib/i18n.tsx` `src/lib/site.ts` `package.json` `next.config.ts` | (human) |
| data | `supabase/**` `scripts/ingest/**` `src/lib/graph.ts` | `data-engineer` |
| landing | `src/app/page.tsx` `src/components/landing/**` | `frontend-builder` |
| app | `src/app/atlas/**` `src/components/atlas/**` `src/app/api/**` `src/lib/atlas-data.ts` `src/data/**` `src/lib/verifier*` `src/lib/agents/**` | `frontend-builder` · `voice-agent-designer` · `evidence-auditor` |
| video | `video/**` | `video-producer` |
| workflow | `CLAUDE.md` `AGENTS.md` (below the Next block) `.claude/**` `.mcp.json` `docs/WORKFLOW.md` `README.md` | `release-manager` |

Need a change outside your lane? Write it in a `/handoff` note for the owner. Don't edit it yourself.
Reference docs: `docs/ARCHITECTURE.md` · `docs/AGENTS.md` (agent personas) · `docs/DATA_SOURCES.md` · `docs/RESEARCH.md` (Spanish).

## Design rules (full spec: DESIGN.md)

- **Tokens only**, no raw hex: `bg-canvas` `bg-panel` `text-ink` `text-ink-2` `border-rule` `stroke-gene`… from `globals.css` (`--l-*` for lines, `--t-*` for text-safe variants, `--gap`, `--action`).
- **Transit-map language:** solid line = sourced, dashed = gap, a station exists only if a source backs it. Use the `Station`, `Plaque`, `Route` and `Logo` components.
- Type: Overpass (display) · Atkinson Hyperlegible Next (body) · Overpass Mono (codes, tabular numbers).
- Banned: eyebrow chips, gradient text, glow, three equal cards. Headlines ≤ 4 words.
- **EN/ES copy files:** each surface has its own `{ en, es }` copy object read with `useLang()` (`src/lib/i18n.tsx`). English is the default. No hardcoded strings in JSX.
- Respect `prefers-reduced-motion` (map renders fully drawn).

## Data rules

- Graph = `entities` · `edges` · `evidence`. Edges are born `pending`; a trigger flips them to `active` on the first evidence; a guard blocks `active` without evidence. Never bypass it.
- Ingestion = **Supabase Edge Function `ingest`**, invoked by `pg_net`, scheduled by `pg_cron`. This container has no egress to the sources.
- Idempotent by `(type, canonical_id)`. Every evidence row has `url` + `retrieved_at`.
- Migrations: add a new numbered file and never edit an applied one. Prefer `create or replace` / `if not exists`.
- **Supabase MCP gotcha:** SQL containing `DROP`/`TRUNCATE`/`DELETE` waits for human confirmation and hangs for ~180 s. Avoid it, or ask a human to run it.
- App reads go through `src/lib/graph.ts`, which returns `{ data, evidence[] }`. Agent tools are `/api/tools/*` (header `x-atlas-key`).

## Subagents & commands

| Subagent | Use when |
|---|---|
| `data-engineer` | schema, migrations, Edge Function `ingest`, pg_cron, graph queries |
| `frontend-builder` | landing / atlas UI, components, copy, responsive, a11y |
| `evidence-auditor` | before any merge touching answers: verifier tests, SQL integrity, red-team `/api/ask` |
| `voice-agent-designer` | ElevenLabs agents (Family / Clinical / Research), server tools → `/api/tools/*` |
| `video-producer` | Remotion scenes in `video/`, scripts, SFX, VO |
| `release-manager` | Vercel env, deploy, smoke tests on the live URL, submission checklist |

**Fan out** (several subagents in one message) only when the tasks touch **disjoint lanes**, e.g. `data-engineer` ‖ `frontend-builder` ‖ `video-producer`. Never put two agents on the same files. Every subagent returns a hand-off block. Run `evidence-auditor` last, before `/ship`.

Commands: `/ship` · `/qa` · `/new-disease ORPHA:x` · `/ingest-status` · `/video-scene <Scene>` · `/handoff`.

## Done = verified (never say "done" without this)

```bash
npm run typecheck && npm run lint && npm test && NEXT_DIST_DIR=.next-$LANE npm run build
```

- UI changed → screenshot at **1440 px and 390 px** wide (light, plus dark if colors changed) and check: no horizontal scroll, EN and ES both render.
- Answers, verifier, agents or API changed → `/qa` must pass.
- Report what you ran and the results. If something could not be verified, say so.

## Git

- One branch per lane, `feat/<lane>`, in its own worktree (see docs/WORKFLOW.md). Small commits: `feat(atlas): …`, `fix(data): …`, `docs: …`.
- Push → PR → Vercel preview URL in the PR → **squash-merge** to `main` (= production). Rebase on `main` before opening the PR.
- Merge order: data → app (+ voice) → landing → video/docs. Never force-push `main`. Never commit `.env*` or keys.
