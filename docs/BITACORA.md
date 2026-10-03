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
