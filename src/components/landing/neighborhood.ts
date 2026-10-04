/**
 * Server-side: a real slice of one disease's neighbourhood from the atlas snapshot, laid out ONCE as an ordered
 * radial diagram (WAVE 5B "same radial, ordered layout"): no physics, no drift.
 *   centre  = the disease
 *   ring 1  = its gene + the pathways that gene takes part in (mechanism), left
 *   ring 2  = neighbour diseases Nedamex infers (dashed), right, ordered by strength (Strong / Possible / Weak lead)
 *   ring 3  = labelled sectors: Studies & assets (top) · People (upper left) · Symptoms (bottom) · Treatments (top right)
 * Coordinates are in a plane (x right, y up) with a little z per ring for depth in 3D. Pure function.
 */
import { strengthOf, type Strength } from "@/components/atlas/evidence";
import type { AtlasSnapshot, Edge, EdgeKind, Entity, EntityType } from "@/lib/atlas/types";

export type SectorKey = "mechanism" | "similar" | "studies" | "people" | "symptoms" | "treatments";
export interface PreviewNode {
  id: string; type: EntityType; name: string; /** short real label (alias) for the diagram */ label: string; pos: [number, number, number]; size: number;
  ring: 0 | 1 | 2 | 3; sector?: SectorKey; center?: boolean; strength?: Strength; angle: number;
}
export interface PreviewEdge { id: string; from: string; to: string; kind: EdgeKind; relation: string }
export interface PreviewSector { key: SectorKey; title: string; pos: [number, number, number]; angle: number; count: number }
export interface Neighborhood { center: string; centerName: string; nodes: PreviewNode[]; edges: PreviewEdge[]; sectors: PreviewSector[] }

interface Index { snap: AtlasSnapshot; byId: Map<string, Entity>; out: Map<string, Edge[]>; in: Map<string, Edge[]> }

export const RING_R = [0, 1.45, 2.6, 3.6] as const;
const RING_Z = [0.25, 0.15, 0.05, -0.1] as const;
const deg = (d: number) => (d * Math.PI) / 180;
const at = (r: number, a: number, z: number): [number, number, number] => [r * Math.cos(deg(a)), r * Math.sin(deg(a)), z];
/** n angles evenly spread across [from, to] (centred when n = 1). */
const spread = (n: number, from: number, to: number) => (n <= 1 ? [(from + to) / 2] : Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1)));

/** A short, real label: the name if short, else an English alias ("STXBP1 encephalopathy", "KCNQ2-DEE", "EIMFS"), else a clipped name. */
export function shortLabel(e: Entity, max = 30): string {
  if (e.name.length <= max) return e.name;
  const en = e.aliases.filter((a) => a.lang !== "es" && a.alias.length >= 3 && a.alias.length <= 24 && a.alias !== e.name).map((a) => a.alias);
  const pick = en.find((a) => /-DEE$/.test(a)) ?? en.find((a) => /encephalopathy|syndrome|disease|epilepsy/i.test(a) && /[A-Z0-9]{3,}/.test(a)) ?? en.find((a) => /^[A-Z0-9-]{3,10}$/.test(a) && !/^[A-Z]+[0-9]+$/.test(a));
  return pick ?? `${e.name.slice(0, max - 1)}…`;
}

const STRENGTH_RANK: Record<Strength, number> = { strong: 0, possible: 1, weak: 2 };

export function neighborhood(idx: Index, center: string): Neighborhood | null {
  const c = idx.byId.get(center);
  if (!c) return null;
  const edgesOf = (id: string) => [...(idx.out.get(id) ?? []), ...(idx.in.get(id) ?? [])];
  const other = (e: Edge, id: string) => (e.from === id ? e.to : e.from);
  const typeOf = (id: string) => idx.byId.get(id)?.type;
  const touching = edgesOf(center);

  const nodes: PreviewNode[] = [{ id: c.id, type: c.type, name: c.name, label: shortLabel(c, 34), pos: [0, 0, RING_Z[0]], size: 0.46, ring: 0, center: true, angle: 0 }];
  const edges: PreviewEdge[] = [];
  const seen = new Set([c.id]);
  const add = (e: Edge, id: string, ring: 1 | 2 | 3, angle: number, size: number, sector: SectorKey, strength?: Strength) => {
    const ent = idx.byId.get(id);
    if (!ent || seen.has(id)) return false;
    seen.add(id);
    nodes.push({ id, type: ent.type, name: ent.name, label: shortLabel(ent, ring === 1 ? 26 : 28), pos: at(RING_R[ring], angle, RING_Z[ring]), size, ring, sector, strength, angle });
    edges.push({ id: e.id, from: e.from, to: e.to, kind: e.kind, relation: e.relation });
    return true;
  };
  const byConfidence = (a: Edge, b: Edge) => b.confidence - a.confidence || a.id.localeCompare(b.id);
  const sectors: PreviewSector[] = [];
  // Headers sit where no node label goes: ring 3 just outside its arc; mechanism below-left of the gene; similar above its fan.
  const sector = (key: SectorKey, title: string, ring: 1 | 2 | 3, angle: number, count: number) => {
    if (count <= 0) return;
    const [r, a] = ring === 3 ? [RING_R[3] + 0.8, angle] : ring === 2 ? [RING_R[2] + 0.55, 44] : [RING_R[1] + 0.75, 232];
    sectors.push({ key, title, angle: a, count, pos: at(r, a, RING_Z[ring]) });
  };

  // Ring 1 · mechanism: the gene (left) and the pathways it takes part in, either side of it.
  const causes = touching.filter((e) => e.relation === "causes").sort(byConfidence)[0];
  let ring1 = 0;
  if (causes) {
    const geneId = other(causes, center);
    if (add(causes, geneId, 1, 180, 0.3, "mechanism")) ring1++;
    const pathways = edgesOf(geneId).filter((e) => e.relation === "participates_in").sort(byConfidence).slice(0, 2);
    pathways.forEach((e, i) => {
      if (add(e, other(e, geneId), 1, i === 0 ? 155 : 205, 0.22, "mechanism")) ring1++;
    });
  }
  sector("mechanism", "Mechanism", 1, 180, ring1);

  // Ring 2 · similar diseases (inferred), strongest first, fanned on the right.
  const similar = touching
    .filter((e) => e.relation === "similar_to" && typeOf(other(e, center)) === "disease")
    .map((e) => {
      const sim = idx.snap.analytics?.similarity?.[e.id];
      return { e, strength: sim ? strengthOf(sim) : ("weak" as Strength) };
    })
    .sort((a, b) => STRENGTH_RANK[a.strength] - STRENGTH_RANK[b.strength] || byConfidence(a.e, b.e))
    .slice(0, 4);
  spread(similar.length, 30, -30).forEach((a, i) => {
    const { e, strength } = similar[i];
    add(e, other(e, center), 2, a, strength === "strong" ? 0.3 : strength === "possible" ? 0.26 : 0.22, "similar", strength);
  });
  sector("similar", "Similar diseases", 2, 0, similar.length);

  // Ring 3 · labelled sectors.
  const pick = (pred: (e: Edge, t: EntityType | undefined) => boolean, n: number) =>
    touching.filter((e) => pred(e, typeOf(other(e, center)))).sort(byConfidence).slice(0, n);
  const studies = [...pick((e, t) => e.relation === "studies" && t === "trial", 3), ...pick((e, t) => e.relation === "studies" && t === "study", 1)];
  const people = [...pick((e, t) => e.relation === "supports" && t === "organization", 2), ...pick((e, t) => e.relation === "researches" && t === "investigator", 1)];
  const symptoms = pick((e, t) => e.relation === "has_phenotype" && t === "phenotype", 5);
  const treatments = pick((e, t) => e.relation === "treats" && t === "treatment", 2);

  const place = (list: Edge[], from: number, to: number, key: SectorKey, title: string, size: number) => {
    const angles = spread(list.length, from, to);
    let n = 0;
    list.forEach((e, i) => { if (add(e, other(e, center), 3, angles[i], size, key)) n++; });
    sector(key, title, 3, (from + to) / 2, n);
  };
  place(studies, 72, 108, "studies", "Studies & assets", 0.19);
  place(people, 124, 146, "people", "People", 0.19);
  place(symptoms, 236, 304, "symptoms", "Symptoms", 0.18);
  place(treatments, 48, 58, "treatments", "Treatments", 0.19);

  return { center: c.id, centerName: c.name, nodes, edges, sectors };
}
