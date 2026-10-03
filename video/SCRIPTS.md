# Nedamex · Video scripts (Hack-Nation: every video ≤ 60 s)

> **Rare disease, mapped. Every answer traced to its source.**
> Hack-Nation 7 · Challenge 5 · AI Atlas for Rare Diseases (Buffalo Initiative × OpenAI)

| Video | Hack-Nation brief | Remotion comp | Draft |
|---|---|---|---|
| **Demo** | "show your project in action with clear narration or captions"; follow a family "through the graph to a justified collaboration and next step, or an honest gap" | `Demo60` | `out/Demo60-draft.mp4` |
| **Tech** | "explain how you built it, what worked, what didn't, and key tools" | `Tech60` | `out/Tech60-draft.mp4` |
| **Team** | "explain who you are" | `Team60` | `out/Team60-draft.mp4` |

- **Captions are burned in for every line**, because judges may watch muted. They are generated from the `vo` text in `src/cuts/timeline.ts`: split by sentence and timed by word count. Change a line in `timeline.ts` and the caption follows. Keep this file in sync.
- **REC** marks a screen recording you make in the live app. Drop it in `video/public/rec/<file>`. Until then, the slot shows a labelled placeholder.
- **SFX** cue names are files in `video/public/sfx/` (see `SFX.md`). Cues inside scenes are placed automatically.
- **Data rules**: every ID and number on screen is real and comes from our graph or the sources listed. Maria is an **illustrative family**, labeled on screen; the data around her is real. Every answer surface carries "Not medical advice".

---

## 1 · DEMO, 60 s (`Demo60`): Maria's journey (Angelman syndrome)

The story follows Maria's family through the graph to a **justified collaboration and next step** (PIXI + the shared researchers) **and an honest gap** (no approved treatment; is there a shared mechanism? unvalidated).

| # | Time | VO + caption (EN) | On screen | SFX | REC |
|---|---|---|---|---|---|
| d01 | 0:00–0:06 | Maria's daughter has Angelman syndrome. No approved treatment in our sources. | **Hook**: a magenta "Maria's family" station (labeled *illustrative family*) rides into the **Angelman syndrome · ORPHA:72** interchange. A **dashed** green treatment line runs to a hollow station: "Approved treatment — none in our sources", with the note "investigational only (ClinicalTrials.gov): GTX-102 phase 3 · MVX-220 phase 2". | `station-chime` · `route-draw` · `no-evidence` | — |
| d02 | 0:06–0:16 | On the Nedamex map, her disease connects to genes, symptoms, trials and families. Every station has a source. | The live app, framed, tagged "Angelman on the map". | `route-draw` | **R1** `demo-atlas-angelman.mp4` |
| d03 | 0:16–0:33 | Connections finds neighbors. Rett syndrome shares seven symptoms, two researchers, and three studies already running across genetic syndromes: useful work that already exists. CDKL5 shares twelve symptoms, the strongest overlap. | **Connections**: a cobalt line runs from **Angelman · ORPHA:72** to **Rett · ORPHA:778** through three study stations: **WINGS** NCT06139172 (active, not recruiting) · **PIXI** NCT03836300 (enrolling by invitation) · **Early Check** NCT03655223 (active, not recruiting). An ink sign reads "Useful work already exists · 3 studies across genetic syndromes · ClinicalTrials.gov". An upper neighbor line adds 7 yellow stations ("7 shared symptoms · HPO") and 2 magenta stations ("2 shared researchers · PubMed authors"). A yellow line down to **CDKL5 deficiency · ORPHA:505652** stops at the big station "12 shared symptoms · HPO · strongest overlap". PIXI pulses at the end. | `route-draw` ×3 · `station-chime` ×3 | — |
| d04 | 0:33–0:43 | Maria asks the Family Guide: can a special diet cure it? *(agent answers)* | The live app with the voice agent, tagged "Family Guide (voice)". Captions: **Maria** "Can a special diet cure it?" → **Family Guide** "There is no evidence in our sources for that…" | `route-draw` | **R2** `demo-voice-diet.mp4` |
| d05 | 0:43–0:55 | Next step: ask the PIXI team if Angelman families can join, and invite the two shared researchers to a joint call. Still to validate: do shared symptoms share a mechanism? | **NextStep**: a "NEXT STEP · ANGELMAN · MARIA'S FAMILY" board. ● **Ask the PIXI team** (NCT03836300 · enrolling by invitation · can Angelman families join?) → ● **Invite the 2 shared researchers** (Angelman ↔ Rett · joint call) → ○ dashed: **To validate** (do shared symptoms share a mechanism? · expert review). Footer: "Not medical advice · take it to your care team". | `station-chime` ×2 · `no-evidence` | — |
| d06 | 0:55–1:00 | Nedamex. Every answer traced to its source. | **EndCard**: logo, tagline, `nedamex.vercel.app` (placeholder URL). | `logo-sting` | — |

Wording note: only PIXI is enrolling (by invitation); WINGS and Early Check are active, not recruiting. That's why the VO says "already running", not "enrolling". The two researchers are shown as "2 shared researchers · PubMed authors", without names.

## 2 · TECH, 60 s (`Tech60`): how we built it

| # | Time | VO + caption (EN) | On screen | SFX | REC |
|---|---|---|---|---|---|
| t01 | 0:00–0:13 | Seven open sources feed a Supabase Edge Function on pg_cron, which builds an evidence graph in Postgres. A trigger blocks any edge without evidence; a disease_links view connects diseases. | **Architecture**: Orphanet, HPO, Monarch, ClinVar, ClinicalTrials.gov, Open Targets and PubMed bundle into **Ingest** (Supabase Edge Function · pg_cron · daily), then the **Evidence graph** (Postgres · entities · edges · evidence + disease_links view · "trigger: no edge without evidence"), then `/api/tools/*` → **OpenAI draft** → **Verifier** → **Voice** (ElevenLabs). | `station-chime` · `route-draw` · `clock-tick` · `data-pulse` · `gate-verified` · `voice-on` | — |
| t02 | 0:13–0:22 | To answer, OpenAI drafts JSON claims with evidence IDs. A deterministic verifier drops anything unsourced, and ElevenLabs agents speak the rest. | **VerifierGate**: claims ride to a fare gate. With an evidence ID they pass into the spoken answer; "A diet cures it · evidence_id: none" drops. "deterministic check · no LLM judging an LLM". | `gate-verified` ×3 · `no-evidence` · `claim-drop` | — |
| t03 | 0:22–0:28 | Researchers get a Lovable portal on the same graph. | Lovable portal (Angelman ↔ Rett evidence + gaps), tagged "Researcher portal (Lovable)". | `route-draw` | **R3** `research-portal.mp4` |
| t04 | 0:28–0:46 | What broke: Open Targets dropped knownDrugs and missed an FDA approval; we migrated and added FDA as a source. Orphanet missed genes; Monarch fills in. Trials leaked other diseases; we filter by name. Validation caught a wrong ORPHA code. No sandbox internet, so ingestion runs in Supabase. | **Lessons**, under the sign "What didn't work": six rows, each a dashed broken segment that turns solid green. Open Targets *knownDrugs removed mid-hackathon* → `drugAndClinicalCandidates` · Open Targets *missed an FDA approval (ganaxolone, CDKL5)* → FDA added as a curated source · Orphanet *no genes for some diseases* → Monarch fallback · ClinicalTrials.gov *returned other diseases' trials* → disease-name filter · ORPHA code *CLN8 used instead of CLN2* → caught in validation · dev sandbox *no internet to the sources* → ingestion inside Supabase. | `no-evidence` · `station-chime` ×6 | — |
| t05 | 0:46–0:57 | Key tools: Supabase, Next.js on Vercel, OpenAI, ElevenLabs, Lovable and Claude Code subagents. Next: clustering by mechanism, and five thousand monogenic diseases. | **Stack** ("Key tools"): one solid line through Supabase · Next.js + Vercel · OpenAI · ElevenLabs · Lovable · Claude Code. A dashed extension leads to hollow "Mechanism clustering" and "5,000+ diseases (monogenic)". | `route-draw` · `station-chime` · `route-draw` | — |
| t06 | 0:57–1:00 | Nedamex. | EndCard | `logo-sting` | — |

## 3 · TEAM, 60 s (`Team60`): who we are

Structure: intro card (2 s) → **one edited phone clip, 55 s** (`video/public/rec/team.mp4`, or three clips `team-1/2/3.mp4`) with a name/role lower third for each person and burned-in captions → end card (3 s). Fill in the placeholders in `timeline.ts` (`TEAM_60`) and below.

| # | Time | Who | Line (EN) and caption | Lower third |
|---|---|---|---|---|
| tm0 | 0:00–0:02 | — | (no VO) Card: logo + "The team behind the map." | — |
| tm1 | 0:02–0:20 | P1 | Hi, I'm [Name], [major] at Tecnológico de Monterrey, Mexico. Families with a rare disease wait almost five years for a confirmed diagnosis, and researchers lose weeks searching separate databases. We're the NEDAMEX team, and we want to give them that time back. | **[Name]** · [major] · Tecnológico de Monterrey (+ source note: 4.7 years to a confirmed diagnosis · EURORDIS Rare Barometer) |
| tm2 | 0:20–0:39 | P2 | I'm [Name], I built [the evidence graph / the voice agents]. NEDAMEX connects genes, symptoms, treatments, trials and patient groups from seven verified databases. You can ask by text or voice and see the source behind every answer. If there isn't enough evidence, it says so. | **[Name]** · built [the evidence graph / the voice agents] |
| tm3 | 0:39–0:57 | P3 | I'm [Name], I lead [product and business]. Families use it for free; hospitals, biotech companies and research institutions pay for licenses. With this prize we'll cover more diseases and test it with research teams. We're looking for partners for that next step. | **[Name]** · leads [product and business] |
| tm4 | 0:57–1:00 | — | End card | — |

Each person has about 18 s. Each line is about 43 words, roughly 2.4 words per second. If a take runs long, trim the pauses in your editor, or change the three `sec` values in `TEAM_60` so they still add up to 55.

---

## Recording shot list

Record at **1920×1080, 30 fps**, browser zoom 110–125%, bookmarks bar hidden, a clean profile, and the cursor visible but calm. **Record system audio** so the ElevenLabs agent's voice is captured. Do one dry run, then 2 takes each. Save to `video/public/rec/` with exactly these names.

| ID | File | Length | Steps |
|---|---|---|---|
| R1 | `demo-atlas-angelman.mp4` | 10 s | Open `/atlas?d=ORPHA:72` → let the Angelman map draw → hover one or two stations so a plaque shows its source + date. Slow, deliberate cursor. |
| R2 | `demo-voice-diet.mp4` | 10 s | In `/atlas?d=ORPHA:72` (Angelman), choose **Family Guide**, press the mic and ask aloud **"Can a special diet cure it?"**. Hold while the agent says **"There is no evidence in our sources for that…"** and the disclaimer appears. Captions expect the question at 2.2–4.6 s and the answer at 4.8–9.8 s; trim the clip, or adjust `captions` in `timeline.ts`. |
| R3 | `research-portal.mp4` | 6 s | Lovable researcher portal on the same graph: the Angelman ↔ Rett evidence list and gaps. |
| Team | `team.mp4` (or `team-1/2/3.mp4`) | 55 s | See `TEAM_VIDEO_GUIDE.md`. |

Optional: if the app's Connections panel (Angelman → Rett / CDKL5) and Next step card look good live, you can swap d03/d05 for recordings by changing `kind: "scene"` to a `rec` item in `timeline.ts`.

---

## Versión en español (para ensayar)

> Para practicar el ritmo y entender cada línea. Los videos se entregan en inglés. Si deciden grabar en español, reemplacen el `vo` en `timeline.ts` y los subtítulos se generan solos.

### DEMO · 60 s
| # | Tiempo | Línea (ES) |
|---|---|---|
| d01 | 0:00–0:06 | La hija de María tiene síndrome de Angelman. No hay tratamiento aprobado en nuestras fuentes. |
| d02 | 0:06–0:16 | En el mapa de Nedamex, su enfermedad se conecta con genes, síntomas, ensayos y familias. Cada estación tiene su fuente. |
| d03 | 0:16–0:33 | Conexiones encuentra vecinos. El síndrome de Rett comparte siete síntomas, dos investigadores y tres estudios que ya están en marcha con varios síndromes genéticos: trabajo útil que ya existe. CDKL5 comparte doce síntomas, la mayor coincidencia. |
| d04 | 0:33–0:43 | María le pregunta a la Guía de familias: ¿una dieta especial puede curarlo? *(el agente: "No hay evidencia en nuestras fuentes para eso…")* |
| d05 | 0:43–0:55 | Siguiente paso: preguntar al equipo de PIXI si las familias con Angelman pueden unirse, e invitar a los dos investigadores compartidos a una llamada conjunta. Falta validar: ¿los síntomas compartidos comparten un mecanismo? |
| d06 | 0:55–1:00 | Nedamex. Cada respuesta con su fuente. |

### TECH · 60 s
| # | Tiempo | Línea (ES) |
|---|---|---|
| t01 | 0:00–0:13 | Siete fuentes abiertas alimentan una Edge Function de Supabase con pg_cron, que construye un grafo de evidencia en Postgres. Un trigger bloquea cualquier arista sin evidencia; una vista disease_links conecta enfermedades. |
| t02 | 0:13–0:22 | Para responder, OpenAI redacta afirmaciones en JSON con evidence IDs. Un verificador determinista descarta lo que no tiene fuente, y los agentes de ElevenLabs dicen el resto. |
| t03 | 0:22–0:28 | Los investigadores tienen un portal en Lovable sobre el mismo grafo. |
| t04 | 0:28–0:46 | Qué falló: Open Targets quitó knownDrugs y no tenía una aprobación de la FDA; migramos y agregamos la FDA como fuente. Orphanet no tenía genes; Monarch los completa. Los ensayos traían otras enfermedades; filtramos por nombre. La validación detectó un código ORPHA equivocado. Sin internet en el sandbox, la ingesta corre en Supabase. |
| t05 | 0:46–0:57 | Herramientas clave: Supabase, Next.js en Vercel, OpenAI, ElevenLabs, Lovable y subagentes de Claude Code. Lo que sigue: agrupar por mecanismo y cinco mil enfermedades monogénicas. |
| t06 | 0:57–1:00 | Nedamex. |

### TEAM · 60 s
| # | Quién | Línea (ES) |
|---|---|---|
| tm1 | P1 | Hola, soy [Nombre], estudio [carrera] en el Tecnológico de Monterrey, México. Las familias con una enfermedad rara esperan casi cinco años por un diagnóstico confirmado, y los investigadores pierden semanas buscando en bases de datos separadas. Somos el equipo NEDAMEX y queremos devolverles ese tiempo. |
| tm2 | P2 | Soy [Nombre] y construí [el grafo de evidencia / los agentes de voz]. NEDAMEX conecta genes, síntomas, tratamientos, ensayos y grupos de pacientes de siete bases de datos verificadas. Puedes preguntar por texto o por voz y ver la fuente detrás de cada respuesta. Si no hay suficiente evidencia, te lo dice. |
| tm3 | P3 | Soy [Nombre] y lidero [producto y negocio]. Las familias lo usan gratis; hospitales, empresas de biotecnología e instituciones de investigación pagan licencias. Con este premio cubriremos más enfermedades y lo probaremos con equipos de investigación. Buscamos socios para ese siguiente paso. |
