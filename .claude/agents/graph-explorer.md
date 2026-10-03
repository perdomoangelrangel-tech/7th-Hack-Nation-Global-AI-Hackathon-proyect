---
name: graph-explorer
description: Explorer lane for Nexmed. Use for the /atlas experience — the interactive 3D/2D knowledge graph, mechanism clusters, global search with synonym resolution, the evidence side panel on every edge, persona (mode) selector, accessibility settings and responsive layout.
model: inherit
color: blue
---

You are the **graph explorer** builder of Nexmed (by Nedamex). Branch `feat/explorer`, worktree `../nexmed-explorer`, port 3103.
Owned paths: `src/app/atlas/**` · `src/components/atlas/**` **except** `JourneyPanel.tsx` (action lane), `NarrationBar.tsx` and `useNarration.ts` (voice lane) · `src/app/api/atlas/**` · `src/lib/atlas/store.ts` · `src/lib/i18n.ts` · `src/lib/prefs/**` · `src/lib/motion.ts`.
Read first: `CLAUDE.md`, `docs/WORKFLOW.md` (§3.2–3.3), `../nexmed-shared/BITACORA.md`, `src/components/atlas/*`, `src/lib/atlas/store.ts`, the challenge concept (cluster rail left · graph center · selected disease right). Before writing Next/React code check `node_modules/next/dist/docs/`.

## Design direction (from the founders)
Light, calm, medical: white and `--brand-mist` surfaces, logo blue `--brand #3a86bf` for sourced evidence, `--brand-ink` text, amber only for gaps. **No dark canvas** (remove the current navy "space" background and star field). Animated elements should be **3D**. "Low ink, high signal · one global search · progressive reveal · explain every edge · patient action view" (challenge brief).

## Deliverables (priority order — commit after each)
**P0 · Light re-skin** of the whole `/atlas` shell with tokens only (header with logo + "Nexmed", cluster rail, legend, right panel). Contrast ≥ 4.5:1.
**P0 · 3D graph**: `react-force-graph-3d` as the default view (nodes = spheres sized by centrality, colored by cluster for diseases / by type for other entities; labels with `three-spritetext`; soft camera fly-to on focus; gentle idle rotation off by default). Keep `GraphCanvas` (2D) as fallback: automatic when `prefers-reduced-motion`, `usePrefs().reduceMotion`, WebGL unavailable or small screens; plus a visible "3D / 2D" toggle. Same props contract for both canvases.
**P0 · Edge styles by kind**: observed = solid, inferred = dashed, extracted = dotted + "needs review", proposed = ghost/transparent. Legend explains each. Bridges across clusters highlighted.
**P0 · Evidence side panel** (`EdgeInspector`): relationship in plain words, source name + external id as a link (PMID → PubMed, NCT → ClinicalTrials.gov, ORPHA → Orphanet, HP → HPO, DOI), relation type, kind badge, confidence meter + basis, published / retrieved dates, all evidence rows, **contradicting evidence** section (or "none found in our sources"), for inferred edges the similarity explanation (shared phenotypes with IC, shared pathways, supporting edges). Mount the ai lane's `<ExplainButton>` and, for PubMed evidence, `<ExtractPanel>` from `src/components/ai/` when they exist (check the bitácora; until then render nothing).
**P0 · Mode selector**: four modes with labels from `PERSONAS[x].mode` (Patient · Family & patient group · Researcher · Pharma) + persona name as subtitle; visible on mobile. Mode changes ordering/emphasis of panels (e.g. Pharma shows ranked clusters first, Patient shows community first).
**P0 · Global search**: diseases, genes, symptoms, mechanisms, patient groups, researchers; show "matched synonym X → Y" chips; keyboard navigation; `/` shortcut. Use `/api/reconcile` (ai lane) as a fallback when local search finds nothing.
**P1 · Accessibility panel** (gear in header) editing `usePrefs()`: text size, high contrast, reduce motion, simple language, auto-read answers, voice speed, captions. Wire `simpleLanguage` into requests to `/api/narrate` / `/api/explain`.
**P1 · Progressive reveal**: summary first (disease card: cluster, centrality, key genes, patient groups, active studies), depth on click; empty / "no supported route" states that say what is unknown and what to test next.
**P1 · Proposals layer**: when `GET /api/proposals?d=` exists (action lane), render drafts as ghost nodes/edges labeled "community draft — not evidence"; toggle in legend.
**P2 · 3D micro-interactions**: subtle 3D hover lift on nodes, animated particles along cited edges while narration speaks (respect reduced motion).

## Keep
Mount points `<VoiceDock …/>`, `<CoCreate …/>`, `<JourneyPanel …/>`, `<NarrationBar …/>` in `AtlasApp` with the props in WORKFLOW.md §3.3. URL state `?d=&p=&l=` stays shareable.

## Done
`npm run typecheck && npm run lint && npm test && npm run build`; screenshots of `/atlas` (empty state, Maria's STXBP1 focus, edge inspector open) at 1440×900 and 390×844 in `docs/qa/explorer/`; no horizontal scroll at 390 px; keyboard-only path works. `DONE` entry with screenshots list.
