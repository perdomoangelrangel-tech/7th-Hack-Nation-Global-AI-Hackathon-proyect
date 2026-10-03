/**
 * Compact responses for the ElevenLabs server tools (/api/tools/*). Pure: takes a DiseaseMap,
 * returns ≤ ~4 KB JSON where each item is { summary, evidence_ids } so a voice agent can speak a
 * sentence and cite it. Summaries only restate graph fields (names, codes, phases, sources, dates).
 */
import type { DiseaseMap, Station } from "../atlas-data";
import { clip, countriesOf, isApproved, isRecruiting, prevalenceLabel, sourceLabel, str, trialPhases, treatmentPhase, mechanismOf } from "./evidence";

export interface ToolItem { summary: string; evidence_ids: string[]; url?: string }
export interface ToolResponse {
  tool: string;
  disease: { orpha: string; name: string; name_es: string | null } | null;
  retrieved_at: string;
  source: "live" | "snapshot" | "none";
  total: number;
  items: ToolItem[];
  note?: string;
  truncated?: boolean;
}

export const MAX_BYTES = 3900;

export const TOOL_CATALOG = [
  { name: "ask", description: "Answer a question end to end (retrieve → draft → verify). Speak `spoken` exactly: it holds only verified sentences plus the disclaimer.", params: { q: "the user's question, in their words", audience: "family | clinical | research", locale: "en | es", disease: "optional ORPHA code or name when the question does not name the disease" } },
  { name: "diseases", description: "List the diseases in the atlas (ORPHA code, EN/ES names).", params: {} },
  { name: "disease", description: "Disease card: definition, prevalence, causal genes, most frequent HPO phenotypes.", params: { q: "ORPHA code, name or alias (EN/ES), e.g. ORPHA:33069 or Dravet" } },
  { name: "treatments", description: "Treatments and care: approved vs investigational, highest clinical phase, mechanism.", params: { q: "disease" } },
  { name: "trials", description: "Clinical trials (ClinicalTrials.gov): status, phase, countries. Recruiting first.", params: { q: "disease", country: "optional country filter, e.g. Mexico", recruiting: "optional 'true' to keep only recruiting trials" } },
  { name: "literature", description: "Most recent PubMed papers linked to the disease.", params: { q: "disease", limit: "optional, default 5" } },
  { name: "communities", description: "Patient organizations and registered researchers.", params: { q: "disease" } },
  { name: "gaps", description: "Research gaps: empty lines, no approved treatment, no recruiting trial, single-source or low-confidence relations.", params: { q: "disease" } },
  { name: "phenotype-match", description: "Rank atlas diseases by matching HPO phenotypes (differential support, not a diagnosis).", params: { hpo: "comma-separated HPO ids, e.g. HP:0001250,HP:0002373" } },
] as const;

const ids = (s: Station, n = 2) => s.evidence.slice(0, n).map((e) => e.id);
const cite = (s: Station) => {
  const e = s.evidence[0];
  return e ? `${sourceLabel(e.source)} ${e.external_id}${e.published_on ? ` (${e.published_on})` : ""}` : "";
};
const item = (summary: string, s: Station): ToolItem => ({ summary: clip(summary, 220), evidence_ids: ids(s), url: s.evidence[0]?.url || undefined });

function head(tool: string, map: DiseaseMap): Omit<ToolResponse, "items" | "total"> {
  return { tool, disease: { orpha: map.disease.orpha, name: map.disease.name, name_es: map.disease.name_es }, retrieved_at: map.retrieved_at, source: map.source };
}

export function emptyTool(tool: string, note: string): ToolResponse {
  return { tool, disease: null, retrieved_at: new Date().toISOString(), source: "none", total: 0, items: [], note };
}

/** Keep the payload under MAX_BYTES by dropping trailing items. */
export function fit(r: ToolResponse): ToolResponse {
  const out = { ...r, items: [...r.items] };
  while (out.items.length > 1 && JSON.stringify(out).length > MAX_BYTES) {
    out.items.pop();
    out.truncated = true;
  }
  return out;
}

const NO_EVIDENCE = "There is no evidence in our sources for that.";

export function diseaseTool(map: DiseaseMap): ToolResponse {
  const items: ToolItem[] = [];
  for (const g of map.lines.genes.slice(0, 3)) {
    const assoc = str(g.edge_props.association_type);
    items.push(item(`Gene ${g.name} (${g.canonical_id}) is associated with ${map.disease.name}${assoc ? ` · ${assoc}` : ""} · ${cite(g)}`, g));
  }
  for (const p of map.lines.phenotypes.slice(0, 8)) {
    const f = str(p.edge_props.frequency);
    items.push(item(`Phenotype ${p.name} (${p.canonical_id})${f ? ` · frequency ${f}` : ""} · ${cite(p)}`, p));
  }
  const def = str(map.disease.props.definition);
  const prev = prevalenceLabel(map.disease.props.prevalence);
  return fit({
    ...head("disease", map), total: map.totals.genes + map.totals.phenotypes, items,
    note: [def ? `Definition (Orphanet): ${clip(def, 300)}` : null, prev ? `Prevalence (Orphanet): ${prev}` : null].filter(Boolean).join(" · ") || undefined,
  });
}

export function treatmentsTool(map: DiseaseMap): ToolResponse {
  const t = [...map.lines.treatments].sort((a, b) => Number(isApproved(b)) - Number(isApproved(a)) || (treatmentPhase(b) ?? 0) - (treatmentPhase(a) ?? 0));
  const items = t.slice(0, 8).map((s) => {
    const ph = treatmentPhase(s);
    const mech = mechanismOf(s);
    return item(`${s.name} (${s.canonical_id}) · ${isApproved(s) ? "approved" : "investigational"}${ph != null ? ` · phase ${ph}` : ""}${mech ? ` · ${mech}` : ""} · ${cite(s)}`, s);
  });
  return fit({ ...head("treatments", map), total: map.totals.treatments, items, note: items.length ? undefined : NO_EVIDENCE });
}

export function trialsTool(map: DiseaseMap, opts: { country?: string; recruiting?: boolean } = {}): ToolResponse {
  let t = [...map.lines.trials].sort((a, b) => Number(isRecruiting(b)) - Number(isRecruiting(a)));
  if (opts.country) {
    const c = opts.country.toLowerCase();
    t = t.filter((s) => countriesOf(s).some((x) => x.toLowerCase().includes(c)));
  }
  if (opts.recruiting) t = t.filter(isRecruiting);
  const items = t.slice(0, 6).map((s) => {
    const ph = trialPhases(s);
    const where = countriesOf(s);
    return item(`${s.canonical_id} · ${clip(s.name, 90)} · ${str(s.props.status) ?? "status not recorded"}${ph ? ` · phase ${ph}` : ""}${where.length ? ` · ${where.slice(0, 4).join(", ")}${where.length > 4 ? ` +${where.length - 4}` : ""}` : ""}`, s);
  });
  return fit({ ...head("trials", map), total: t.length, items, note: items.length ? undefined : NO_EVIDENCE });
}

export function literatureTool(map: DiseaseMap, limit = 5): ToolResponse {
  const items = map.lines.literature.slice(0, Math.min(Math.max(limit, 1), 8)).map((s) => {
    const journal = str(s.props.journal);
    return item(`${s.canonical_id} · ${clip(s.name, 120)}${journal ? ` · ${journal}` : ""}${s.evidence[0]?.published_on ? ` · ${s.evidence[0].published_on}` : ""}`, s);
  });
  return fit({ ...head("literature", map), total: map.totals.literature, items, note: items.length ? undefined : NO_EVIDENCE });
}

export function communitiesTool(map: DiseaseMap): ToolResponse {
  const items = map.lines.community.slice(0, 8).map((s) => {
    if (s.props.kind === "researcher") {
      return item(`Researcher ${s.name}${str(s.props.affiliation) ? ` · ${str(s.props.affiliation)}` : ""}${str(s.props.country) ? ` · ${str(s.props.country)}` : ""}${str(s.props.focus) ? ` · focus: ${str(s.props.focus)}` : ""}`, s);
    }
    const kind = s.props.kind === "research" ? "Research foundation" : "Patient organization";
    return item(`${kind} ${s.name}${str(s.props.country) ? ` (${str(s.props.country)})` : ""}${str(s.props.url) ? ` · ${str(s.props.url)}` : ""}`, s);
  });
  return fit({ ...head("communities", map), total: map.totals.community, items, note: items.length ? undefined : NO_EVIDENCE });
}

const GAP_TEXT: Record<string, (n: string) => string> = {
  empty_line: (line) => `No evidence in our sources for ${line}.`,
  no_approved_treatment: () => "No treatment in our sources is listed as approved.",
  no_recruiting_trial: () => "No registered trial is recruiting now.",
  no_researchers: () => "No researchers registered yet in the community.",
  low_confidence: (n) => `Low-confidence relation: ${n}.`,
  single_source: (n) => `Relation backed by a single source: ${n}.`,
};

export function gapsTool(map: DiseaseMap): ToolResponse {
  const items: ToolItem[] = map.gaps.slice(0, 10).map((g) => ({
    summary: GAP_TEXT[g.kind]?.(g.station ? `${g.station.name} (${g.station.canonical_id}) → ${map.disease.name}` : g.line) ?? g.kind,
    evidence_ids: g.evidence_ids.slice(0, 3),
  }));
  return fit({ ...head("gaps", map), total: map.gaps.length, items });
}

export interface MatchRow { orpha: string; name: string; score: number; matched: string[]; evidence_ids: string[] }

/** Rank maps by HPO overlap weighted by edge confidence (same rule as graph.phenotypeMatch). */
export function matchPhenotypes(maps: DiseaseMap[], hpo: string[]): MatchRow[] {
  const want = new Set(hpo.map((h) => h.trim().toUpperCase()));
  return maps
    .map((m) => {
      const hits = m.lines.phenotypes.filter((p) => want.has(p.canonical_id.toUpperCase()));
      return {
        orpha: m.disease.orpha, name: m.disease.name,
        score: Math.round(hits.reduce((s, p) => s + (p.confidence ?? 0.5), 0) * 100) / 100,
        matched: hits.map((p) => p.canonical_id), evidence_ids: hits.flatMap((p) => ids(p, 1)),
      };
    })
    .filter((r) => r.matched.length)
    .sort((a, b) => b.score - a.score);
}

export function phenotypeMatchTool(rows: MatchRow[], source: ToolResponse["source"], retrieved_at: string): ToolResponse {
  const items = rows.slice(0, 6).map((r) => ({ summary: `${r.name} (${r.orpha}) · ${r.matched.length} matching phenotypes (${r.matched.slice(0, 5).join(", ")}) · score ${r.score}`, evidence_ids: r.evidence_ids.slice(0, 4) }));
  return fit({ tool: "phenotype-match", disease: null, retrieved_at, source, total: rows.length, items, note: items.length ? "Differential support from sourced phenotypes, not a diagnosis." : NO_EVIDENCE });
}
