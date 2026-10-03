# Nedamex · Video scripts

> **Rare disease, mapped. Every answer traced to its source.**
> Hack-Nation 7 · Challenge 5 · AI Atlas for Rare Diseases (Buffalo Initiative × OpenAI)

Two videos, each in two lengths. Each long cut and its 60 s cut use the same scenes. Scenes speed up to fit, so you only change durations in `src/cuts/timeline.ts`.

| Video | Remotion comp | Length | Draft render |
|---|---|---|---|
| Pitch / demo | `Pitch120` | 2:00 | `out/Pitch120-draft.mp4` |
| Pitch / demo | `Pitch60` | 1:00 | `out/Pitch60-draft.mp4` |
| Technical | `Tech120` | 2:00 | `out/Tech120-draft.mp4` |
| Technical | `Tech60` | 1:00 | `out/Tech60-draft.mp4` |

The VO lines below are the same text as `vo` in `src/cuts/timeline.ts`. The drafts show it along the bottom so you can read along. If you edit a line, change it in both places.

How to read each row:
- **VO**: the line the team reads. Keep it conversational and pause at the periods. Lines are written for about 2.4 words per second.
- **On screen**: what the Remotion scene shows. On-screen text stays at 6 words or fewer per card.
- **SFX**: the cue name, which is the file `public/sfx/<name>.mp3`. See `SFX.md`. Cues inside scenes are placed automatically.
- **REC**: a screen recording you make in the live app. It goes in `public/rec/<file>`. The exact steps are in [Recording shot list](#recording-shot-list).

House rules for every line: only the sourced numbers below, each shown with its source; no invented NCT, PMID, people or patients; the family in the hook is generic ("a family"), not a named person.

| Number | Source shown on screen |
|---|---|
| 4.7 years to a confirmed diagnosis | EURORDIS Rare Barometer · 10,453 patients |
| 95% of rare diseases have no approved treatment | Buffalo Initiative |
| 300M+ people live with a rare disease | Buffalo Initiative |
| >80% of trials delayed or closed by recruitment · US$600k–8M lost per day | Emmes 2024 |
| ~1,000 patient organizations in 74 countries | EURORDIS |
| 5,000+ monogenic diseases (scale target) | Orphadata classification |
| Fares: families free · orgs US$100–500/mo · clinics US$200/specialist/mo · pharma/CROs US$50–250k/program/yr | labeled "pricing hypothesis" |

---

## 1 · Pitch / demo, 2 min (`Pitch120`)

| # | Time | VO (EN) | On screen | SFX | REC |
|---|---|---|---|---|---|
| p01 | 0:00–0:18 | For families facing a rare disease, the road to a diagnosis looks like this. Doctor after doctor, test after test: four point seven years on average. Then the news: ninety-five percent of rare diseases have no approved treatment. Three hundred million people live this. | **OdysseyRoute**: a graphite route tangles across the map, loops and crosses itself through 10 hollow "visits"; a year counter ticks 0.0 → 4.7. It ends at a green "Diagnosis" station. The route fades and three signs rise: **4.7 years** (yellow line), **95%** (green line, *dashed*: no treatment), **300M+** (magenta), each with its source. | `hospital-ambience` (bed, fades at 0:09) · `clock-tick` · `station-chime` on diagnosis · `calm-transition` · `number-thud` ×3 | — |
| p02 | 0:18–0:22 | This is Nedamex. Rare disease, mapped. | **TitleCard**: the N logo draws itself as a route. Stations pop in gene, symptom and treatment colors; the last one stays hollow. Wordmark, then "Rare disease, mapped." | `route-draw` · `station-chime` | — |
| p03 | 0:22–0:34 | We turned seven open medical databases into one evidence map: genes, symptoms, treatments, trials, research, and the people who can help. Every station has a source. | **MapBuild**: Dravet syndrome (ORPHA:33069) as a transit map, drawn line by line. Lines: SCN1A (HGNC:10585), 4 HPO symptoms, 3 treatments (Open Targets), trials, Dravet Syndrome Foundation, PubMed. Last comes a **dashed** line to a hollow "Cure by diet? · no evidence". A legend appears, plus "sample view". | `station-chime` · `route-draw` ×3 · `no-evidence` | — |
| p04 | 0:34–0:50 | Pick a disease. Ask in your own words. *(pause and let the Family Guide answer)* | Screen recording inside a framed panel, tagged **Family Guide**. | `route-draw` (whoosh in) | **R1** `atlas-family-treatments.mp4` |
| p05 | 0:50–1:00 | Each answer is built from stations on the map. If a claim has no source, it never reaches your ears. | **AskAnswer**: the voice question "What treatments exist?" draws a green line to 3 treatment stations, each with a ✓ Open Targets chip. Then "Can a diet cure it?" drafts a claim, "Diet cures Dravet · evidence_id: none". It turns dashed, the claim drops, and "No evidence in our sources." takes its place. Footer: "Not medical advice · sample view". | `voice-on` · `route-draw` · `station-chime` · `voice-on` · `route-draw` · `no-evidence` · `claim-drop` | — |
| p06 | 1:00–1:10 | Now the hard question. *(let the agent say: "There is no evidence in our sources for that.")* | Screen recording, tagged **Verifier at work**. | `route-draw` | **R2** `atlas-diet-no-evidence.mp4` |
| p07 | 1:10–1:18 | That's our verifier. Code, not another AI. No evidence ID, no sentence. | **VerifierGate**: "No source, no station." Claim cards ride a track into a fare gate. SCN1A · HGNC:10585 ✓, Febrile seizures · HP:0002373 ✓ and Stiripentol · Open Targets ✓ pass into the spoken answer. "A diet cures it · evidence_id: none" turns dashed and drops. "deterministic check · no LLM judging an LLM". | `gate-verified` ×3 · `no-evidence` · `claim-drop` | — |
| p08 | 1:18–1:28 | Researchers switch lines and see the gaps: where evidence is missing, and who is working on it. | Screen recording, tagged **Research Analyst**. | `route-draw` | **R3** `atlas-research-gaps.mp4` |
| p09 | 1:28–1:42 | Families ride free, always. Clinics, patient groups and pharma pay for the professional lines, because over eighty percent of rare-disease trials are delayed by recruitment. | **RidersAndFares**: three lines draw (Families green, Clinicians cobalt, Research magenta) with plaques "Free, always" and ">80% of trials delayed · Emmes 2024". They lift up, and a split-flap fare board labeled "PRICING HYPOTHESIS" flips: FREE · US$100–500/MO · US$200/SPECIALIST/MO · US$50–250K/PROGRAM/YR. Two source notes sit under it. | `route-draw` · `station-chime` · `split-flap` | — |
| p10 | 1:42–1:51 | We map five diseases today. The same pipeline scales to more than five thousand. | **ScaleNetwork**: 5 disease pills (Dravet, Rett, CDKL5, Angelman, CLN2, each with its ORPHA code). The camera zooms out as thousands of stations light up. The counter runs 5 → 5,000+ (Orphadata classification). A ring marks "5 today" and the sign reads "Same ingestion." | `station-chime` · `zoom-swell` | — |
| p11 | 1:51–1:55 | And it's live. | Screen recording of the landing page. | — | **R4** `landing-scroll.mp4` |
| p12 | 1:55–2:00 | Nedamex. Every answer traced to its source. | **EndCard**: logo, "Rare disease, mapped.", "Every answer traced to its source.", URL pill `nedamex.vercel.app` (placeholder) and the Hack-Nation line. | `logo-sting` | — |

## 2 · Pitch / demo, 60 s (`Pitch60`)

| # | Time | VO (EN) | Scene / REC |
|---|---|---|---|
| p01 | 0:00–0:11 | For families facing a rare disease, a diagnosis takes four point seven years on average. And ninety-five percent of these diseases have no approved treatment. | OdysseyRoute (sped up) |
| p02 | 0:11–0:14 | This is Nedamex. | TitleCard |
| p03 | 0:14–0:21 | Seven open databases, one evidence map. Every station has a source. | MapBuild |
| p04 | 0:21–0:31 | Pick a disease and just ask. *(agent answers)* | **R1** (first 10 s, or set `trimStart`) |
| p06 | 0:31–0:39 | No source? It says so. *(agent: no evidence)* | **R2** |
| p09 | 0:39–0:48 | Families ride free. Clinics, patient groups and pharma pay for the professional lines. | RidersAndFares |
| p10 | 0:48–0:54 | Five diseases today. Five thousand plus with the same pipeline. | ScaleNetwork |
| p12 | 0:54–1:00 | Nedamex. Every answer traced to its source. | EndCard |

---

## 3 · Technical, 2 min (`Tech120`)

| # | Time | VO (EN) | On screen | SFX | REC |
|---|---|---|---|---|---|
| t01 | 0:00–0:04 | Here's what's under the map. | **TitleCard** variant: logo + "Under the map." | `route-draw` · `station-chime` | — |
| t02 | 0:04–0:32 | Seven open sources: Orphanet, HPO, Monarch, ClinVar, ClinicalTrials.gov, Open Targets and PubMed. A Supabase Edge Function ingests them, and pg_cron runs it every day. Everything lands in one evidence graph in Postgres. When you ask, the voice agent calls read-only tools, the LLM drafts JSON claims with evidence IDs, and a deterministic verifier decides what gets spoken. | **Architecture**: 7 source stations in their line colors. They bundle into an **Ingest** interchange (clock icon, "Supabase Edge Function · pg_cron · daily"), then into the **Evidence graph** hub (Postgres · entities · edges · evidence · "trigger: no edge without evidence"). One ink line runs on through `/api/tools/*` → **LLM draft** (a JSON card types `{ claim, evidence_ids: ["HP:0002373"] }`) → **Verifier** gate → **Voice** (ElevenLabs, waveform). Data pulses travel the network. | `station-chime` · `route-draw` · `clock-tick` · `station-chime` · `data-pulse` · `gate-verified` · `voice-on` · `data-pulse` | — |
| t03 | 0:32–0:48 | The graph is three tables: entities, edges and evidence. Edges are born pending, and a database trigger only lets them go active once evidence exists. No edge without evidence, enforced by Postgres, not by a prompt. | **DataModel**: three stations, `entities` → `edges` → `evidence`, with their fields. Demo row: SCN1A —causes→ Dravet starts dashed (pending). Evidence "ClinVar · Orphanet" attaches and the edge turns solid vermilion, "status: active ✓". Diet —cures?→ Dravet stays dashed, "status: pending", then "trigger: blocked · no evidence". | `station-chime` · `route-draw` · `gate-verified` · `route-draw` · `no-evidence` | — |
| t04 | 0:48–1:02 | Here's a tool call. Treatments for Dravet come back as data plus evidence: source, external ID, URL and retrieval date. | Screen recording, tagged `/api/tools/treatments`. | `route-draw` | **R5** `api-tools-treatments.mp4` |
| t05 | 1:02–1:16 | The verifier is plain code. Every claim must cite an evidence ID returned in this turn. Anything else is dropped and replaced with: there is no evidence in our sources for that. No LLM judging an LLM. | **VerifierGate** (slower pace). | as p07 | — |
| t06 | 1:16–1:26 | And it's tested: claims without evidence, or with invented IDs, never pass. | Screen recording, tagged `verifier.test.ts`. | `route-draw` | **R6** `verifier-tests.mp4` |
| t07 | 1:26–1:38 | To scale, the seed list becomes Orphadata's classification: five thousand plus monogenic diseases. Ingestion is queued, Postgres carries about ten million edges, and row-level security makes it multi-tenant. | **ScaleNetwork** tech variant, plus badges: "Postgres → ~10M edges", "queued ingestion · SKIP LOCKED", "multi-tenant · RLS". | `station-chime` · `zoom-swell` | — |
| t08 | 1:38–1:48 | The stack: Next.js on Vercel, Supabase, ElevenLabs voice agents, OpenAI or Claude for drafting only, and a Lovable portal for researchers. | **Stack**: one line, five stations: Next.js + Vercel · Supabase · ElevenLabs · OpenAI / Claude ("drafts claims, never judges") · Lovable ("researcher portal"). | `route-draw` · `station-chime` | — |
| t09 | 1:48–1:54 | Same graph, same rules, everywhere. | Screen recording, tagged **Researcher portal (Lovable)**. | `route-draw` | **R7** `research-portal.mp4` |
| t10 | 1:54–2:00 | Nedamex. Every answer traced to its source. | EndCard | `logo-sting` | — |

## 4 · Technical, 60 s (`Tech60`)

| # | Time | VO (EN) | Scene / REC |
|---|---|---|---|
| t01 | 0:00–0:03 | Under the map. | TitleCard (tech) |
| t02 | 0:03–0:19 | Seven open sources flow through a daily Supabase Edge Function into one evidence graph. Voice agents call read-only tools, the LLM drafts claims with evidence IDs, and a deterministic verifier decides what's spoken. | Architecture |
| t03 | 0:19–0:27 | Edges stay pending until evidence exists. A Postgres trigger enforces it. | DataModel |
| t05 | 0:27–0:36 | No evidence ID, no sentence. Plain code, no LLM judging an LLM. | VerifierGate |
| t04 | 0:36–0:44 | Every tool returns data plus its evidence. | **R5** |
| t07 | 0:44–0:51 | Same pipeline, five thousand plus diseases, multi-tenant from day one. | ScaleNetwork (tech) |
| t08 | 0:51–0:56 | Next.js, Supabase, ElevenLabs, OpenAI or Claude, Lovable. | Stack |
| t10 | 0:56–1:00 | Nedamex. | EndCard |

---

## Recording shot list

Record at **1920×1080, 30 fps**, browser zoom 110–125%, bookmarks bar hidden, a clean profile (no extensions or personal tabs), and the cursor visible but not wandering. **Record system audio**: the ElevenLabs agent's voice is the star of R1–R3. Use Chrome on the production URL or `npm run dev`. Do one dry run, then record 2 takes of each. Save to `video/public/rec/` with these exact filenames.

| ID | File | Target length | Steps |
|---|---|---|---|
| R1 | `atlas-family-treatments.mp4` | 16 s (10 s usable for the 60 s cut) | Open `/atlas` → pick **Dravet syndrome** → choose **Family Guide** → press the mic and ask aloud: **"What treatments exist?"** → hold while the sourced answer plays and the evidence chips/plaques appear (source + date visible). Stop 1 s after the agent finishes. |
| R2 | `atlas-diet-no-evidence.mp4` | 10 s | Same chat, ask: **"Can a special diet cure it?"** → the agent answers **"There is no evidence in our sources for that."** plus the disclaimer. If the UI shows the dropped claim, hover it. |
| R3 | `atlas-research-gaps.mp4` | 10 s | Switch audience to **Research** → Dravet → open **gaps**: the dashed lines / "no evidence" items and the researcher community. A slow pan or scroll is fine. |
| R4 | `landing-scroll.mp4` | 4–6 s | The landing page, top to the map section: slow, smooth scroll so the route draws itself. Use a trackpad or smooth-scroll. |
| R5 | `api-tools-treatments.mp4` | 14 s | Browser: `/api/tools/treatments?q=Dravet` with the `x-atlas-key` header (use a REST client, or `curl … \| jq` in a large-font terminal). Show `data` then `evidence[]` with `source`, `external_id`, `url` and `retrieved_at`. Don't show keys on screen. |
| R6 | `verifier-tests.mp4` | 10 s | Terminal (font 20pt+, dark or light): `npm test` → the verifier tests pass. Optionally `code src/lib/verifier.ts` scrolling to the drop logic. |
| R7 | `research-portal.mp4` | 6 s | The Lovable researcher portal on Dravet: the evidence list and gaps. |

Tip: if a take runs long, keep it as is and set `trimStart` (seconds) or `sec` for that item in `src/cuts/timeline.ts`. Don't speed up a clip that has the agent's voice in it.

---

## Versión en español (para ensayar)

> Para ensayar el ritmo. El video final va en inglés, salvo que el equipo decida grabar una versión en español; si lo hacen, usen estas líneas y el mismo `timeline.ts`.

### Pitch · 2 min
| # | Tiempo | VO (ES) |
|---|---|---|
| p01 | 0:00–0:18 | Para las familias que enfrentan una enfermedad rara, el camino al diagnóstico se ve así. Médico tras médico, estudio tras estudio: cuatro punto siete años en promedio. Y luego la noticia: el noventa y cinco por ciento de las enfermedades raras no tiene tratamiento aprobado. Trescientos millones de personas viven esto. |
| p02 | 0:18–0:22 | Esto es Nedamex. Enfermedades raras, en un mapa. |
| p03 | 0:22–0:34 | Convertimos siete bases de datos médicas abiertas en un solo mapa de evidencia: genes, síntomas, tratamientos, ensayos, investigación y las personas que pueden ayudar. Cada estación tiene su fuente. |
| p04 | 0:34–0:50 | Elige una enfermedad. Pregunta con tus propias palabras. *(deja que responda la Guía de familias)* |
| p05 | 0:50–1:00 | Cada respuesta se arma con estaciones del mapa. Si una afirmación no tiene fuente, nunca llega a tus oídos. |
| p06 | 1:00–1:10 | Ahora, la pregunta difícil. *(el agente: "No hay evidencia en nuestras fuentes para eso")* |
| p07 | 1:10–1:18 | Ese es nuestro verificador. Código, no otra IA. Sin evidence ID, no hay frase. |
| p08 | 1:18–1:28 | Quien investiga cambia de línea y ve los huecos: dónde falta evidencia y quién está trabajando en ello. |
| p09 | 1:28–1:42 | Las familias viajan gratis, siempre. Clínicas, organizaciones de pacientes y farma pagan las líneas profesionales, porque más del ochenta por ciento de los ensayos en enfermedades raras se retrasan por reclutamiento. |
| p10 | 1:42–1:51 | Hoy mapeamos cinco enfermedades. El mismo pipeline escala a más de cinco mil. |
| p11 | 1:51–1:55 | Y ya está en línea. |
| p12 | 1:55–2:00 | Nedamex. Cada respuesta con su fuente. |

### Pitch · 60 s
p01 "Para las familias con una enfermedad rara, el diagnóstico tarda cuatro punto siete años en promedio. Y el noventa y cinco por ciento de estas enfermedades no tiene tratamiento aprobado." · p02 "Esto es Nedamex." · p03 "Siete bases abiertas, un mapa de evidencia. Cada estación tiene su fuente." · p04 "Elige una enfermedad y pregunta." · p06 "¿Sin fuente? Te lo dice." · p09 "Las familias viajan gratis. Clínicas, organizaciones y farma pagan las líneas profesionales." · p10 "Cinco enfermedades hoy. Más de cinco mil con el mismo pipeline." · p12 "Nedamex. Cada respuesta con su fuente."

### Técnico · 2 min
| # | VO (ES) |
|---|---|
| t01 | Esto es lo que hay debajo del mapa. |
| t02 | Siete fuentes abiertas: Orphanet, HPO, Monarch, ClinVar, ClinicalTrials.gov, Open Targets y PubMed. Una Edge Function de Supabase las ingiere y pg_cron la ejecuta cada día. Todo cae en un solo grafo de evidencia en Postgres. Cuando preguntas, el agente de voz llama herramientas de solo lectura, el LLM redacta afirmaciones en JSON con evidence IDs, y un verificador determinista decide qué se dice. |
| t03 | El grafo son tres tablas: entidades, aristas y evidencia. Las aristas nacen pendientes y un trigger de la base solo las activa cuando existe evidencia. Ninguna arista sin evidencia, lo garantiza Postgres, no un prompt. |
| t04 | Esta es una llamada a una herramienta. Los tratamientos de Dravet vuelven como datos más evidencia: fuente, ID externo, URL y fecha de consulta. |
| t05 | El verificador es código simple. Cada afirmación debe citar un evidence ID devuelto en este turno. Lo demás se elimina y se reemplaza por: no hay evidencia en nuestras fuentes para eso. Ningún LLM juzgando a otro LLM. |
| t06 | Y está probado: afirmaciones sin evidencia o con IDs inventados nunca pasan. |
| t07 | Para escalar, la lista semilla pasa a ser la clasificación de Orphadata: más de cinco mil enfermedades monogénicas. La ingesta va en cola, Postgres aguanta unos diez millones de aristas y la seguridad por filas lo hace multi-tenant. |
| t08 | El stack: Next.js en Vercel, Supabase, agentes de voz de ElevenLabs, OpenAI o Claude solo para redactar, y un portal de Lovable para investigadores. |
| t09 | El mismo grafo y las mismas reglas, en todas partes. |
| t10 | Nedamex. Cada respuesta con su fuente. |

### Técnico · 60 s
t01 "Debajo del mapa." · t02 "Siete fuentes abiertas pasan por una Edge Function diaria de Supabase a un solo grafo de evidencia. Los agentes de voz llaman herramientas de solo lectura, el LLM redacta con evidence IDs y un verificador determinista decide qué se dice." · t03 "Las aristas quedan pendientes hasta que hay evidencia; lo impone un trigger de Postgres." · t05 "Sin evidence ID, no hay frase. Código simple, ningún LLM juzgando a otro." · t04 "Cada herramienta devuelve datos con su evidencia." · t07 "El mismo pipeline, más de cinco mil enfermedades, multi-tenant desde el día uno." · t08 "Next.js, Supabase, ElevenLabs, OpenAI o Claude, Lovable." · t10 "Nedamex."
