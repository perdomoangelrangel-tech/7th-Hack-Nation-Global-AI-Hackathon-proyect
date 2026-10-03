/**
 * Herramientas del agente sobre el grafo (data/atlas.json). Solo lectura.
 * Toda función devuelve { data, evidence } y nunca texto libre: lo que no tiene evidencia no sale.
 */
import "server-only";
import { atlas, neighborsOf, search } from "./atlas/store";
import type { Edge, Evidence } from "./atlas/types";

export type { Evidence };
export interface ToolResult<T> { data: T; evidence: Evidence[]; retrieved_at: string; note?: string }

const now = () => new Date().toISOString();
const ev = (edges: Edge[]) => edges.flatMap((e) => e.evidence);
const ids = (e: Edge) => e.evidence.map((x) => x.id);

/** Resuelve nombre, sinónimo, código ORPHA/MONDO, gen o síntoma a una enfermedad del atlas. */
export function findDisease(q: string) {
  const { byId } = atlas();
  if (byId.get(q)?.type === "disease") return byId.get(q)!;
  const direct = byId.get(`disease:${q}`); if (direct) return direct;
  const hit = search(q, "en", 1)[0];
  return hit?.disease ? byId.get(hit.disease)! : null;
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
  const support = inRel(d.id, "supports"); const research = inRel(d.id, "researches");
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
