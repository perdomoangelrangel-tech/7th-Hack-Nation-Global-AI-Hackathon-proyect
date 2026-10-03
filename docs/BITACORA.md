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

## 23:26 · brain · MERGED
- feat/data (f57d418…4b9cac6) → main @79eff5b. Verified on main: typecheck ✓ · lint ✓ (0 errors) · test 9/9 ✓ · build ✓.
- Answered data HANDOFF: `npm run analyze` and `npm run snapshot` scripts added on main.
- ALL LANES: `git merge main` to pick up the data contract (types.ts additive, analyze.ts, loader). Don't commit package-lock.json.
- user-verifier: please refresh `../nexmed-qa` (`git checkout --detach main`) and re-test. Localhost only — NOT pushed: origin/main is still diverged (awaiting human), no Vercel URL yet.
- QA-03 (redteam.mjs): brain will update it once ai settles QA-02 (`claims[].evidence_ids[]` per contract §3.2 wins unless ai posts a CONTRACT change).
- Not merged yet (no green checkpoint posted): voice (2 commits), action (2), brand (1). Post "green checkpoint" in PROGRESS when ready.
- Migration 0011 still NOT applied on live Supabase (awaiting human OK).

## 17:28 · user-verifier · PROGRESS
- Re-tested `main` @79eff5b (feat/data) on :3007 → `qa/20261003-1727-report.md`. Same as the baseline: 25 PASS · 15 FAIL · 2 NOT RUN. Nothing to VERIFY yet; QA-01…QA-15 remain open.
- NEED(data): QA-16 the 21-disease slice is not visible · steps: start dev, GET /api/atlas/stats · expected: 21 diseases from the new loader/analytics · actual: server logs `[atlas] live graph misses 4 bundled disease(s) (ORPHA:228346, 439218, 561854, 599373…): using data/atlas.json` → still 9 diseases · 2,270 edges · generated_at 22:25 (data/atlas.json not regenerated; live DB has 6 diseases). Run `npm run snapshot` once ingest lands, or ingest the slice live · evidence: qa/20261003-1727/api-checks.json · severity: major (graph-quality criterion; partly blocked on the human applying 0011)
- NEED(data): QA-17 evidence link unreachable: `edge:139874a2fc7b` (researches · patient_orgs) → https://www.louloufoundation.org resets the connection (curl 000 / ECONNRESET, www and apex) · expected: a working source link · severity: minor
- QA-04 (Spanish evidence quotes and variant calls in EN) still reproduces after the data merge: 13-maria-edge-inspector.png in qa/20261003-1727/.

## 18:25 · data · PROGRESS
- Merged main after MERGED 23:26 (clean). Thanks for the npm scripts.
- **Disease slice: 21 monogenic diseases, every id verified** (`scripts/resolve-seed.ts`: Orphadata preferred term + disease-causing gene, Monarch causal-gene fallback, HGNC cross-checked with genenames.org, MONDO via Monarch Orphanet mapping + Open Targets, OMIM exact mapping, ClinVar trait via MedGen). Channel/DEE: Dravet, KCNQ2-DEE, KCNT1-EIMFS · synaptic: STXBP1-DEE (`disease:ORPHA:599373` kept), SYNGAP1-DEE · chromatin: Rett, FOXG1, Angelman, CDKL5 · lysosomal: CLN2, CLN3, CLN8, Pompe, Fabry, Gaucher, NPC, MPS I, Krabbe, MLD · neuromuscular: SMA, Duchenne. Left out (no gene-specific ORPHAcode, not guessed): SCN2A-, SCN8A-, CACNA1A-DEE.
- Local ingest of all 21 into `data/atlas.json` running now (HPO enrichment step ~20 min left), then analyze → commit → green checkpoint. This is what the app will show offline/by default until the live DB has the slice.
- Edge Function upgraded on feat/data (Reactome pathways, NIH RePORTER investigators, per-disease ClinVar counts + `primary`, 21-disease generated seed via `scripts/build-edge-seed.ts`). **Not deployed: it writes `pathway`/`investigator` entities, so it needs 0011 first.** Still awaiting human OK for 0011 → then I deploy + trigger via pg_net.
- Integrity on live (read-only part of `.claude/qa/integrity.sql`): orphan_active_edges 0 · evidence_missing_url 0 · evidence_missing_external_id 0 · public_tables_without_rls 0 · anon_can_read_app_secrets 0 · info: 6 diseases (5 + retracted CLN8 leftover), 877 active edges, 1,123 evidence.
- QA-04 (NEED(data), Spanish strings): fixed at the source — analyze.ts strings (inferred quote, variant `call`, gaps, label_basis) are English; local ingest templates (ClinVar counts, Reactome "participates in", org site check) English. Visible in data once the refreshed `data/atlas.json` lands (next commit). `name_es` / `short_name_es` props stay for `l=es`.
- Docs: `docs/DATA_SOURCES.md` + `docs/ARCHITECTURE.md` rewritten in English.

## 17:35 · explorer · PROGRESS — green checkpoint
- feat/explorer @7c31881: `typecheck ✓ · lint ✓ · test 9/9 ✓ · build ✓`. Safe to merge.
- P0 done: light /atlas shell (tokens only, star field + navy canvas removed) · **3D graph default** (react-force-graph-3d, shapes by type, sprite labels, fly-to/framing above the narration bar, optional rotation, hover lift) with **2D fallback** (auto for reduced motion / prefs.reduceMotion / no WebGL / <768 px / low power) + visible 3D/2D toggle · edge styles by kind (observed solid · inferred dashed · extracted dotted · proposed ghost) + cross-cluster bridges, legend toggles · EdgeInspector (plain words, kind badge, PMID/NCT/ORPHA/HP/DOI links, confidence+basis, dates, contradicting, similarity + supporting edges) · mode selector with `PERSONAS[x].mode` labels (also on mobile), rail order per mode · search synonym chips + empty state + `/api/reconcile` fallback.
- P1 already in: accessibility panel (gear) editing `usePrefs()` · proposals layer (`GET /api/proposals?d=` → ghost "Draft:" nodes, kind `proposed`; parses `[...]` or `{proposals:[...]}` with `{id,title,kind?,body?,persona?,created_at?,entities?[]}`) · shareable `?e=<edgeId>` opens the inspector.
- Screenshots: `docs/qa/explorer/atlas-{empty,stxbp1,inspector}-{1440,390}.png`, `atlas-reduced-1440.png`. No horizontal scroll at 390 px.
- Answers to QA: QA-11 fixed (light canvas) · QA-12 fixed (mode labels + persona subtitle) · QA-13 fixed (honest "Nothing in the atlas matches" state) · QA-14 fixed (prefs panel with simple language etc.; remaining hydration warning is in NarrationBar → voice below) · QA-15 string changed in i18n to "Browser voice — natural voice unavailable right now"; narration autoplay now follows `prefs.autoRead` (default **off**). QA-05 root cause was in `store.ts` journey ranking (mine): the disease's own patient groups now always make the collaborators list (STXBP1 Foundation, Dravet Syndrome Foundation…). Left rail "Community" lists them from the graph for every mode.
- `prefs.autoRead` default changed to `false` (voice lane: read it for auto-speak).

## 17:36 · explorer · HANDOFF
- NEED(voice): `NarrationBar.tsx` is still dark (`bg-[#0a1424]/85`, `text-slate-100`, `bg-teal-2 text-[#062a26]`) on the new light canvas → please re-skin with tokens (white/`--brand-mist` card, `--brand-deep` play button, `text-ink`). Also the hydration mismatch under reduced motion comes from its `motion.button whileTap={reduce ? undefined : …}` (server renders `tabindex="0"`); use a fixed `whileTap` + `<MotionConfig reducedMotion="user">` (AtlasApp already wraps everything in one) · severity: major for the light-UI directive.
- NEED(voice): `useNarration` should send `simpleLanguage: usePrefs().prefs.simpleLanguage` (and rate `prefs.voiceRate`) to `/api/narrate` / `/api/speak`.
- NEED(ai): when `src/components/ai/{ExplainButton,ExtractPanel}.tsx` exist, post a CONTRACT with their props; I mount them in EdgeInspector (sources section). Expected: `<ExplainButton edgeIds persona locale simple />`, `<ExtractPanel pmid />`.
- NEED(action): I will pass `persona` + `locale` to `<JourneyPanel …/>` right after your branch is MERGED (passing them before would break typecheck on my branch). Also: JourneyPanel "inferred" chips use amber (`!border-amber`) — amber is reserved for gaps; inferred = dashed `--brand-deep` (see `KIND_STYLE` in `src/components/atlas/colors.ts`, `KindBadge` exported from `EdgeInspector.tsx` if you want to reuse it).
- NEED(brand): if you ship graph node glyph GLBs, keep them < 50 KB each; GraphCanvas3D builds procedural shapes today and can swap per type.

## 17:35 · ai · START
- Worktree `../nexmed-ai` on `feat/ai`, merged main @79eff5b (data contract). Port 3102. `OPENAI_API_KEY` not set → every feature ships with a deterministic fallback + mocked-OpenAI vitest.
- Plan: P0 `src/lib/ai/client.ts` (OPENAI_MODEL gpt-4o / OPENAI_MODEL_FAST gpt-4o-mini, zod → strict JSON Schema, timeout/retry, `mode` in every response) → P0 `POST /api/explain` + `<ExplainButton>` → P0 persona prompts (4 modes) → P0 `/api/ask` + `/api/narrate` on the new client (fixes QA-01 resolver + `focus`, QA-02 shape) + red-team script → P1 `/api/reconcile` → P1 `/api/extract` + `<ExtractPanel>` + `npm run extract` → P1 `/api/tools/*` CONTRACT for voice → P2 `<AskBox>`.
- QA-02 decision (per contract §3.2): `claims[].evidence_ids[]` wins; I'll keep `evidence[]` objects alongside as an additive field for the UI. Will post CONTRACT when it lands.

## 18:35 · voice · PROGRESS — green checkpoint
- `feat/voice` @7bb5484 (merged main @79eff5b, clean): typecheck ✓ · lint ✓ (0 errors; 1 warning is data's scripts/resolve-seed.ts) · test 20/20 ✓ · build ✓. **Ready to merge.** package-lock.json not committed.
- P0 voice map `src/lib/voice/voices.ts`: premade ElevenLabs voices (work with any key, no library add) — Patient=Sarah · Family=Matilda · Researcher=Daniel · Pharma=Bella, 2 alternates each. Narration TTS `eleven_multilingual_v2` (quality; latency hidden by prefetch + cache). Agents `eleven_flash_v2` (ElevenLabs requires turbo/flash v2 for English agents).
- P0 `POST /api/speak`: ElevenLabs streaming TTS, persona voice + settings, speed = prefs.voiceRate, sha256 LRU cache (40 MB), 503 without key / on 401·429 → browser speech. Verified: 503 + 400 on localhost; mocked ElevenLabs path in tests.
- P0 narration: `useNarration` + `NarrationBar` light re-skin, captions (prefs.captions), aria-live claim announcements, transcript (click to jump), prev/next, speed, space/←/→. Highlight contract (`current.nodes/edges`) unchanged. Verified at 1440: STXBP1 narration plays (browser fallback without key), cited nodes light up.
- P0 4 ElevenLabs agents (tag `nedamex`, LLM **gpt-4o-mini**, 6 server tools `nexmed_*` → `/api/tools/{disease,trials,treatments,literature,communities,gaps}`). Verified live from localhost: the Navigator connected over WebRTC, greeted with "…what connects STXBP1-DEE…" in the Matilda voice, gpt-4o-mini, dynamic vars arrived.
- P0 VoiceDock: "Talk to Nexmed", SDK lazy-loaded on click, mic-permission UX, live transcript/captions, mute/end, disease sent as dynamic vars + contextual update on switch, persona switch ends call, narration stops when a call starts. "Voice agent not configured" state when an id is off.
- P1 (done early): voice settings panel (voice per mode + preview, speed, captions, "read every answer aloud"), calm CSS orb (static under reduced motion).
- QA-15 fixed: fallback label now "Browser voice — natural voice unavailable right now" (NarrationBar uses voice copy, not i18n). Narration autoplay default is AtlasApp's "Narrate when a disease is chosen" checkbox (explorer); it only fires after a click, so no autoplay before a gesture.

## 18:35 · voice · CONTRACT
- `GET /api/voice/agents` → `{ agents:{devon,maria,osei,priya}: string|null, names, ttsAvailable }`. Defaults baked in `src/lib/voice/agents.ts` (public agents); `NEXT_PUBLIC_ELEVENLABS_AGENT_{PATIENT,FAMILY,RESEARCHER,PHARMA}` override, value `off` disables.
  - devon `agent_9301m41nb4xre85a4scph5fpbe2q` Nexmed · Patient Guide (voice EXAVITQu4vr4xnSDxMaL Sarah)
  - maria `agent_9801m420vwjcf5ctav4x33asvd2w` Nexmed · Family & Patient-Group Navigator (XrExE9yKIg1WjnnlVkGX Matilda) — new
  - osei `agent_2301m41nbtczeshvbyxaaknksgga` Nexmed · Research Analyst (onwK4e9ZLuTAKqWW03F9 Daniel)
  - priya `agent_6001m41nbk5redqsx3hj321mb4my` Nexmed · Pharma Scout (hpp4J3VqNfWAUOO0d1Us Bella)
  - Session dynamic variables (all required): `disease_name, disease_id, persona, locale`.
- `POST /api/speak` keeps §3.2 `{text,persona,locale}` + optional `voiceId` (must be one of the persona's options) and `rate` (0.8–1.2). Headers `x-voice-provider`, `x-voice-cache`.
- For ai/explorer (read answers aloud): `import { speakVerified, stopSpeaking } from "@/lib/voice/client"` → `speakVerified(verifiedText, {persona, locale, rate})` (ElevenLabs, browser fallback). Check `getVoicePrefs().readAnswers` from `@/lib/voice/prefs`. Window event `nexmed:voice-live` (`VOICE_LIVE_EVENT`) fires when a live call starts — stop any audio you play.
- ElevenLabs tools `nexmed_disease/trials/treatments/literature/communities/gaps` (ids tool_0801m420…, tool_8301…, tool_9801…, tool_3601…, tool_2601…, tool_5201…) point at the placeholder `https://nexmed.vercel.app` with **no auth header** (the API route accepts that while `ATLAS_TOOLS_KEY` is unset).

## 18:35 · voice · HANDOFF
- NEED(brain): when the prod URL exists, post it — I repoint the 6 ElevenLabs tools. For the `x-atlas-key` header: the human should create an ElevenLabs workspace **secret** (Agents → Secrets) holding the same value as Vercel `ATLAS_TOOLS_KEY`, and tell me its name; I attach it to the tools (I won't paste credentials). Until then leave `ATLAS_TOOLS_KEY` unset on Vercel or the agents' tool calls get 401.
- NEED(brain): Vercel env `ELEVENLABS_API_KEY` (server only) for /api/speak. The agent ids need no env (baked defaults).
- NEED(ai): if `/api/tools/*` changes (e.g. a verified `ask`/`explain` tool returning evidence_ids), post a CONTRACT and I add it to the agents.
- NEED(explorer): hydration mismatch on /atlas: sidebar evidence count renders "2270" on the server vs "2,270" on the client (toLocaleString in the `<aside>` footer `<p className="mt-auto …">`) → use a fixed locale (`toLocaleString("en-US")`). This is QA-14's warning.
- NEED(brand): when `AgentOrb` ships, post its props; I swap my CSS orb in `src/components/voice/AgentOrb.tsx`.

## 18:45 · explorer · PROGRESS — green checkpoint
- feat/explorer @e2d1c68 (merged main @79eff5b, clean): `typecheck ✓ · lint ✓ · test 14/14 ✓ · build ✓`. Ready to merge. package-lock.json not committed.
- Answered NEED(explorer) from voice: counters now `toLocaleString("en-US")` (hydration). Answered NEED(explorer) from action: ghost layer already consumes `GET /api/proposals?d=` (`{proposals:[…]}` shape matches), attaches to `entities[]` on screen (else the focus), and now refetches on `window` event `nexmed:proposal`. Clicking a draft opens a "Community draft — not evidence" panel.
- New since last checkpoint: keyboard/screen-reader path through the graph (focusable "Explore the graph" list of every edge → Enter opens the inspector), honest "No supported connection" overlay on the canvas when the journey has `honest_gap`, light graph tooltips. Verified with Playwright: `/` → "SMEI" → chip "“SMEI” → Dravet syndrome" → Enter opens Dravet; "zorblax" → "Nothing in the atlas matches"; keyboard list → inspector. Screenshots: `docs/qa/explorer/search-synonym-1440.png`, `search-empty-1440.png`, `keyboard-graph-list-1440.png`.
- After action is MERGED I pass `persona`/`locale` to JourneyPanel; after ai posts the ExplainButton/ExtractPanel CONTRACT I mount them.

## 18:55 · data · PROGRESS — green checkpoint
- feat/data @a1745a1: typecheck ✓ · lint ✓ (0 problems) · test 14/14 ✓ · build ✓. Dev :3101 `/api/atlas/stats` → **21 diseases · 38 genes · 590 phenotypes · 86 pathways · 1,050 studies · 690 papers · 1,314 investigators · 17 orgs · 183 treatments · 34 inferred · 5 clusters · 6,808 evidence** (source: file — live DB still has 5 diseases, guard keeps the file). Maria `/api/atlas/graph?d=disease:ORPHA:599373` + journey OK. `data/atlas.json` 6.7 MB.
- Computed clusters (Louvain, named by mechanism with `label_basis`): **Glycosphingolipid catabolism** (Fabry, Gaucher, Pompe, Krabbe, MLD, MPS I, NPC, SMA) · **Regulation of MECP2 expression and activity** (Rett, FOXG1, Angelman, CDKL5, SYNGAP1-DEE) · **Interaction between L1 and Ankyrins** (Dravet, KCNQ2-DEE, KCNT1-EIMFS, STXBP1-DEE) · **Increased neuronal autofluorescent lipopigment** (CLN2, CLN3, CLN8) · Duchenne (no close neighbor — no mechanism claimed). 174 cross-cluster bridges; counterexamples: KCNQ2-DEE ↔ CDKL5, CLN8 ↔ STXBP1/Dravet/EIMFS (same symptoms, no shared pathway).
- Answering QA-16 (NEED(data)): fixed by this checkpoint — the bundled snapshot now has the 21-disease slice.
- Answering QA-04: fixed — 0 Spanish evidence quotes in the new snapshot (checked programmatically); analytics strings English.
- Answering QA-17: louloufoundation.org and foxg1.org do not answer from our network (curl 000 even with a browser UA). The ingest already marks both orgs `site_verified: false`, and edgeDetail shows it as contradicting evidence ("site did not respond at last ingest"). I am NOT replacing the URL with an unverified one. NEED(human): if you know the current official URL, post it here and I'll re-ingest.
- Bug fixed on the way: "same gene, different mechanism" now fires only when both diseases' variant effect was measured on that same shared gene (it had mis-fired for EIMFS ↔ Dravet via secondary genes).
- Still waiting: 0011 apply (human) → then Edge Function deploy + live ingest of the slice so `source = supabase`.

## 17:55 · action · PROGRESS · green checkpoint
- `feat/action` @04f08bc (main merged @79eff5b) — typecheck ✓ · lint ✓ (0 errors; the 1 warning is data's scripts/resolve-seed.ts) · test 29/29 ✓ · build ✓. Ready to merge: P0 + P1 + P2 done.
- P1 `GET /api/match?d=&p=&l=&n=` → `{ partners:[{ id,name,kind,score,diseases,reasons:[{code,text,weight,edges,sources}],cite }], method }`. Our own patient group is excluded, and each reason cites edges. CoCreate shows "Suggested partners" (collapsed) → "Propose a collaboration" (prefilled) / "Draft an intro message" (templated, numbered sources, mailto/copy; uses `/api/explain` only if it returns mode "openai" with edge ids, otherwise template — currently 404 → template).
- P1 10× view (button "See the 10× route" in the journey): typical vs Nexmed route to "launch a shared natural-history study", animated timelines (static under reduced motion), every duration labeled assumption + rationale; the gain is claimed only on discovery (STXBP1: 12–24 months → 3–7 weeks, assumption); protocol/ethics are not shortened unless a study already enrolls the disease. Plus "what must be validated next".
- P2 `/plan?d=&p=&l=` (and `?q=`) printable one-page plan: route, owner-typed steps, milestone, gaps, numbered sources, disclaimer; honest no-route page.
- QA: QA-05 fixed (Patient mode: the disease's own patient groups first; Dravet → Dravet Syndrome European Federation/Foundation; test added) · QA-06 fixed (CoCreate live) · QA-07 fixed (Priya: own order + unmet-need table; every mode has its own order and step ranking). user-verifier please re-test after merge.
- Screenshots: `docs/qa/action/` (journey, next steps, CoCreate dialog + toast, 10×, plan, no-route @1440 & 390). No page errors.
- HANDOFF NEED(data): source display names in `snap.sources` are partly Spanish ("Organizaciones de pacientes (curado, sitio oficial)", "Reactome (vía Open Targets)"), and gap/counterexample `detail`/`why` and org evidence quotes ("sitio verificado") too. The journey re-words gaps/counterexamples in English, but source names and quotes show as-is in coverage, /plan and intro drafts. Please provide English names (keep `name_es` if you want).
- Still open: NEED(explorer) persona/locale props on JourneyPanel + ghost layer for `/api/proposals`. Proposals stay "saved locally (demo)" until migration 0011 is applied live.

## 19:10 · data · DONE (wave 1) — green checkpoint
- feat/data @fdcc3e5 (main merged in): typecheck ✓ · lint ✓ · test 14/14 ✓ · build ✓. Ready to merge.
- Since the 18:55 checkpoint: `.github/workflows/ingest.yml` now triggers the Edge Function per disease (secret `INGEST_KEY`), CI runs typecheck; local `npm run ingest -- --target=supabase` disabled (it keyed genes by SYMBOL and overwrote props → duplicates in the live DB); migration `0012_nexmed_cron.sql` (daily pg_cron for all 21 diseases) written, NOT applied.
- Delivered: 0011 schema (written) · loader `loadFromSupabase()` (~1 s, coverage guard) · pure `analyze()` + tests · 21 verified diseases · Edge Function Reactome/RePORTER/variant counts · `npm run snapshot` · bundled snapshot 21 diseases / 5 mechanism clusters / 34 inferred / 6,808 evidence · integrity on live all 0 · docs in English.
- **Left, all gated on the human:** (1) approve/apply `0011_nexmed.sql` then `0012_nexmed_cron.sql`; (2) then I deploy the Edge Function (`verify_jwt` stays off, key-checked) and trigger the 21 diseases via `private.invoke_ingest`, run integrity, `npm run snapshot` → `/api/atlas/stats` source = supabase; proposals/extractions go live for action/ai with no code change. (3) P2 embeddings not started: no `OPENAI_API_KEY` yet — will coordinate with ai lane when it lands.
- Ping me with NEED(data) for anything else.

## 18:05 · action · DONE
- `feat/action` @940c104 — typecheck ✓ · lint ✓ (0 errors) · test 29/29 ✓ · build ✓. Merge-ready; supersedes the 17:55 checkpoint.
- Re explorer NEED(action): inferred / "needs expert review" now dashed `--brand-deep`; amber only for gaps / no-route / errors. JourneyPanel already accepts optional `persona`/`locale` props, so you can pass them as soon as this merges.
- Delivered: P0 Journey v2 (`/api/journey`, honest no-route incl. free text), JourneyPanel v2, CoCreate (`/api/proposals`, consent-gated, local-demo fallback) · P1 `/api/match` + Suggested partners + sourced intro draft, 10× view · P2 `/plan`. Screenshots in `docs/qa/action/`.
- Not verifiable yet: Supabase persistence of drafts (needs migration 0011 applied live) · AI polish of the intro (needs ai `/api/explain`) · the graph ghost layer (explorer). I will `git merge main` and fix anything the user-verifier files after MERGED.

## 17:47 · brain · MERGED
- (Time fix: my earlier entries "23:26"/START were UTC; real CDMX ≈17:2x. Clock now 17:47 CDMX.)
- Merged → main: **data** @fdcc3e5 · **explorer** @e2d1c68 · **voice** @7bb5484. main @e81ee1b+bitácora: typecheck ✓ · lint ✓ · test 30/30 ✓ · build ✓.
- **action @04f08bc NOT merged (backed out)** — on combined main 3 tests fail in `src/lib/journey/journey.test.ts` because they hardcode the old 9-disease snapshot: L28 expects top neighbor `disease:ORPHA:439218` (KCNQ2-DEE), gets `293181` (EIMFS); L54 counterexample expectation false; L164 expects "KCNQ2 Cure Alliance" in the collaboration draft, gets "STXBP1 Foundation × Guerrini R around NCT06967727". NEED(action): `git merge main` (21-disease snapshot), make the tests assert properties (cited edges exist, kinds, ordering rules) instead of fixed ids from the snapshot, post a new green checkpoint.
- ALL LANES: `git merge main` now — data's 21-disease `data/atlas.json` (6.7 MB) changes clusters/neighbors; don't hardcode ids from the old 9-disease file.
- NEED(explorer) from action (persona/locale on JourneyPanel): wait for action's re-merge.
- Voice HANDOFFs noted: prod URL + `ATLAS_TOOLS_KEY` secret + `ELEVENLABS_API_KEY` are waiting on the human (Vercel project not created yet). Keep `ATLAS_TOOLS_KEY` unset on Vercel until voice attaches the ElevenLabs secret.
- data DONE: 0011/0012 apply still awaiting human OK. QA-17 (louloufoundation.org) → NEED(human) for official URL, low priority.
- user-verifier: refresh `../nexmed-qa` to main and re-test (QA-04/05?/11–16 should now pass for data/explorer/voice; QA-05–07 action pending). Localhost only — not pushed (origin/main still diverged).
