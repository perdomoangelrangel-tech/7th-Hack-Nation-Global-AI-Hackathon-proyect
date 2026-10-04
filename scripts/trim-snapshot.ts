/**
 * Keep data/atlas.json under the 8 MB budget with an explicit, reproducible policy (run BEFORE `npm run analyze`, so
 * analytics only reference what is kept). Nothing is invented and no kept edge loses its evidence; low-value bulk goes:
 *   - trials: keep every active / recruiting trial, every natural-history / registry / biomarker study, every trial
 *     linked to ≥ 2 diseases (reusable assets) and every trial cited by a treats edge; fill up to MAX_TRIALS per disease
 *     with the most recent.
 *   - investigators: keep every one linked to ≥ 2 diseases (bridges) and every contact PI; fill up to MAX_INVESTIGATORS
 *     per disease by the most recent fiscal year.
 *   - variants: only for primary causal genes, up to MAX_VARIANTS per gene (pathogenic first).
 *   - evidence quotes: truncated to QUOTE_CHARS (the URL is the evidence; the quote is a preview).
 *
 *   npx tsx scripts/trim-snapshot.ts [path=data/atlas.json]
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { AtlasSnapshot, Edge } from "../src/lib/atlas/types";

const MAX_TRIALS = 35, MAX_INVESTIGATORS = 18, MAX_VARIANTS = 30, QUOTE_CHARS = 240, BUDGET = 8 * 1024 * 1024;
const ACTIVE = new Set(["RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING", "ENROLLING_BY_INVITATION"]);
const ASSETS = new Set(["natural_history", "registry", "biomarker_study"]);

const path = process.argv[2] ?? "data/atlas.json";
const snap = JSON.parse(readFileSync(path, "utf8")) as AtlasSnapshot;
const before = JSON.stringify(snap).length;
const byId = new Map(snap.entities.map((e) => [e.id, e]));
const type = (id: string) => byId.get(id)?.type;
const drop = new Set<string>(); // edge ids

const group = (rel: string, fromType: string) => {
  const m = new Map<string, Edge[]>();
  for (const e of snap.edges) if (e.relation === rel && type(e.from) === fromType) m.set(e.to, [...(m.get(e.to) ?? []), e]);
  return m;
};
const diseasesOf = (rel: string, fromType: string) => {
  const m = new Map<string, Set<string>>();
  for (const e of snap.edges) if (e.relation === rel && type(e.from) === fromType) m.set(e.from, new Set([...(m.get(e.from) ?? []), e.to]));
  return m;
};

/* Trials ---------------------------------------------------------------- */
const trialDiseases = diseasesOf("studies", "trial");
const citedTrials = new Set(snap.edges.filter((e) => e.relation === "treats").flatMap((e) => [...((e.props.nct_ids as string[]) ?? []), ...e.evidence.map((v) => v.external_id)]));
for (const [, edges] of group("studies", "trial")) {
  const must = (e: Edge) => {
    const t = byId.get(e.from)!;
    return ACTIVE.has(String(t.props.status)) || ASSETS.has(String(t.props.asset_kind)) || (trialDiseases.get(e.from)?.size ?? 0) > 1 || citedTrials.has(t.canonical_id);
  };
  const rest = edges.filter((e) => !must(e)).sort((a, b) => String(byId.get(b.from)!.props.start_date ?? "").localeCompare(String(byId.get(a.from)!.props.start_date ?? "")));
  const room = Math.max(0, MAX_TRIALS - edges.filter(must).length);
  for (const e of rest.slice(room)) drop.add(e.id);
}

/* Papers: every paper linked to ≥ 2 diseases, then the most recent up to MAX_PAPERS per disease ----------- */
const MAX_PAPERS = 20;
const paperDiseases = diseasesOf("studies", "study");
for (const [, edges] of group("studies", "study")) {
  const shared = (e: Edge) => (paperDiseases.get(e.from)?.size ?? 0) > 1;
  const rest = edges.filter((e) => !shared(e)).sort((a, b) => String(byId.get(b.from)!.props.pub_date ?? "").localeCompare(String(byId.get(a.from)!.props.pub_date ?? "")));
  for (const e of rest.slice(Math.max(0, MAX_PAPERS - edges.filter(shared).length))) drop.add(e.id);
}

/* Investigators ---------------------------------------------------------- */
const invDiseases = diseasesOf("researches", "investigator");
for (const [, edges] of group("researches", "investigator")) {
  const must = (e: Edge) => (invDiseases.get(e.from)?.size ?? 0) > 1 || e.props.role === "contact_pi";
  const rest = edges.filter((e) => !must(e)).sort((a, b) => Number(b.props.fiscal_year ?? 0) - Number(a.props.fiscal_year ?? 0));
  const room = Math.max(0, MAX_INVESTIGATORS - edges.filter(must).length);
  for (const e of rest.slice(room)) drop.add(e.id);
}

/* Variants --------------------------------------------------------------- */
const primaryGenes = new Set(snap.edges.filter((e) => e.relation === "causes" && e.props.primary).map((e) => e.from));
const byGene = new Map<string, Edge[]>();
for (const e of snap.edges.filter((x) => x.relation === "has_variant")) byGene.set(e.from, [...(byGene.get(e.from) ?? []), e]);
for (const [gene, edges] of byGene) {
  if (!primaryGenes.has(gene)) { for (const e of edges) drop.add(e.id); continue; }
  const sorted = [...edges].sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id));
  for (const e of sorted.slice(MAX_VARIANTS)) drop.add(e.id);
}

/* Apply ------------------------------------------------------------------ */
snap.edges = snap.edges.filter((e) => !drop.has(e.id));
for (const e of snap.edges) for (const v of e.evidence) if (v.quote && v.quote.length > QUOTE_CHARS) v.quote = v.quote.slice(0, QUOTE_CHARS - 1) + "…";
// Duplicated text: the project title is also the researches edge's evidence quote (the UI shows ≤ 70 chars of it);
// trial official titles / primary outcomes are not read by the app (the trial page is one click away).
for (const e of snap.edges) if (e.relation === "researches" && typeof e.props.title === "string" && e.props.title.length > 90) e.props.title = e.props.title.slice(0, 89) + "…";
for (const t of snap.entities) if (t.type === "trial") { delete t.props.official_title; delete t.props.primary_outcomes; }
const used = new Set(snap.edges.flatMap((e) => [e.from, e.to]));
const keepTypes = new Set(["disease", "phenotype"]); // phenotypes stay for IC / ancestors even if only reached via is_a
snap.entities = snap.entities.filter((e) => used.has(e.id) || keepTypes.has(e.type));
const after = JSON.stringify(snap).length;
writeFileSync(path, JSON.stringify(snap));
console.log(`✔ ${path}: ${(before / 1048576).toFixed(2)} MB → ${(after / 1048576).toFixed(2)} MB · dropped ${drop.size} edges · ${snap.entities.length} entities, ${snap.edges.length} edges${after > BUDGET ? " · ⚠ still over 8 MB" : ""}`);
