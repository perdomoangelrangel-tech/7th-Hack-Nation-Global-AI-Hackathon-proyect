/**
 * Agent tools over the graph (read only). Used by ElevenLabs server tools (/api/tools/*) and the voice agents.
 * Every function returns { data, evidence } and never free text: what has no evidence does not come out.
 */
import "server-only";
import { atlas, neighborsOf } from "./atlas/store";
import type { Edge, Evidence } from "./atlas/types";
import { findDiseaseInText, reconcileOne } from "./ai/reconcile";
import { explain } from "./ai/explain";
import type { PersonaId } from "./agents/profiles";

export type { Evidence };
export interface ToolResult<T> { data: T; evidence: Evidence[]; retrieved_at: string; note?: string }

const now = () => new Date().toISOString();
const ev = (edges: Edge[]) => edges.flatMap((e) => e.evidence);
const ids = (e: Edge) => e.evidence.map((x) => x.id);

/**
 * Name, synonym, ORPHA/MONDO code, entity id or gene → an atlas disease. Strict (same resolver as /api/ask):
 * unknown names return null instead of the closest-looking disease.
 */
export function findDisease(q: string) {
  const idx = atlas();
  const { byId } = idx;
  if (!q.trim()) return null;
  if (byId.get(q)?.type === "disease") return byId.get(q)!;
  const direct = byId.get(`disease:${q}`); if (direct) return direct;
  const hit = findDiseaseInText(idx, q);
  return hit ? byId.get(hit.disease) ?? null : null;
}
const inRel = (d: string, rel: string) => (atlas().in.get(d) ?? []).filter((e) => e.relation === rel);
const outRel = (d: string, rel: string) => (atlas().out.get(d) ?? []).filter((e) => e.relation === rel);

export async function diseaseProfile(q: string): Promise<ToolResult<unknown> | null> {
  const d = findDisease(q); if (!d) return null;
  const { byId, snap } = atlas();
  const genes = inRel(d.id, "causes"); const phen = outRel(d.id, "has_phenotype");
  return {
    data: {
      disease: { id: d.id, canonical_id: d.canonical_id, name: d.name, definition: d.props.definition, prevalence: d.props.prevalence, cluster: snap.analytics?.disease_cluster[d.id], variant_effect: snap.analytics?.variant_effect[d.id] },
      genes: genes.map((e) => ({ symbol: byId.get(e.from)?.name, association: e.props.association_type, confidence: e.confidence, evidence_ids: ids(e) })),
      phenotypes: phen.sort((a, b) => b.confidence - a.confidence).slice(0, 40).map((e) => ({ hpo: byId.get(e.to)?.canonical_id, term: byId.get(e.to)?.name, frequency: e.props.frequency, ic: byId.get(e.to)?.props.ic, evidence_ids: ids(e) })),
      neighbors: neighborsOf(d.id).map((n) => ({ disease: byId.get(n.disease)?.name, score: n.score, kind: "inferred", shared_phenotypes: n.explanation.shared_phenotypes.slice(0, 5).map((p) => p.name), shared_pathways: n.explanation.shared_pathways.map((p) => p.name), evidence_ids: atlas().edgeById.get(n.edge)?.evidence.map((x) => x.id) ?? [] })),
    },
    evidence: [...ev(genes), ...ev(phen.slice(0, 40)), ...neighborsOf(d.id).flatMap((n) => atlas().edgeById.get(n.edge)?.evidence ?? [])], retrieved_at: now(),
  };
}

export async function trialsFor(q: string, country?: string): Promise<ToolResult<unknown> | null> {
  const d = findDisease(q); if (!d) return null;
  const { byId } = atlas();
  let rows = inRel(d.id, "studies").filter((e) => byId.get(e.from)?.type === "trial");
  if (country) rows = rows.filter((e) => ((byId.get(e.from)?.props.countries as string[]) ?? []).some((c) => c.toLowerCase().includes(country.toLowerCase())));
  return { data: rows.map((e) => ({ nct: byId.get(e.from)?.canonical_id, title: byId.get(e.from)?.name, ...byId.get(e.from)?.props, evidence_ids: ids(e) })), evidence: ev(rows), retrieved_at: now() };
}

export async function treatmentsFor(q: string): Promise<ToolResult<unknown> | null> {
  const d = findDisease(q); if (!d) return null;
  const rows = inRel(d.id, "treats");
  return {
    data: rows.map((e) => ({ id: atlas().byId.get(e.from)?.canonical_id, name: atlas().byId.get(e.from)?.name, ...atlas().byId.get(e.from)?.props, stage: e.props.stage, approved: e.props.approved, confidence: e.confidence, evidence_ids: ids(e) })),
    evidence: ev(rows), retrieved_at: now(), note: rows.length ? undefined : "No documented treatments in our sources for this disease.",
  };
}

export async function literatureFor(q: string, limit = 15): Promise<ToolResult<unknown> | null> {
  const d = findDisease(q); if (!d) return null;
  const rows = inRel(d.id, "studies").filter((e) => atlas().byId.get(e.from)?.type === "study")
    .sort((a, b) => (b.evidence[0]?.published_on ?? "").localeCompare(a.evidence[0]?.published_on ?? "")).slice(0, limit);
  return { data: rows.map((e) => ({ pmid: atlas().byId.get(e.from)?.canonical_id, title: atlas().byId.get(e.from)?.name, ...atlas().byId.get(e.from)?.props, published_on: e.evidence[0]?.published_on, evidence_ids: ids(e) })), evidence: ev(rows), retrieved_at: now() };
}

export async function communitiesFor(q: string): Promise<ToolResult<unknown> | null> {
  const d = findDisease(q); if (!d) return null;
  const { byId } = atlas();
  const support = inRel(d.id, "supports").sort((a, b) => Number(a.props.kind === "umbrella") - Number(b.props.kind === "umbrella")); // this exact diagnosis first
  const research = inRel(d.id, "researches");
  const map = (e: Edge) => ({ name: byId.get(e.from)?.name, type: byId.get(e.from)?.type, ...byId.get(e.from)?.props, ...e.props, evidence_ids: ids(e) });
  return { data: { patient_organizations: support.map(map), research_communities: research.slice(0, 40).map(map) }, evidence: ev([...support, ...research.slice(0, 40)]), retrieved_at: now() };
}

export async function gapsFor(q: string): Promise<ToolResult<unknown> | null> {
  const d = findDisease(q); if (!d) return null;
  const A = atlas().snap.analytics;
  const treatments = inRel(d.id, "treats");
  return {
    data: { gaps: A?.gaps.filter((g) => g.disease === d.id) ?? [], has_approved_treatment: treatments.some((t) => t.props.approved), treatment_candidates: treatments.length },
    evidence: ev(treatments), retrieved_at: now(),
  };
}

/** Diferencial por fenotipos HPO: suma de confianza × IC de los términos que coinciden. */
export async function phenotypeMatch(hpoIds: string[], limit = 10): Promise<ToolResult<unknown>> {
  const { byId, snap } = atlas();
  const rows = snap.edges.filter((e) => e.relation === "has_phenotype" && hpoIds.includes(byId.get(e.to)?.canonical_id ?? ""));
  const score = new Map<string, { disease: string; canonical_id: string; score: number; matched: string[]; evidence_ids: string[] }>();
  for (const r of rows) {
    const d = byId.get(r.from)!;
    const s = score.get(d.id) ?? { disease: d.name, canonical_id: d.canonical_id, score: 0, matched: [], evidence_ids: [] };
    s.score += r.confidence * Number(byId.get(r.to)?.props.ic ?? 0.5); s.matched.push(byId.get(r.to)!.canonical_id); s.evidence_ids.push(...ids(r));
    score.set(d.id, s);
  }
  return { data: [...score.values()].sort((a, b) => b.score - a.score).slice(0, limit), evidence: ev(rows), retrieved_at: now() };
}

/** Diseases the atlas links to this one (INFERRED similar_to edges), strongest first, with why. */
export async function neighborsFor(q: string, limit = 6): Promise<ToolResult<unknown> | null> {
  const d = findDisease(q); if (!d) return null;
  const { byId, edgeById } = atlas();
  const ns = neighborsOf(d.id).slice(0, limit);
  return {
    data: {
      disease: { id: d.id, name: d.name },
      neighbors: ns.map((n) => ({
        disease_id: n.disease, disease: byId.get(n.disease)?.name, score: n.score, kind: "inferred", edge_id: n.edge, same_cluster: n.same_cluster,
        shared_phenotypes: n.explanation?.shared_phenotypes.slice(0, 5).map((p) => p.name) ?? [], shared_pathways: n.explanation?.shared_pathways.map((p) => p.name) ?? [],
        variant_effect_match: n.explanation?.variant_effect_match ?? null, evidence_ids: edgeById.get(n.edge)?.evidence.map((x) => x.id) ?? [],
      })),
      wording: "Inferred by Nexmed analysis: say 'the atlas suggests' and that it needs expert review.",
    },
    evidence: ns.flatMap((n) => edgeById.get(n.edge)?.evidence ?? []), retrieved_at: now(),
    note: ns.length ? undefined : "The atlas found no close neighbor for this disease; no shared mechanism is claimed.",
  };
}

/** The mechanism cluster a disease belongs to, its members and what they share. */
export async function clusterFor(q: string): Promise<ToolResult<unknown> | null> {
  const d = findDisease(q); if (!d) return null;
  const { snap, byId } = atlas();
  const A = snap.analytics;
  const cid = A?.disease_cluster[d.id];
  const c = A?.clusters.find((x) => x.id === cid);
  if (!c) return { data: { disease: { id: d.id, name: d.name }, cluster: null }, evidence: [], retrieved_at: now(), note: "This disease is not in a mechanism cluster." };
  const members = new Set(c.diseases);
  const inside = snap.edges.filter((e) => e.relation === "similar_to" && members.has(e.from) && members.has(e.to));
  const counterexamples = (A?.counterexamples ?? []).filter((x) => x.a === d.id || x.b === d.id).map((x) => ({ a: byId.get(x.a)?.name, b: byId.get(x.b)?.name, why: x.why, kind: x.kind ?? "same_symptoms_different_mechanism" }));
  const gaps = (A?.gaps ?? []).filter((g) => members.has(g.disease)).map((g) => ({ disease: byId.get(g.disease)?.name, kind: g.kind, detail: g.detail }));
  return {
    data: {
      disease: { id: d.id, name: d.name },
      cluster: { id: c.id, label: c.label, label_basis: c.label_basis, diseases: c.diseases.map((x) => ({ id: x, name: byId.get(x)?.name })), shared_pathways: c.shared_pathways.slice(0, 5), shared_phenotypes: c.shared_phenotypes.slice(0, 5).map((p) => p.name) },
      links: inside.map((e) => ({ edge_id: e.id, a: byId.get(e.from)?.name, b: byId.get(e.to)?.name, score: e.confidence, kind: e.kind, evidence_ids: ids(e) })),
      counterexamples, unmet_need: gaps,
      wording: "Clusters are computed by Nexmed (inferred): present them as hypotheses that need expert review.",
    },
    evidence: ev(inside), retrieved_at: now(),
  };
}

/** Plain-language, verified explanation of a list of edges (same engine as POST /api/explain). */
export async function explainPath(edgeIds: string[], persona: PersonaId, locale: "en" | "es", simple = false): Promise<ToolResult<unknown>> {
  const idx = atlas();
  const r = await explain(idx, { edgeIds, persona, locale, simple });
  const cited = new Set(r.sentences.flatMap((s) => s.evidence_ids));
  return { data: r, evidence: [...cited].map((id) => idx.evidenceById.get(id)).filter((x): x is Evidence => !!x), retrieved_at: now() };
}

/** Resolve a free-text name to an atlas entity (deterministic reconcile, no model). */
export async function resolveName(q: string): Promise<ToolResult<unknown>> {
  const m = reconcileOne(atlas(), q);
  return { data: m, evidence: [], retrieved_at: now(), note: m.entity_id ? undefined : "Not in the atlas. Do not guess an identifier." };
}
