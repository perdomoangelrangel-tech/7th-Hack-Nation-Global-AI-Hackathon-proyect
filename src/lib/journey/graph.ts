/**
 * Pure graph helpers for the journey engine. No `server-only`, no "@/" imports: the engine runs in
 * route handlers (via ./server.ts) and in vitest against data/atlas.json or synthetic fixtures.
 */
import type { AtlasSnapshot, Edge, Entity, Evidence } from "../atlas/types";

export type Locale = "en" | "es";

/** Same shape as the index returned by `atlas()` in src/lib/atlas/store.ts (structurally compatible). */
export interface GraphIndex {
  snap: AtlasSnapshot;
  byId: Map<string, Entity>;
  edgeById: Map<string, Edge>;
  out: Map<string, Edge[]>;
  in: Map<string, Edge[]>;
  evidenceById: Map<string, Evidence>;
}

export function indexSnapshot(snap: AtlasSnapshot): GraphIndex {
  const byId = new Map(snap.entities.map((e) => [e.id, e]));
  const edgeById = new Map(snap.edges.map((e) => [e.id, e]));
  const out = new Map<string, Edge[]>();
  const inn = new Map<string, Edge[]>();
  const evidenceById = new Map<string, Evidence>();
  for (const e of snap.edges) {
    const o = out.get(e.from); if (o) o.push(e); else out.set(e.from, [e]);
    const i = inn.get(e.to); if (i) i.push(e); else inn.set(e.to, [e]);
    for (const ev of e.evidence) evidenceById.set(ev.id, ev);
  }
  return { snap, byId, edgeById, out, in: inn, evidenceById };
}

export const outOf = (g: GraphIndex, id: string) => g.out.get(id) ?? [];
export const inOf = (g: GraphIndex, id: string) => g.in.get(id) ?? [];
export const other = (e: Edge, id: string) => (e.from === id ? e.to : e.from);
export const diseasesOf = (g: GraphIndex) => g.snap.entities.filter((e) => e.type === "disease");

/** Short display name ("STXBP1-DEE") in the requested locale; mirrors nameOf() in store.ts. */
export function nameOf(e: Entity | undefined, l: Locale): string {
  if (!e) return "";
  const p = e.props as Record<string, string | undefined>;
  return (l === "es" ? p.short_name_es ?? p.name_es : p.short_name) ?? (l === "es" ? p.name_es : undefined) ?? e.name;
}
export const fullNameOf = (e: Entity | undefined, l: Locale) => (e ? (l === "es" && typeof e.props.name_es === "string" ? e.props.name_es : e.name) : "");

/** A citation: the edge ids and the evidence ids behind them (what the verifier accepts). */
export interface Cite { edges: string[]; evidence: string[]; kinds: Edge["kind"][] }

/** Builds a citation from edge ids, dropping ids that are not in the graph. Never invents. */
export function cite(g: GraphIndex, edgeIds: Iterable<string>): Cite {
  const edges: string[] = []; const evidence: string[] = []; const kinds = new Set<Edge["kind"]>();
  for (const id of new Set(edgeIds)) {
    const e = g.edgeById.get(id); if (!e) continue;
    edges.push(id); kinds.add(e.kind);
    for (const ev of e.evidence) evidence.push(ev.id);
  }
  return { edges, evidence: [...new Set(evidence)], kinds: [...kinds] };
}

export const tr = (l: Locale, en: string, es: string) => (l === "es" ? es : en);

export const ACTIVE_STATUSES = new Set(["RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING", "ENROLLING_BY_INVITATION", "AVAILABLE"]);
export const prettyStatus = (s: string) => s.replace(/_/g, " ").toLowerCase();

/** Nedamex's own analysis (inferred similarity). Data renamed the source id; accept the legacy one too. */
export const isAnalysisSource = (source: string) => source === "nexmed_analysis" || source === "atlas_analysis";
export const ANALYSIS_LABEL = { en: "Nedamex analysis", es: "Análisis de Nedamex" } as const;
