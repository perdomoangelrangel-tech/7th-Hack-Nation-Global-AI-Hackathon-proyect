# Nexmed by Nedamex · Bitácora (shared team log)

Append-only. Protocol: docs/WORKFLOW.md §4. Times in CDMX.

## 16:50 · brain · START
- Foundation on `main` (prepared by the brain in the cloud): Rare Atlas explorer (4 personas, Louvain clusters, journey, edge inspector) + Nedamex Supabase backend (migrations 0001–0010, Edge Function `ingest`, live DB: 6 diseases / 784 entities / 972 edges / 1123 evidence) merged. Product name **Nexmed**, company **Nedamex** (`site.name` / `site.company`).
- Logo palette (light only, `--brand #3a86bf`), logo files in `public/brand/`, favicon.
- Seams: `loadAtlas()` + `src/lib/atlas/source.ts` (data), `src/lib/prefs` (a11y prefs), mount stubs `VoiceDock` (voice) and `CoCreate` (action) inside AtlasApp.
- Personas reordered + `mode` labels: Patient (devon) · Family & patient group (maria) · Researcher (osei) · Pharma (priya).
- Original codebases (read-only references, port code freely): `../nedamex`, `../rare-atlas`.
- Public Supabase URL + publishable key baked into `src/lib/supabase/config.ts` → localhost reads the live graph with zero config.
- User directives: logo colors, light UI (no dark backgrounds), prefer 3D animated elements, English UI, ElevenLabs voices for agents, Blender for 3D elements, OpenAI = only external model (key arrives after deploy).

## 17:05 · data · START
- Worktree `../nexmed-data` on `feat/data` was missing, so I created it from `main` @463ea75 (`git worktree add ../nexmed-data -b feat/data`). Port 3101.
- Plan: P0 migration 0011_nexmed (kind, pathway/investigator, proposals + submit_proposal, extractions + save_extraction, atlas_snapshot) → P0 loadFromSupabase() → P0 src/lib/atlas/analyze.ts + vitest → P1 20–30 disease slice + Reactome/investigators in ingest → P1 integrity → P1 `npm run snapshot` → P2 embeddings.

## 17:10 · explorer · START
- Worktree `../nexmed-explorer` on `feat/explorer` was missing, created from `main` @463ea75. Port 3103.
- Plan: P0 light re-skin of /atlas → 3D graph (react-force-graph-3d default, 2D fallback + toggle) → edge styles by kind + legend → EdgeInspector (links, contradicting, similarity) → mode selector → global search w/ synonym chips + `/` → P1 a11y panel, progressive reveal, proposals layer → P2 3D micro-interactions.

## 17:06 · action · START
- Worktree `../nexmed-action` on `feat/action` was missing, created from `main` @463ea75. Port 3105.
- Plan: P0 `src/lib/journey/` (4 questions + honest no-route, edge-cited) + `GET /api/journey` → P0 JourneyPanel v2 (progressive, mode-ordered, 390px) → P0 CoCreate dialog + `GET/POST /api/proposals` (RPC `submit_proposal`, in-memory fallback "saved locally (demo)") → P1 `/api/match` + outreach draft + TenX view → P2 `/plan`.
- Will consume data lane's `submit_proposal` / `proposals_public` per contract §3.1.

## 17:15 · voice · START
- Worktree `../nexmed-voice` on `feat/voice` was missing, created from `main` @463ea75 (same as data/explorer). Port 3104.
- Plan: P0 voice map `src/lib/voice/voices.ts` → `/api/speak` on ElevenLabs (cache, 503 → browser fallback) → narration (persona voice, captions, keys, aria-live) → 4 ElevenLabs agents via MCP (OpenAI LLM, server tools `/api/tools/*`) + `GET /api/voice/agents` → VoiceDock (`useConversation`) → P1 personalization panel + a11y (audio orb, reduced motion).
- Production URL is not in the brain's START yet: agents will be created with server tools pointing at a placeholder and repointed once the brain posts the URL. NEED(ai): tool list `CONTRACT` for `/api/tools/*`.

## 17:25 · data · BLOCKED
- `supabase/migrations/0011_nexmed.sql` is written and committed on `feat/data` (enum values pathway/investigator/participates_in/similar_to · `edges.kind` · sources reactome/nih_reporter/openai_extraction/nexmed_analysis/community · `proposals` + `submit_proposal(...)` + `proposals_public` (contact hidden by column grants) · `extractions` + `save_extraction(...)` · `atlas_version()`). Signatures exactly as WORKFLOW §3.1.
- The MCP `apply_migration` call to the live project was **declined**. NEED(human/brain): review the file and either approve the apply in my session or apply it yourself. It is additive only (no DROP/DELETE except `drop policy if exists` on the new tables).
- Not blocking the rest: the loader works against the current schema (missing `kind` column → defaults to `observed`; missing proposals/extractions → empty overlays).

## 23:10 · brain · START
- `main` @463ea75 verified green: typecheck ✓ · lint ✓ · test 4/4 ✓ · build ✓. Smoke on :3000: `/` 200 · `/atlas?d=disease:ORPHA:599373&p=maria` 200 · `/api/health` ok · `/api/atlas/stats` (9 diseases · 2,270 edges · 3 clusters, snapshot).
- Worktrees (all from main @463ea75, npm installed): data :3101 `../nexmed-data` · ai :3102 `../nexmed-ai` · explorer :3103 · voice :3104 · action :3105 · brand :3106 `../nexmed-brand` · QA :3007 `../nexmed-qa` (detached main). Reports → `../nexmed-shared/qa/`.
- Git config: `core.filemode=false` set for the repo (the tgz extraction flipped every file to 755 — that was the "104 modified files" noise).
- **ALL LANES: do NOT commit `package-lock.json`.** `npm install` on Windows drops the optional `@emnapi/*` wasm entries; committing that can break the Linux build on Vercel. If it shows modified: `git checkout -- package-lock.json`. Need a dependency → HANDOFF to brain.
- `../nedamex` history preserved on origin as `archive/nedamex`.
- PENDING (human): (1) `origin/main` moved to 8effc73 (rare-atlas push at 17:00) → our main is diverged; brain will NOT force-push; reconciliation awaiting human decision. (2) Vercel project `nexmed`: MCP create returned 403 and CLI is not logged in → waiting on human. **Prod URL: not yet** — voice lane keep the placeholder.
- Keys the human must still provide: OPENAI_API_KEY, ELEVENLABS_API_KEY, (optional) SUPABASE_SERVICE_ROLE_KEY → Vercel env (Production+Preview) and `.env.local` in the main checkout (brain copies to lanes).
- Re data BLOCKED (0011_nexmed.sql): brain reviewed it — additive, RLS on, contact hidden by column grants, definer funcs with empty search_path + limits + flood guard. Recommended for apply; awaiting human approval of the live apply. Keep building against the fallback.

## 17:11 · brand · START
- Worktree `../nexmed-brand` on `feat/brand` @463ea75. Port 3106. Blender 5.2.2 LTS found locally (`C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`) → headless `blender -b -P blender/*.py`, GPU RTX 4050.
- Plan: P0 Blender hero (helix from forest base dissolving into graph nodes) → `public/models/nexmed-hero.glb` (<2 MB, Draco/meshopt) + transparent poster PNG → P0 English landing (light, logo blues, 3D hero lazy + poster fallback, live counters) → P0 Logo/OG/manifest → P1 shared 3D primitives in `src/components/three/` (`Scene3D`, `HelixLoader`, `NodeOrb`, **`AgentOrb`** = Blender-made AI agent that animates idle/listening/speaking for the voice dock, **graph node glyphs** GLB per entity type for the explorer) → P1 DESIGN.md + token polish.
- Will announce `AgentOrb` / node glyphs with CONTRACT + HANDOFF NEED(voice) / NEED(explorer) so they can mount them (I do not edit their paths).

## 17:40 · data · CONTRACT
- `src/lib/atlas/types.ts` (additive): `EdgeKind` adds `"proposed"`; `SourceId` adds `fda`, `nexmed_analysis`, `community` (`atlas_analysis` kept as legacy); `AtlasSnapshot.proposals?: Proposal[]` (community drafts overlay, never evidence); `Analytics.counterexamples: Counterexample[]` with optional `kind: "same_symptoms_different_mechanism" | "same_gene_different_mechanism"`, `gene?`, `edges?`.
- `src/lib/atlas/analyze.ts`: `analyze(snapshot) → Analytics`, `withAnalytics(snapshot) → AtlasSnapshot` (pure, deterministic). Inferred `similar_to` evidence[0] now has `source: "nexmed_analysis"`; strings are English. Cluster `label_basis` explains the name with counts.
- `loadFromSupabase()` implemented. Entity ids `${type}:${canonical_id}` (live genes are `gene:HGNC:…`, bundled file uses `gene:SYMBOL:…` — don't hardcode gene ids). Live edge ids `edge:<uuid>`, evidence `ev:<uuid>`.
- **For ai lane (save_extraction → graph):** the loader turns each `payload.claims[i]` into a `kind:"extracted"` edge when `entity_ids[0]` (subject) and `entity_ids[1]` (object) are existing Entity ids and `relation` is one of the `Relation` values (not `similar_to`). Edge id `edge:x-<extraction uuid>-<i>`, props `{ needs_review:true, polarity, model, extraction_id }`, evidence = PubMed row (`PMID:<pmid>`, url, `quote` = claim.quote). Latest extraction per PMID wins.
- **For action lane:** proposals come back as `atlas().snap.proposals` (from `proposals_public`, no contact). Submit via `rpc("submit_proposal", {p_kind,p_title,p_body,p_persona,p_disease,p_entities,p_edges,p_contact})` → uuid. Only live once migration 0011 is applied (see BLOCKED above).
- Coverage guard: the live graph is used only when it contains every disease in `data/atlas.json`; today it has 5 vs 9 (no STXBP1), so the app keeps using the file until my P1 ingest lands. `NEXMED_DATA_SOURCE=file|supabase` forces either.

## 17:40 · data · HANDOFF
- NEED(brain): add to package.json scripts: `"analyze": "tsx scripts/analyze.ts"` and `"snapshot": "tsx scripts/snapshot.ts"` (the files exist on feat/data; `npm run analyze` currently has no script entry).

## 17:41 · data · PROGRESS — green checkpoint
- feat/data @ HEAD: `npm run typecheck && npm run lint && npm test (9/9) && npm run build` all pass. Safe to merge (no behavior change for the UI while the guard falls back to the file).
- Live read: 784 entities → snapshot in ~1.1 s (14 parallel requests). Next: P1 disease slice (25 diseases) + Reactome/investigators in the Edge Function.

## 17:16 · user-verifier · START
- Baseline QA on `main` @463ea75 at localhost:3007 (`../nexmed-qa`). Vercel: NOT RUN (no prod URL yet). Report: `qa/20261003-1713-report.md` · 25 PASS · 15 FAIL · 2 NOT RUN.
- Green: synonym search (SMEI→Dravet, Munc18-1→STXBP1), Maria STXBP1 journey (cluster → why → asset w/ "what differs" → collaborator → next step), 10/10 random edges sourced + dated + live links, `integrity.sql` all 0 + guard probe ok, keyboard path + focus, 390 px / 130 % text.
- Contract routes not merged yet (404, not filed as bugs): /api/journey, /api/explain, /api/proposals, /api/match, /api/voice/agents, /api/extract, /api/reconcile.
- I re-test after every MERGED entry.

## 17:16 · user-verifier · HANDOFF
- NEED(ai): QA-01 `/api/ask` answers about the wrong disease · steps: `POST /api/ask {"question":"Who else works on my mechanism? My gene is STXBP1","persona":"osei","locale":"en"}` (also with `"focus":"disease:ORPHA:599373"`) and `{"question":"Tell me about Zorblax-Kettering syndrome"}` · expected: STXBP1-DEE claims / honest "not in the atlas" (the no-match branch exists in route.ts L28) · actual: Rett (ORPHA:778) for STXBP1, FOXG1/Dravet for the made-up disease; `resolve()` matches stray words; contract field `focus` ignored (route reads `disease`) · evidence: qa/20261003-1713/api-checks.json, redteam.txt (unknown-en/es) · severity: major
- NEED(ai): QA-02 `/api/ask` shape ≠ contract §3.2: returns `claims[].evidence[]` objects, contract says `claims[].evidence_ids[]`, red-team script reads `claims[].citations` → align (and tell brain which one wins) · severity: minor
- NEED(brain): QA-03 `.claude/qa/redteam.mjs` reads `claims[].citations` (doesn't exist), so 10/10 fail as false positives, and the CURE regex flags the org name "KCNQ2 Cure Alliance". Update the script once QA-02 settles · severity: minor
- NEED(data): QA-04 Spanish text in English mode · steps: /atlas → STXBP1 → "Why the atlas connects them" · expected: English quote · actual: "Inferido (score 0.115): 8+ fenotipos compartidos (más informativos: …)"; also variant `call` "predominan variantes truncantes…", ClinVar quotes "631 variantes P/LP…", Reactome "FOXG1 participa en…", gap detail "No hay un registro de pacientes…" (from scripts/analyze.ts, ingest/sources/opentargets.ts, data/atlas.json) · screenshot: qa/20261003-1713/13-maria-edge-inspector.png · severity: major
- NEED(action): QA-05 Devon can't find a patient group for his exact diagnosis · steps: Patient mode → search "SMEI" → Dravet → People tab · expected: Dravet Syndrome Foundation / Dravet Syndrome European Federation (both in the graph, found by search) · actual: only sponsors and investigators; `/api/atlas/journey?d=disease:ORPHA:33069` collaborators have no organization · screenshot: qa/20261003-1713/26-devon-dravet-people.png · severity: major
- NEED(action): QA-06 "Propose a collaboration" missing (CoCreate stub), so journey 2 can't end in a ghost community draft · screenshot: 18-maria-propose.png · severity: major (P0 in your plan; I'll re-test on merge)
- NEED(action): QA-07 Priya mode shows no unmet need ("no approved treatment"), and the journey content/order is the same for all 4 modes · screenshot: 23-priya-journey.png · severity: minor
- NEED(brand): QA-08 landing `/` is entirely Spanish ("Cada respuesta rara, con su fuente.", "Probar el atlas"), still pitches "Tres públicos, tres voces" instead of the 4 modes, videos show "PENDIENTE" · expected: English, 4 modes · screenshot: 01-landing-desktop.png, 02-landing-full.png · severity: major
- NEED(brand): QA-09 no "Nedamex" anywhere on `/` (footer/legal) · screenshot: 02-landing-full.png · severity: major
- NEED(brand): QA-10 landing header logo renders as a dashed placeholder square (atlas header logo is fine) · screenshot: 01-landing-desktop.png · severity: minor
- NEED(explorer): QA-11 dark background · /atlas canvas uses `bg-[radial-gradient(…#13284a…#060c17)]` plus a dark veil (AtlasApp.tsx `<main>`) · expected: light UI with logo blues · screenshot: 12-maria-stxbp1.png, 07-devon-dravet.png · severity: major (your P0 re-skin)
- NEED(explorer): QA-12 mode selector shows persona names (Devon / Maria / Dr. Osei / Priya) instead of `mode` labels Patient · Family & patient group · Researcher · Pharma · screenshot: 12, 23 · severity: major
- NEED(explorer): QA-13 unknown term "Zorblax" in search gives a silently empty dropdown; expected an honest "not in the atlas" empty state · screenshot: 19-maria-no-route.png · severity: minor
- NEED(explorer): QA-14 no simple-language toggle (prefs panel) for Devon · severity: minor (your P1). Also a hydration-mismatch console warning on `/atlas?d=disease:ORPHA:599373` under reduced motion (24-reduced-motion.png) · minor
- NEED(voice): QA-15 the narration fallback label shown to patients is developer text that names the wrong provider: "Browser voice (add OPENAI_API_KEY for the real voice)" (string in i18n.ts `voice_browser`, explorer owns the file) · expected: "Browser voice — natural voice unavailable right now" · narration also autoplays by default ("Narrate when a disease is chosen" checked) · severity: minor

## 17:25 · action · CONTRACT + HANDOFF
- CONTRACT `GET /api/journey?d=&p=&l=` → Journey v2 `{ version:2, persona, order[], summary{connections,assets,people,next:{text,cite}}, connections{neighbors,counterexamples,none}, assets{own,reusable,treatments,neighbor_approved,none}, people{collaborators,none}, next{steps(2–4),later,none}, gaps, unmet_need, coverage, no_route, disclaimer }`. Every card has `cite:{edges[],evidence[],kinds[]}`; steps carry `owner` (patient_group|researcher|clinician|funder). `?q=<free text>` outside the atlas → `{kind:"no_route", no_route, coverage, atlas_diseases}` (HTTP 200). Types: `src/lib/journey/build.ts` (pure, no server-only — voice/ai may import it).
- HANDOFF NEED(explorer): in AtlasApp pass `persona={persona} locale={locale}` to `<JourneyPanel …/>` (both optional props now; until then the panel reads `?p=`/`?l=` from the URL). Props `j,t,onInspect,onHover,onFocusDisease` unchanged.

## 17:40 · action · PROGRESS · green checkpoint
- `feat/action` @6344ae5 — typecheck ✓ · lint ✓ · test 19/19 ✓ · build ✓. Ready to merge (P0 complete).
- P0 Journey v2 engine + `GET /api/journey` (see CONTRACT above). Maria/STXBP1: KCNQ2-DEE (inferred 0.12) + Dravet → NCT06967727 already enrolls STXBP1+Dravet → KCNQ2 register NCT04802135 reusable (eligibility/biology flagged) → Scott C Baraban / Weckhuysen S bridge → 4 owner-typed steps this week. Counterexample CDKL5. Free text outside the atlas → honest `no_route` with coverage + missing evidence.
- P0 JourneyPanel v2: mode-ordered 4-row summary, depth on click, hover lights cited edges, kind badges, 390 px ✓, no console errors.
- P0 CoCreate: 3 actions → dialog prefilled from the journey (disease, neighbor, asset, collaborator, cited edges) → `POST /api/proposals`. RPC `submit_proposal` is NOT live yet → drafts kept in server memory and labeled "Saved locally (demo)". Switches to Supabase automatically once 0011 is applied (no code change).
- CONTRACT `GET /api/proposals?d=` → `{ proposals: [{ id, kind, title, body, persona, disease, entities[], edges[], status, created_at, stored:"supabase"|"local", edge_kind:"proposed" }], sources }` (never a contact field). `POST` same body as RPC + `consent:boolean` (contact rejected without consent; unknown edge/entity ids dropped). After a save the browser fires `window` event `nexmed:proposal` (detail = proposal).
- HANDOFF NEED(explorer): ghost layer — render `GET /api/proposals?d=` as dashed ghost nodes/edges labeled "community draft — not evidence" (attach to `entities[]`), refetch on the `nexmed:proposal` event.
- Next: P1 `/api/match` + Suggested partners + intro draft, then TenX.
