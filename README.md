# Rare Disease Atlas · evidence-first knowledge graph with voice agents

> Hack-Nation 7th Global AI Hackathon · **Challenge 5: AI Atlas for Rare Diseases** (Buffalo Initiative × OpenAI)
>
> One rule governs the whole system: **the AI knows nothing on its own. It can only say what the graph backs with a source and a date.**

Working name: *Atlas* (final name and logo pending). Spanish docs for the team live in `docs/`.

## What it does

- **Ingests** seven open sources (Orphanet, HPO, Monarch, ClinVar, ClinicalTrials.gov, Open Targets, PubMed) plus curated patient organizations into a **property graph on Postgres** where *an edge without evidence cannot exist* (database trigger).
- **Answers** questions for three audiences through **voice agents with personality** (ElevenLabs): a Family Guide (free), a Clinical Analyst and a Research Analyst (B2B for the health sector).
- **Verifies** every sentence with a deterministic verifier: claims without an `evidence_id` returned by the tools in that turn are dropped and replaced by *"There is no evidence in our sources for that."*
- Surfaces **treatments and management documented in the literature**, active trials, research gaps, and the patient / researcher community for each disease.

```
sources ──ingest──▶ graph (entities · edges · evidence) ──tools──▶ agent ──▶ verifier ──▶ spoken answer + next steps
```

Full architecture with diagrams: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · data sources: [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) · research & business model: [`docs/RESEARCH.md`](docs/RESEARCH.md) · agents: [`docs/AGENTS.md`](docs/AGENTS.md).

## Stack

Next.js 16 (App Router) on Vercel · Supabase (Postgres + pgvector, Auth, RLS) · OpenAI / Claude for drafting · ElevenLabs Agents for voice · Blender → GLB for the 3D graph view (later).

## Quick start (VS Code)

```bash
git clone <repo> && cd rare-atlas
npm run setup            # copies .env.example → .env, installs, typechecks, lints
# 1. Fill .env with Supabase URL + keys (Project Settings → API)
# 2. Apply migrations: `supabase link --project-ref <ref> && npm run db:push`
#    or paste supabase/migrations/0001_graph.sql then 0002_users.sql in the SQL Editor.
npm run ingest           # loads the 5 demo diseases from the 7 sources (idempotent)
npm run dev              # http://localhost:3000  ·  /atlas  ·  /api/health
```

Without `OPENAI_API_KEY` the `/api/ask` endpoint runs in a deterministic demo mode built straight from the evidence, so the whole flow works end to end before any model key is set.

## Repo map

```
docs/                      architecture, data sources, research, agents (Mermaid diagrams render on GitHub)
supabase/migrations/       0001_graph.sql (graph + evidence trigger + RLS) · 0002_users.sql (orgs, conversations, consents)
supabase/seed/             diseases.json (5 monogenic demo diseases) · organizations.json
scripts/ingest/            graph.ts (idempotent writer) · sources/*.ts (one module per source) · index.ts (runner)
src/lib/graph.ts           read-only graph queries → { data, evidence[] }
src/lib/verifier.ts        deterministic verifier (+ tests)
src/lib/agents/profiles.ts the three agent personalities (behavior only, zero medical knowledge in prompts)
src/app/api/tools/[tool]   agent tools: disease · trials · treatments · literature · communities · gaps · phenotype-match
src/app/api/ask            retrieve → draft → verify → persist
src/app/                   landing with video slots · /atlas product UI
.github/workflows/         ci.yml (lint · test · build) · ingest.yml (daily graph refresh)
```

## Deploy

1. Push to GitHub → import the repo in Vercel (framework auto-detected, `vercel.json` sets function timeouts).
2. Add the variables from `.env.example` in Vercel → Project → Settings → Environment Variables.
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` as GitHub Actions secrets for the daily ingest.
4. In ElevenLabs, register `/api/tools/*` as server tools with header `x-atlas-key` = `ATLAS_TOOLS_KEY`.

## Scaling

The seed list becomes the output of Orphadata's classification endpoint (5,000+ monogenic diseases); ingestion is idempotent and queued (`ingest_jobs`, `FOR UPDATE SKIP LOCKED`); Postgres carries the graph to ~10M edges before a dedicated graph DB is worth it, behind the same tool contract. Multi-tenant B2B is already in the schema (`organizations`, `memberships`, RLS).

## Not medical advice

Every answer ends with a disclaimer and routes to a specialist. We never sell patient data; trial contact happens only with explicit consent (`trial_contact_consents`).
