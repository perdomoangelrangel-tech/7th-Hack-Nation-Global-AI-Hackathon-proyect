/**
 * Server-side: a small, real neighbourhood of one disease from the atlas snapshot, laid out
 * deterministically in 3D for the landing preview (no physics on the client). Pure function.
 */
import type { Edge, EdgeKind, Entity, EntityType } from "@/lib/atlas/types";

export interface PreviewNode { id: string; type: EntityType; name: string; pos: [number, number, number]; size: number; center?: boolean }
export interface PreviewEdge { id: string; from: string; to: string; kind: EdgeKind; relation: string }
export interface Neighborhood { center: string; centerName: string; nodes: PreviewNode[]; edges: PreviewEdge[] }

interface Index { byId: Map<string, Entity>; out: Map<string, Edge[]>; in: Map<string, Edge[]> }

type V = [number, number, number];
const norm = (v: V): V => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const add = (a: V, b: V, k = 1): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** n points fanned around `dir` (unit), `spread` = offset size on the tangent plane. */
function fan(dir: V, n: number, spread: number, twist = 0): V[] {
  const d = norm(dir);
  const u = norm(cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const w = cross(d, u);
  if (n === 1) return [d];
  return Array.from({ length: n }, (_, k) => {
    const a = twist + (Math.PI * 2 * k) / n;
    return norm(add(add(d, u, Math.cos(a) * spread), w, Math.sin(a) * spread));
  });
}

// Group directions + distances (three.js space, y up, camera on +z).
const GROUPS: { key: string; type: EntityType; relation: string; max: number; dir: V; r: number; spread: number; size: number }[] = [
  { key: "similar", type: "disease", relation: "similar_to", max: 4, dir: [1, 0.15, 0.1], r: 2.35, spread: 0.55, size: 0.27 },
  { key: "trials", type: "trial", relation: "studies", max: 3, dir: [0.35, 0.95, -0.35], r: 2.0, spread: 0.42, size: 0.2 },
  { key: "papers", type: "study", relation: "studies", max: 2, dir: [-0.35, 0.95, -0.45], r: 2.1, spread: 0.3, size: 0.19 },
  { key: "orgs", type: "organization", relation: "supports", max: 3, dir: [0.35, -0.45, 0.9], r: 2.05, spread: 0.42, size: 0.22 },
  { key: "phenotypes", type: "phenotype", relation: "has_phenotype", max: 4, dir: [-0.15, -1, 0.15], r: 1.95, spread: 0.5, size: 0.18 },
  { key: "people", type: "investigator", relation: "researches", max: 2, dir: [0.8, 0.55, 0.55], r: 2.15, spread: 0.3, size: 0.19 },
];

export function neighborhood(idx: Index, center: string): Neighborhood | null {
  const c = idx.byId.get(center);
  if (!c) return null;
  const touching = [...(idx.out.get(center) ?? []), ...(idx.in.get(center) ?? [])];
  const other = (e: Edge) => (e.from === center ? e.to : e.from);
  const nodes: PreviewNode[] = [{ id: c.id, type: c.type, name: c.name, pos: [0, 0, 0], size: 0.46, center: true }];
  const edges: PreviewEdge[] = [];
  const seen = new Set([c.id]);
  const push = (e: Edge, id: string, pos: V, size: number) => {
    const ent = idx.byId.get(id);
    if (!ent || seen.has(id)) return;
    seen.add(id);
    nodes.push({ id, type: ent.type, name: ent.name, pos, size });
    edges.push({ id: e.id, from: e.from, to: e.to, kind: e.kind, relation: e.relation });
  };

  // Gene (+ its pathways and a couple of variants, two hops) on the left.
  const causes = touching.filter((e) => e.relation === "causes").sort((a, b) => b.confidence - a.confidence)[0];
  if (causes) {
    const geneId = other(causes);
    const gpos: V = [-1.55, 0.35, 0.25];
    push(causes, geneId, gpos, 0.32);
    const gEdges = [...(idx.out.get(geneId) ?? []), ...(idx.in.get(geneId) ?? [])];
    const pathways = gEdges.filter((e) => e.relation === "participates_in").sort((a, b) => b.confidence - a.confidence).slice(0, 3);
    fan([-0.75, 0.75, -0.25], pathways.length, 0.6).forEach((d, i) => push(pathways[i], pathways[i].from === geneId ? pathways[i].to : pathways[i].from, add(gpos, d, 1.2), 0.21));
    const variants = gEdges.filter((e) => e.relation === "has_variant").sort((a, b) => b.confidence - a.confidence).slice(0, 2);
    fan([-0.7, -0.75, 0.35], variants.length, 0.45, 0.6).forEach((d, i) => push(variants[i], variants[i].from === geneId ? variants[i].to : variants[i].from, add(gpos, d, 1.05), 0.16));
  }

  for (const g of GROUPS) {
    const picks = touching
      .filter((e) => e.relation === g.relation && idx.byId.get(other(e))?.type === g.type)
      .sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id))
      .slice(0, g.max);
    fan(g.dir, picks.length, g.spread, 0.4).forEach((d, i) => push(picks[i], other(picks[i]), add([0, 0, 0], d, g.r), g.size));
  }
  return { center: c.id, centerName: c.name, nodes, edges };
}
