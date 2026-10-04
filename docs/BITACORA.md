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

## 18:20 · action · PROGRESS · green checkpoint
- Merged main @fff52f4 (incl. my 04f08bc + data/explorer/voice). `feat/action` @c82233c — typecheck ✓ · lint ✓ (0 errors) · test 50/50 ✓ · build ✓. Two commits to merge: amber→brand-deep for inferred (explorer's design rule) and the 21-disease fixes below.
- On the new 21-disease slice, Maria/STXBP1 → KCNT1-EIMFS (inferred 0.13, strongest) · KCNQ2-DEE · Dravet · counterexample CLN8 → NCT06967727 (already STXBP1+Dravet) → KCNQ2 register NCT04802135 → Guerrini R (bridges STXBP1 + KCNT1). The reuse step now prefers the two closest neighbors (it had picked a Krabbe newborn-screening study). Tests no longer hard-code the slice.
- Note for demo script/voice: the lead neighbor is now **KCNT1 epilepsy (EIMFS)**, not KCNQ2-DEE, and KCNT1 has no patient organization in the data, so step 1 reads "Reach out to the KCNT1 epilepsy (EIMFS) community" without an org. NEED(data) (optional): a KCNT1 patient org, if a verified one exists.

## 18:15 · ai · CONTRACT
- `POST /api/ask { question, persona, locale, focus?, simple? }` → `{ claims:[{ text, evidence_ids[], evidence[], status, nodes[], edges[] }], dropped, mode:"openai"|"deterministic", model, disease, disease_name, resolved_via{mention,entity_id,type,method,matched_synonym}, notice, safety_flags[], spoken, verified, disclaimer }`. **QA-02 settled: `claims[].evidence_ids[]` is canonical** (`evidence[]` objects kept as additive). Legacy `disease` (=focus) and `audience` still accepted. Unknown disease → `disease:null, claims:[]` + honest message listing covered diseases (HTTP 200).
- `POST /api/narrate { disease, persona, locale, simple? }` → same as before plus `claims[].evidence_ids`, `simple`, `disclaimer`. **`mode` is now `"openai"|"deterministic"`** (was `"template"`; NarrationBar only checks `=== "openai"`, so no breakage).
- `POST /api/explain { edgeIds[], persona, locale, simple?, question? }` → `{ sentences:[{ text, edge_ids[], evidence_ids[], kind:"observed"|"inferred"|"extracted"|"gap" }], dropped, mode, model?, simple, unknown_edge_ids, skipped_edge_ids (community drafts never explained), spoken, disclaimer }`. 400 on empty edgeIds.
- Component **`<ExplainButton edgeIds persona locale simple? onHighlight? className? />`** from `src/components/ai/ExplainButton.tsx` (client; `simple` defaults to `usePrefs().prefs.simpleLanguage`; `onHighlight(edgeIds|null)` on hover/focus of a sentence). `<ExtractPanel pmid />` comes with P1 extract.
- Verifier (`src/lib/verifier.ts`): additive `unsafeReason()` (drops cited claims with doses / cure promises; graph names like "KCNQ2 Cure Alliance" allowed), `ensureHedged()`, `disclaimer(l)`; disclaimer text now "…not a diagnosis or medical advice…" (red-team regex still matches).
- `PERSONAS` (profiles.ts) additive: `firstQuestion`, `identifiers`, `isPersonaId()`, `SIMPLE`. Prompt builder `src/lib/agents/prompts.ts`.

## 18:15 · ai · PROGRESS — green checkpoint (pending build, see next entry)
- Answered **QA-01** (fixed): strict resolver `src/lib/ai/reconcile.ts#findDiseaseInText` — only canonical/exact/alias/normalized matches of diseases+genes, longest n-gram first, then rarity-weighted fuzzy over disease names; `focus` honored. STXBP1 question → STXBP1-DEE (Osei gets investigators first); Zorblax/Velmora → `claims:[]`.
- Answered **QA-02** (see CONTRACT). **QA-03**: I updated `.claude/qa/redteam.mjs` + `redteam.json` (persona instead of audience, reads `claims[].evidence_ids`, mode `deterministic`) — brain, nothing left to do. Red-team on :3102 → **10/10 pass** (deterministic mode).
- Answered explorer NEED (17:36): ExplainButton props above.
- curl (fallback mode, :3102): `curl -s localhost:3102/api/ask -H 'content-type: application/json' -d '{"question":"Who else works on my mechanism? My gene is STXBP1","persona":"osei","locale":"en"}'` → STXBP1-DEE, 7 cited claims · `curl -s localhost:3102/api/explain -H 'content-type: application/json' -d '{"edgeIds":["edge:2fca619fa2d4","edge:1ad03aa1c247"],"persona":"maria","locale":"en"}'` → 2 sentences (inferred one hedged "needs expert review").

## 17:53 · head-brain · CONTRACT
- **Architecture change from the founders — read `../nexmed-shared/ORDERS_WAVE2.md` now.** Vercel = website (narrated story + videos + 3D hero, every CTA → the Lovable program) + API backend `/api/*` (CORS for Lovable). Lovable = the Nexmed program (port of `/atlas` into the existing Lovable project, TanStack Start). Vercel `/atlas` stays as unlisted Plan B.
- Per-lane orders are in that file (brain, brand re-scope, voice narration + portability, ai, data, explorer → lovable-porter lead, action, user-verifier).
- Human decisions pending with the head brain: apply 0011 live · reconcile origin/main with `-s ours` · connect Lovable project to GitHub. Keep building; do not wait.

## 18:22 · ai · PROGRESS — green checkpoint
- `feat/ai` @9f93db6: typecheck ✓ · lint ✓ (0 errors; 1 warning in data's scripts/resolve-seed.ts) · test 43/43 ✓ · build ✓. **P0 complete, ready to merge** (merge order data → ai).
- P0: `src/lib/ai/client.ts` (gpt-4o / gpt-4o-mini, strict JSON Schema from zod, 30 s timeout, 1 retry, `mode` everywhere, injectable for tests) · `/api/explain` + `<ExplainButton>` · persona prompts (4 modes) · `/api/ask` + `/api/narrate` on the new client · verifier safety · red-team 10/10.
- Next: P1 `/api/reconcile` route, `/api/extract` + `<ExtractPanel>` + batch CLI, `/api/tools/*` CONTRACT for voice.

## 17:58 · user-verifier · PROGRESS
- Re-tested `main` @e81ee1b (data + explorer + voice) on :3007 → `qa/20261003-1747-report.md`. After manual review: 47 PASS · 5 FAIL · 2 NOT RUN (remaining FAILs are unmerged action/brand work).
- VERIFIED QA-04 (0 Spanish strings in EN: journey, ask, narrate, edge panel)
- VERIFIED QA-05 (Patient → Dravet → People shows Dravet Syndrome European Federation / Foundation)
- VERIFIED QA-11 (light canvas, 3D + 2D toggle) · VERIFIED QA-12 (mode labels with persona subtitle) · VERIFIED QA-13 ("Nothing in the atlas matches 'Zorblax'…")
- VERIFIED QA-14 simple-language toggle (gear → prefs, text changes). Hydration warning still reproduces on /atlas?d=disease:ORPHA:599373 → stays open for explorer (voice's diagnosis: sidebar `toLocaleString()`).
- VERIFIED QA-15 (fallback label "Browser voice — natural voice unavailable right now"; no autoplay)
- VERIFIED QA-16 (21 diseases · 5,915 edges · 5 clusters) · VERIFIED QA-17 (dead org site shown as contradicting evidence, not hidden)
- Voice dock: opens the mode-specific guide, clear "Microphone blocked" message, 4 agents from /api/voice/agents. Live conversation NOT RUN (needs mic + ELEVENLABS key + deployed tools URL).
- NEED(explorer): QA-18 perf regression · every /api/atlas/* call 500–860 ms (was 10–60 ms); the server logs `[atlas] live graph misses 16 bundled disease(s)… using data/atlas.json` on EVERY request, because `loadAtlas()` (store.ts L55) only caches source=supabase, so the file fallback re-reads Supabase each call; /atlas first load on 390 px = 4.4 s · expected: cache the fallback decision for the TTL · evidence: qa/20261003-1747/api-checks.json · severity: major (will be worse on Vercel cold starts)
- NEED(explorer): QA-19 3D labels oversized and overlapping at default zoom ("KCNQ2-DEE" over "FOXG1 syndrome", "STXBP1-DEE" hidden behind its node); idle "Listen to the atlas" subtitle says "Inferred — computed by the atlas, needs review" before anything plays · screenshot: qa/20261003-1747/12-maria-stxbp1.png, 19-maria-no-route.png · severity: minor
- Note for brain: until action/ai merge, the UI calls /api/proposals and /api/reconcile → 404s in the console (expected, not filed).

## 17:54 · brand · PROGRESS — green checkpoint
- `feat/brand` @c2bb7fb (main merged @79eff5b): typecheck ✓ · lint ✓ (0 errors) · test 9/9 ✓ · build ✓. Safe to merge.
- P0 Blender hero DONE: `blender/build_hero.py` (headless, Blender 5.2.2 local) → `public/models/nexmed-hero.glb` 285 KB (Draco, 44k tris, clips Intro + Idle) + `nexmed-hero.png` transparent Cycles poster + `blender/nexmed-hero.blend`. Helix grows from the logo forest on the cyanotype medallion and opens into the graph.
- P0 Landing `/` DONE in English (closes QA-08, QA-09, QA-10 → please VERIFY): hero "Rare disease, connected." + [Open the atlas] [See Maria's journey → /atlas?p=maria&d=disease:ORPHA:599373], 3D hero (poster is LCP, GLB lazy cross-fade, "Grow it again" replays the Blender growth), live counters from the snapshot, brief facts with source label, how it works, 4 modes → /atlas?p=…, edge-kind legend with 2 real edges read from the atlas, voice-guide preview, 10×, built with, footer "Nexmed is a product of Nedamex" + licenses + not medical advice. Screens: `docs/qa/brand/landing-{1440,390}-{hero,full,guide-speaking}.png`.
- Blender voice agent DONE: `blender/build_agent.py` → `public/models/nexmed-agent.glb` 122 KB (clips Appear/Idle/Listen/Think/Speak) + poster.

## 17:54 · brand · CONTRACT
- Shared 3D primitives in `src/components/three/` (all client, three.js code-split, each with a static fallback for reduced motion / low power / no WebGL):
  - `AgentOrb` — `import { AgentOrb } from "@/components/three/AgentOrb"` · props `{ state: "hidden"|"idle"|"listening"|"thinking"|"connecting"|"speaking"; size?: number (default 96, reads best ≥72); reduce?: boolean; getLevel?: () => number /*0..1 polled per frame*/; label?: string; className?: string }`. Superset of the voice lane's CSS orb props. `hidden` → plays Appear backwards then stops rendering; any other state → pops in (Blender Appear clip) and cross-fades Listen/Think/Speak.
  - `Scene3D` (shared canvas: transparent, brand lights, DPR ≤ 1.75, pauses off-screen) · `Hero3D` · `HelixLoader` (`<HelixLoader size={40} label="Loading…" />`, CSS 3D, no WebGL) · `NodeOrb` (`size, tone: brand|deep|light|ink, kind: observed|inferred|extracted|proposed`, CSS) · `useCan3D()` → `"pending"|"3d"|"static"`.
- Tokens added in `globals.css`: `--brand-light #8dbde3` (`text-/bg-/border-brand-light`), `--focus`, `--shadow-soft`, `.eyebrow`, `.mono`, `.display`, edge-kind strokes `.kind-observed|inferred|extracted|proposed`, global `:focus-visible` ring, `[data-motion="reduce"]` now stops CSS animations/transitions app-wide. Fonts: `--font-sans` = Atkinson Hyperlegible, `--font-serif`/`--font-display` = Fraunces, `--font-mono` = Atkinson Hyperlegible Mono (`next/font`, set on `<html>` in layout.tsx). Existing tokens unchanged.

## 17:54 · brand · HANDOFF
- NEED(voice): the user asked that "when the voice pops up, the animations appear". Please swap your CSS orb for the Blender one in VoiceDock: `<AgentOrb state={!live ? "hidden" : status==="connecting" ? "connecting" : isSpeaking ? "speaking" : "listening"} size={88} reduce={prefs.reduceMotion} getLevel={() => isSpeaking ? conversation.getOutputVolume() : conversation.getInputVolume()} />` (keep a visible label next to it; the orb is aria-hidden without `label`). Same idea for NarrationBar while narration plays (`state="speaking"`, `getLevel` optional — without it the Blender Speak clip still animates). Ping me if you need other sizes/states.
- NEED(explorer): `src/lib/prefs/index.tsx` never restores saved prefs: the persist effect runs on mount with DEFAULT_PREFS and overwrites localStorage before the rAF hydrate reads it (repro: set reduceMotion, reload → back to defaults). Fix: skip the first persist until hydrated (e.g. a `hydrated` ref). Also available for the graph: `NodeOrb`/`HelixLoader`; Blender node glyphs per entity type are next (I'll post a CONTRACT).

## 18:02 · brand · CONTRACT + PROGRESS — green checkpoint
- `feat/brand` @HEAD (main merged @fff52f4+): typecheck ✓ · lint ✓ (0 errors) · test 33/33 ✓ · build ✓. Ready to merge (4 commits since @c2bb7fb: agent petals, glyphs, merge).
- CONTRACT graph glyphs (Blender): `public/models/nexmed-glyphs.glb` 124 KB total (~12 KB/glyph, 6.4k tris for all 10, no Draco) built by `blender/build_glyphs.py`. `import { loadGlyphGeometries, useGlyphGeometries, GLYPH_TYPES } from "@/components/three/glyphs"` → `Partial<Record<EntityType, THREE.BufferGeometry>>`, each centred, bounding radius 1, smooth normals, no material (use your `MeshLambertMaterial` + `TYPE_COLOR`). disease = cell (sphere + band) · gene = double helix · variant = crystal · phenotype = drop · pathway = cycle ring · trial = flask · study = paper · treatment = capsule · organization = group of 3 people · investigator = person. Preview: `public/models/nexmed-glyphs.png`.
- HANDOFF NEED(explorer): in GraphCanvas3D `shared.geo`, merge the glyphs over your primitives once loaded, e.g. `loadGlyphGeometries().then(g => Object.assign(shared.geo, g))` before building nodes (or `useGlyphGeometries()` and rebuild `nodeThreeObject` when it resolves). Scale = your current `base` radius. Keep your sphere as fallback.
- Agent clips + glyphs + hero are covered by `src/components/three/glyphs.test.ts` (budgets, clip names, rest-pose regression).

## 18:03 · ai · CONTRACT
- (Time fix: my 18:15 / 18:22 entries were really ≈17:50 CDMX.)
- **`/api/tools/[tool]` for voice** (GET, header `x-atlas-key` = `ATLAS_TOOLS_KEY` when set; every reply `{ data, evidence[], retrieved_at, note? }`; unknown disease → `{ data:null, evidence:[], note:"That disease is not in the atlas. Say so; do not guess." }` HTTP 200). `q` = disease name / synonym / ORPHA or MONDO id / entity id / gene symbol, now resolved with the **strict** resolver (same as /api/ask — no more nearest-looking disease). Existing 6 tools unchanged in params, so the agents keep working:
  - `disease?q=` profile (genes, phenotypes, neighbors) · `trials?q=&country=` · `treatments?q=` · `literature?q=&limit=15` · `communities?q=` (**this diagnosis' own patient groups first**, then umbrella orgs, then research groups) · `gaps?q=` · `phenotype-match?hpo=HP:…,HP:…`
  - **new** `neighbors?q=&limit=6` → `{ disease, neighbors:[{ disease_id, disease, score, kind:"inferred", edge_id, same_cluster, shared_phenotypes[], shared_pathways[], variant_effect_match, evidence_ids[] }], wording }`
  - **new** `cluster?q=` → `{ disease, cluster:{ id,label,label_basis,diseases[],shared_pathways[],shared_phenotypes[] }, links[], counterexamples[], unmet_need[], wording }`
  - **new** `explain_path?edges=edge:a,edge:b&persona=maria&locale=en&simple=1` → `data` = the /api/explain response (verified sentences with edge_ids/evidence_ids)
  - **new** `resolve?q=` → `data` = reconcile match `{ entity_id|null, label, type, method, confidence, matched_synonym, candidates[] }` (never guesses)
  - NEED(voice): add `nexmed_neighbors`, `nexmed_cluster`, `nexmed_explain_path` (and optionally `nexmed_resolve`) server tools to the 4 agents when you repoint to the prod URL. Suggested descriptions: "Diseases the atlas links to this one by shared mechanism (inferred — say 'the atlas suggests')", "The mechanism cluster, members, counterexamples and unmet need", "Plain-language verified explanation of graph edges".
- **`POST /api/reconcile { names[≤50], type? }`** → `{ matches:[{ name, entity_id|null, canonical_id|null, label, type, method:"canonical_id"|"exact"|"alias"|"normalized"|"fuzzy"|"llm"|"none", confidence, matched_synonym, candidates[{entity_id,canonical_id,label,type,score}] }], mode, model? }`. The model only breaks ambiguous fuzzy ties among the listed candidates.
- **`POST /api/extract { pmid? | text (≥40 chars), title?, save? }`** → `{ source:{pmid,url,title}, entities:[{ mention,type,entity_id|null,canonical_id|null,label,match:"exact"|"alias"|"fuzzy"|"llm"|"new",confidence }], claims:[{ subject, relation, object, polarity:"supports"|"contradicts", quote (verbatim from the abstract), confidence, entity_ids:[subj,obj], graphable }], dropped[], saved, save_note?, extraction_id?, mode, model? }`. 400 bad body/PMID · 404 no abstract · 502 PubMed down. Persists via `save_extraction` **only in openai mode** (dictionary fallback is never saved).
- **Components (portable, no Next-only imports; types from `src/lib/ai/contract.ts`):** `<ExplainButton edgeIds persona locale simple? onHighlight? className? apiBase? />` · **`<ExtractPanel pmid locale? onExtracted? className? apiBase? />`** (pass the PubMed `external_id`, e.g. `PMID:27905812`). `apiBase` = API origin when mounted in the Lovable program (default same origin). Lovable port: copy `src/components/ai/*` + `src/lib/ai/contract.ts` (+ `src/lib/prefs`, already in the port list).
- NEED(explorer): mount both in EdgeInspector sources: `<ExplainButton edgeIds={[d.edge.id]} persona={persona} locale={locale} onHighlight={…} />` and, for `ev.source === "pubmed"`, `<ExtractPanel pmid={ev.external_id} locale={locale} />`.

## 18:04 · ai · HANDOFF
- NEED(brain): package.json script `"extract": "tsx --conditions=react-server src/lib/ai/cli/extract.ts"` (batch over PubMed papers in the graph, idempotent by PMID, `-- --limit 40 [--dry-run]`; exits 1 without OPENAI_API_KEY). `--conditions=react-server` is needed because the store imports `server-only`.

## 18:07 · brain · MERGED
- Merged → main: **ai** @9f93db6 · **action** @c82233c · **brand** @94c44e5 (on top of data/explorer/voice). All six lanes now in main.
- Verified on main: typecheck ✓ · lint ✓ · test 87/87 ✓ · build ✓ · `next start` smoke: `/`, `/atlas?d=disease:ORPHA:599373&p=maria`, `/plan`, `/api/{atlas/stats,journey,match,proposals,voice/agents,explain}` all 200 · `/api/speak` 503 (no key → browser fallback, by design) · **red-team 10/10 pass** (deterministic mode).
- Confirmed QA-18 (explorer): API calls 0.7–0.8 s on prod build because the file fallback re-reads Supabase every request → NEED(explorer) stays open, priority before Vercel.
- Not merged (no checkpoint for these commits yet): explorer @76746dd (+3), ai @b8354aa (+P1), brand d2d99f2 (DESIGN.md). Post a checkpoint and I merge next tick.
- NEED(explorer): after merging main, pass `persona`/`locale` to JourneyPanel (action is in main now) and mount `<ExplainButton>` (ai CONTRACT 18:15).
- NEED(voice): brand's AgentOrb CONTRACT (17:54) is in main → swap the CSS orb.
- ORDERS_WAVE2 (head-brain): acknowledged; the brain is waiting for the human's confirmation of the Lovable re-scope before adding CORS/`programUrl`. Origin reconciliation + 0011 + Vercel still awaiting the human. NOT pushed.
- user-verifier: refresh `../nexmed-qa` (`git checkout --detach main`) and re-test, especially QA-06/07 (action), QA-08/09/10 (brand), QA-01/02/03 (ai).

## 18:07 · ai · DONE — green checkpoint
- `feat/ai` @397bafa (main @2e965c2 merged in, clean): typecheck ✓ · lint ✓ (0 problems) · test **100/100** ✓ · build ✓ · red-team on `next start` :3102 **10/10** (deterministic mode). **Ready to merge** (order data → ai → …). package-lock.json not committed.
- Delivered: P0 client (`src/lib/ai/client.ts`) · `/api/explain` + `<ExplainButton>` · persona prompts (4 modes, `prompts.ts`) · `/api/ask` (QA-01/02 fixed) + `/api/narrate` · verifier safety · P1 `/api/reconcile` · `/api/extract` + `<ExtractPanel>` + batch CLI · `/api/tools` (+neighbors, cluster, explain_path, resolve) · P2 `<AskBox persona locale focus? simple? onHighlight? onFocusDisease? apiBase? />`. All three components portable for Lovable (`apiBase`, types in `src/lib/ai/contract.ts`). Screenshots `docs/qa/ai/ai-components-{1440,390}.png` (no overflow, no console errors).
- curl (fallback mode): `curl -s localhost:3102/api/reconcile -H 'content-type: application/json' -d '{"names":["SMEI","Munc18-1","Batten disease","Zorblax"]}'` → Dravet (alias) · STXBP1 (alias) · CLN3 (normalized) · none · `curl -s localhost:3102/api/extract -H 'content-type: application/json' -d '{"pmid":"27905812"}'` → real NCBI abstract, 17 reconciled entities, 3 claims, "not saved: deterministic dictionary pass" · `curl -s 'localhost:3102/api/tools/neighbors?q=STXBP1'` → KCNT1-EIMFS first, inferred, cited.
- **To test once OPENAI_API_KEY is set** (Vercel env + `.env.local`; optional `OPENAI_MODEL`/`OPENAI_MODEL_FAST`):
  1. `/api/health` openai_env "set"; `/api/explain`, `/api/narrate`, `/api/ask` return `mode:"openai"` + `model`; `dropped` stays small (if a model sentence is dropped, read the reason).
  2. `node .claude/qa/redteam.mjs <url>` → 10/10 with mode openai (doses / cure / prognosis / PII / injection / unknown disease).
  3. Persona tone: same disease (STXBP1) in the 4 modes reads differently (Devon: community first, plain; Maria: connection→asset→collaborator→step; Osei: mechanism + counterexample + evidence; Priya: cluster + unmet need); `simple:true` reads at ~grade 6.
  4. Inferred sentences always hedged ("suggests"/"needs expert review") — `ensureHedged` appends a marker if the model forgets.
  5. `/api/reconcile` with ambiguous names (e.g. "neuronal ceroid lipofuscinosis") → `method:"llm"` picks only a listed candidate.
  6. `/api/extract {"pmid":"27905812"}` → `mode:"openai"`, verbatim quotes, `graphable` claims; with migration 0011 applied → `saved:true` + `extraction_id`, then (after the 5-min loader cache) the edge appears dotted "extracted" in the graph. Without 0011: `save_note` shows the RPC error (expected).
  7. `npm run extract -- --limit 40` (after brain adds the script) — idempotent re-run processes 0 papers.
  8. Latency: explain ≤ ~5 s (gpt-4o-mini for ≤3 edges), narrate/ask ≤ ~10 s; on timeout (30 s) answers fall back to deterministic, never fail.
- Open handoffs: NEED(brain) `extract` npm script · NEED(explorer) mount ExplainButton/ExtractPanel (and optionally AskBox) · NEED(voice) add the 4 new tools when repointing to prod. I'll `git merge main` after each MERGED and fix whatever user-verifier files.

## 18:30 · explorer · PROGRESS — green checkpoint
- feat/explorer @HEAD (merged main incl. action + ai, clean): `typecheck ✓ · lint ✓ · test 87/87 ✓ · build ✓`. Ready to merge. package-lock.json not committed.
- **QA-18 fixed** (store.ts `loadAtlas`): the live-vs-file decision is cached for the 5-min TTL either way and concurrent requests share one in-flight load. Measured on :3103: first call 1.09 s (cold), then 0.021–0.031 s. 
- **QA-19 fixed** (3D labels): constant on-screen size (`sizeAttenuation:false`, ~13 px diseases / ~11 px others), drawn on top of spheres (`depthTest:false`), anchored under the node — no more giant/overlapping or hidden labels. 3D framing now follows the focus + its direct neighbors on the 21-disease graph. The idle "Listen to the atlas" subtitle is NarrationBar → voice below.
- **Prefs restore fixed** (brand's NEED): persist effect skips until hydrated; verified reduceMotion survives reload.
- NEED(action) done: `persona`/`locale` passed to JourneyPanel. NEED(ai) done: `<ExplainButton edgeIds={[edge]} persona locale onHighlight>` mounted in EdgeInspector (hovering a sentence lights its edges in the graph); verified deterministic explanation renders (`docs/qa/explorer/inspector-explain-1440.png`). `<ExtractPanel>` is not on main yet → I mount it for `pubmed` evidence once it is.
- Screenshots refreshed in `docs/qa/explorer/`.

## 18:31 · explorer · HANDOFF
- NEED(voice): (1) hydration mismatch under reduced motion still comes from NarrationBar's play `motion.button` (server renders `tabindex="0"`, see qa `hyd` diff) — keep `whileTap` fixed and let `MotionConfig` handle reduced motion; (2) QA-19 part 2: the idle subtitle "Inferred — computed by the atlas, needs review" shows before anything plays — show it only for the current claim; (3) the floating "Talk to Nexmed" pill covers the bottom of the right panel (disclaimer / inspector last rows) at 1440 — dock it inside the panel header or add bottom padding.
- NEED(brand): glyph geometries — I'll merge them over my primitives as you suggested once the loader is on main (post the CONTRACT path).

## 18:10 · brand · PROGRESS — green checkpoint
- `feat/brand` @c7cb227: typecheck ✓ · lint ✓ (0 errors) · test 33/33 ✓ · build ✓ (main merged). **NEED(brain): please merge feat/brand** — voice (AgentOrb) and explorer (glyph loader `src/components/three/glyphs.ts`) are waiting for it on main.
- New since last checkpoint: OG image (`src/app/opengraph-image.tsx`, Blender poster + wordmark, 1200×630) + `public/site.webmanifest` (linked from layout metadata) · `DESIGN.md` (tokens, evidence grammar, type, motion, 3D rules + budgets, a11y, banned) · landing section **"Inside the atlas"**: a real STXBP1 neighbourhood from the snapshot (gene + pathways/variants, 4 inferred neighbours dashed, trials, papers, patient groups, symptoms, researchers) drawn in 3D with the Blender glyphs, hover = name + lit edges, flat SVG fallback.
- Screens: `docs/qa/brand/landing-1440-{hero,full,guide-speaking,inside-atlas}.png`, `landing-390-{hero,full,guide-speaking}.png`. Blender renders: `public/models/nexmed-{hero,agent,glyphs}.png`.
- Thanks explorer for the prefs fix. Next: landing polish (how-it-works diagram in 3D), mobile pass, help voice/explorer integrate once merged.

## 18:20 · user-verifier · PROGRESS
- Re-tested `main` @8fed86a (all six lanes) on :3007 → `qa/20261003-1807-report.md`. Every journey step PASS except the minor items below; red-team ✓ 10/10 (deterministic).
- VERIFIED QA-01 (STXBP1 question → STXBP1-DEE; made-up disease → "I could not find… so I won't guess", 0 claims; `focus` honoured)
- VERIFIED QA-02 (`claims[].evidence_ids[]`) · VERIFIED QA-03 (redteam.mjs 10/10)
- VERIFIED QA-06 (Propose a collaboration → "community draft — not evidence" → POST /api/proposals 201 → listed under Community drafts)
- VERIFIED QA-07 (Pharma: own order, clusters ranked by centrality, unmet-need table in step 1)
- VERIFIED QA-08 (English landing, 4 modes, 3D hero) · VERIFIED QA-09 (Nedamex in footer) · VERIFIED QA-10 (logo renders)
- NEED(brain): QA-20 dead provenance link on every inferred edge · `GET /api/atlas/edge?id=edge:2fca619fa2d4` → evidence `atlas_analysis` url `https://github.com/perdomoangelrangel-tech/7th-Hack-Nation-Global-AI-Hackathon-proyect/blob/main/src/lib/atlas/analyze.ts` → 404 (origin/main is still the old history). Expected: resolves once main is pushed/reconciled. Re-check after push · severity: major (judges will click it)
- NEED(brand): QA-21 landing at 390 px is 393 px wide: the "The problem" section (`p.eyebrow`, `h2.display`, `ul.mt-8 space-y-4`) overflows by 3 px → horizontal scroll · screenshot qa/20261003-1807/03-landing-mobile.png · severity: minor
- NEED(data): QA-22 my journey-2 test saved a real community draft to live Supabase: proposal id `87633c5a-69f8-48fe-8ca9-94aa22cc2574`, title "QA test draft — STXBP1-DEE × KCNT1 natural history collaboration (user-verifier, please ignore)", contact qa@example.org. It now shows under "Community drafts for this disease (1)" on STXBP1-DEE. Please delete it (I don't write to the product DB). From now on I test proposals only with the in-memory fallback or will ask first · severity: minor
- NEED(explorer): QA-23 the UI calls `/api/reconcile` (404 until ai P1 merges) → console error on search · either guard the call or merge ai P1 · severity: minor
- Still open: QA-14 hydration warning · QA-18 perf (explorer) · QA-19 3D labels (explorer).

## 18:15 · head-brain · DECISIONS (human approved)
- **Migration 0011 is LIVE** on Supabase (applied by the head brain as 4 parts: `0011a_nexmed_enums`, `0011b_nexmed_kind_sources`, `0011c_nexmed_proposals`, `0011d_nexmed_extractions_version`; same SQL as `supabase/migrations/0011_nexmed.sql`, only `drop policy if exists` replaced by a guarded `create policy` because the MCP blocks DROP). Checks: orphan_active_edges 0 · tables without RLS 0 · anon cannot read `proposals.contact` · anon cannot insert directly · anon can execute `submit_proposal` / `save_extraction` (intended) · 972 edges kind=observed · `atlas_version()` ok.
  - NEED(data): go — deploy the Edge Function, live-ingest the 21 diseases via pg_net, integrity, `npm run snapshot`; then apply 0012 (cron) yourself. Keep the repo file as is (document the 4-part apply in DATA_SOURCES).
  - action / ai: `submit_proposal` and `save_extraction` are live — drafts and extractions now persist in Supabase.
- **GitHub: approved.** NEED(brain): `git fetch origin && git merge -s ours origin/main -m "Merge origin/main (rare-atlas push 17:00) — superseded by Nexmed"` then `git push origin main` (no force). Then merge feat/action.
- **Vercel:** the head brain also gets 403 creating projects in team perdomoangelrangel-techs-projects → only the team owner (Ángel) can create it. The human will import the repo in the Vercel dashboard (Framework Next.js, branch main, no env needed besides OPENAI_MODEL=gpt-4o, OPENAI_MODEL_FAST=gpt-4o-mini, NEXT_PUBLIC_PROGRAM_URL). Brain: post the prod URL when it appears.
- **Lovable: approved — GitHub sync + agents.** The human (Ángel's account) connects project "Nedamex Navigator" (id 4ce45bdb-819e-4682-9078-2fbe7d11465e, TanStack Start) to GitHub and posts `CONTRACT lovable-repo`. explorer = lovable-porter lead per ORDERS_WAVE2.md; start the prep (docs/LOVABLE_PORT.md) now.

## 00:20 · explorer · PROGRESS — green checkpoint + Lovable prep
- feat/explorer @0d305de: typecheck ✓ · lint ✓ · test 87/87 ✓ · build ✓. Ready to merge.
- QA-23 fixed: the reconcile fallback now runs **server-side** inside `/api/atlas/search` (no browser call to `/api/reconcile`, so no 404 in the console; works automatically once ai's route is on main).
- Lovable porter (lead) prep done: `docs/LOVABLE_PORT.md` (target inspected read-only via the Lovable API: TanStack Start 1.168 + SSR, Vite 8, Bun, zod 3, shadcn; root layout wraps pages in max-w-6xl → atlas gets a full-bleed `_app` layout, research pages move to `/research` under `_research`). File map, Next→TanStack replacements (`next/dynamic ssr:false` → `lazy` + `ClientOnly`), deps to add (three, react-force-graph-2d/3d, three-spritetext, motion, @elevenlabs/react), routes, order of work, risks (SSR imports, CORS → Vite proxy until brain's CORS, bundle size).
- Explorer components already portable for it: every fetch goes through `src/components/atlas/api.ts` → `api(path)` (base `NEXT_PUBLIC_NEXMED_API_URL`, `""` on Vercel).
- Waiting on: `CONTRACT lovable-repo` (human) to clone `../nexmed-lovable`. NEED(action): read §3/§6 of docs/LOVABLE_PORT.md — you own journey/cocreate/plan there. NEED(voice)/NEED(ai): components must accept `apiBase` (ai already does); voice please confirm.

## 00:22 · brand · PROGRESS — green checkpoint (wave 2)
- `feat/brand` @9cd595c (main @8fed86a merged): typecheck ✓ · lint ✓ (0 errors) · test 87/87 ✓ · build ✓. Ready to merge.
- QA-21 (390 px overflow) fixed: grid children `min-w-0`, long ids wrap → scrollWidth 390 at 390 px. Please VERIFY.
- Wave-2 website: every CTA (nav, hero, Maria, mode cards, "Explore it", footer) → `site.programUrl` via `programHref("/atlas?p=…&d=…")`. **CONTRACT: I added `site.programUrl` (env `NEXT_PUBLIC_PROGRAM_URL`, default `https://nedamex-research.lovable.app`) and `programHref()` in `src/lib/site.ts` (my file) — brain, no need to add it; just set the env.** Plan B `/atlas` untouched.
- Videos section: `NEXT_PUBLIC_VIDEO_{DEMO,TECH,TEAM}` if set, else `public/videos/{Demo60,Tech60,Team60}-draft.mp4` with posters + "Draft" label. Team section: `site.team` with [Name]/[Role] placeholders — humans: send names/roles and I fill them.
- Growth replay polished (edges reveal after their nodes). Screens: `docs/qa/brand/landing-1440-videos.png`, `hero-grow-replay-1440.png`, `landing-390-inside-atlas.png`.
- CONTRACT (portability): `src/components/three/*` used by the voice dock (AgentOrb, AgentCanvas, AgentModel, Scene3D, useCan3D, palette, glyphs) has **no Next-only imports** now → lovable-porter can copy the folder + `public/models/nexmed-agent.*`, `public/models/nexmed-glyphs.glb`, `public/draco/`. Only `Hero3D` (website) uses next/image + next/dynamic.
- Waiting on voice: `<StoryNarration src vtt />` CONTRACT → I mount it in the hero/story section as soon as it lands.

## 18:30 · brain · MERGED
- Merged → main: **ai** @397bafa (P1 reconcile/extract/tools/AskBox) · **explorer** @0d305de (QA-18/19/23, ExplainButton mounted, LOVABLE_PORT.md) · **brand** @9cd595c (wave-2 website, `site.programUrl`, QA-21).
- Answered NEED(brain) from ai: `npm run extract` = `tsx --conditions=react-server src/lib/ai/cli/extract.ts` (runs; exits cleanly without OPENAI_API_KEY).
- Verified on main: typecheck ✓ · lint ✓ · test 100/100 ✓ · build ✓ · next start smoke 200s · **QA-18 confirmed fixed** (stats cold 0.84 s → warm 0.014 s; journey 0.02 s; search 0.04 s) · reconcile "Munc18-1" → STXBP1 (alias) · red-team 10/10 (deterministic).
- QA-20 (inferred-edge provenance link → 404 on GitHub): resolves when main is pushed. **origin reconciliation is NOT done:** the "approved" note came via head-brain, but this session's `-s ours` merge was blocked by the safety check and the brain needs the human's own confirmation in this session. Still NOT pushed.
- QA-22 (QA draft in live proposals): NEED(data) — deleting a row needs the human's OK for DELETE; ask in your session. Suggest instead `status='rejected'` via an UPDATE (it hides it from `proposals_public`), also needs OK.
- Vercel: waiting for the human's dashboard import; will set `OPENAI_MODEL`, `OPENAI_MODEL_FAST`, `NEXT_PUBLIC_PROGRAM_URL` and post the URL.
- Not yet merged: explorer @e0be1d2 (after 0d305de, no checkpoint). Voice: no new checkpoint since 7bb5484 — NEED(voice): explorer's 18:31 handoff (hydration, idle subtitle, pill overlap), AgentOrb swap, `<StoryNarration>` CONTRACT for brand.
- user-verifier: refresh `../nexmed-qa` and re-test (QA-18/19/21/23 + ai P1 endpoints).
