/**
 * Deterministic layouts (WAVE 5B): positions computed once (fx/fy, fz by ring in 3D) — the canvas never drifts.
 *
 * Route (default with a focused disease):
 *   center = focus · ring 1 = its gene(s) + mechanism (variant effect) + pathways · ring 2 = neighbour diseases
 *   (same cluster first, then Strong → Possible → Weak) · ring 3 = labelled sectors: Symptoms (top 8 by information
 *   content) · Studies & assets (reusable first, then active trials) · People (patient groups, researchers) ·
 *   Treatments. Each sector shows its top N; a header node "+N more" expands it.
 * Constellation: clusters as labelled regions around a circle, diseases inside their region.
 */
import type { GLink, GNode, GraphView } from "@/lib/atlas/store";
import type { Strength } from "./evidence";

export type Sector = "symptoms" | "studies" | "people" | "treatments";
export type Layer = "mechanism" | Sector;
export const SECTORS: Sector[] = ["symptoms", "studies", "people", "treatments"];
export const LAYERS: Layer[] = ["mechanism", ...SECTORS];

/** Ring radii in graph units: ≥ 140 px apart at 1440 once fitted (horizontal axis; the canvas is wider than tall, so
 *  rings are a mild ellipse — y × YSCALE). */
export const RING = [0, 145, 290, 435] as const;
export const YSCALE = 0.72;
const TOP: Record<Sector, number> = { symptoms: 8, studies: 5, people: 5, treatments: 5 };
/** Sector wedge centers (degrees, 0 = right, clockwise in screen space). */
const SECTOR_ANGLE: Record<Sector, number> = { symptoms: -135, studies: -45, people: 45, treatments: 135 };
const REUSABLE = ["natural_history", "registry", "biomarker_study"];

const end = (v: unknown) => (typeof v === "object" && v ? String((v as { id: string }).id) : String(v));
const rad = (deg: number) => (deg * Math.PI) / 180;
const STRENGTH_RANK: Record<Strength, number> = { strong: 0, possible: 1, weak: 2 };

export interface SectorInfo { sector: Sector; shown: number; total: number; expanded: boolean }
export interface LaidOut { view: GraphView; labelIds: Set<string>; sectors: SectorInfo[] }

type Placed = GNode & { x: number; y: number; z: number; fx: number; fy: number; fz: number; ring?: number };
const place = (n: GNode, angleDeg: number, r: number, ring: number, extra: Partial<GNode> = {}): Placed => {
  const x = Math.round(r * Math.cos(rad(angleDeg)) * 10) / 10, y = Math.round(r * YSCALE * Math.sin(rad(angleDeg)) * 10) / 10, z = -ring * 40;
  return { ...n, ...extra, x, y, z, fx: x, fy: y, fz: z, ring };
};
/** Evenly around a full circle, starting at `offset` degrees. */
const around = (count: number, offset: number) => Array.from({ length: count }, (_, i) => offset + (360 * i) / Math.max(1, count));

export function routeLayout(view: GraphView, focus: string, opts: {
  strength: Record<string, Strength>; expanded: Set<Sector>; layers: Set<Layer>; strengthLabel?: Record<Strength, string>;
  sectorLabel: Record<Sector, string>; moreLabel: (n: number) => string; fewerLabel: string; noneLabel: string;
}): LaidOut {
  const byId = new Map(view.nodes.map((n) => [n.id, n]));
  const fn = byId.get(focus);
  if (!fn) return { view, labelIds: new Set(), sectors: [] };
  const linked = (a: string, pred: (l: GLink, other: string) => boolean) => view.links.flatMap((l) => {
    const s = end(l.source), t = end(l.target);
    if (s === a && pred(l, t)) return [t]; if (t === a && pred(l, s)) return [s]; return [];
  });
  const uniq = (ids: string[]) => [...new Set(ids)].filter((id) => byId.has(id));
  const type = (id: string) => byId.get(id)?.type as string | undefined;

  // Ring 1: genes (+ mechanism and up to 4 pathways when the Mechanism layer is on)
  const genes = uniq(linked(focus, (_, o) => type(o) === "gene"));
  const mech = opts.layers.has("mechanism") ? uniq(linked(focus, (l, o) => l.relation === "has_mechanism" && type(o) === "mechanism")) : [];
  const pathways = opts.layers.has("mechanism") ? uniq(genes.flatMap((g) => linked(g, (_, o) => type(o) === "pathway"))).slice(0, 2) : [];
  const ring1 = [...genes, ...mech, ...pathways];

  // Ring 2: neighbour diseases (similar_to) — same cluster first, then strength, then confidence
  const simConf = new Map<string, number>();
  for (const l of view.links) if (l.relation === "similar_to") {
    const s = end(l.source), t = end(l.target);
    if (s === focus) simConf.set(t, l.confidence); else if (t === focus) simConf.set(s, l.confidence);
  }
  const ring2 = [...simConf.keys()].filter((id) => byId.has(id)).sort((a, b) => {
    const ca = Number(byId.get(a)!.cluster === fn.cluster), cb = Number(byId.get(b)!.cluster === fn.cluster);
    const sa = STRENGTH_RANK[opts.strength[a] ?? "weak"], sb = STRENGTH_RANK[opts.strength[b] ?? "weak"];
    return cb - ca || sa - sb || (simConf.get(b) ?? 0) - (simConf.get(a) ?? 0);
  });

  // Ring 3: sectors
  const ic = (id: string) => Number((byId.get(id)?.props as { ic?: number } | undefined)?.ic ?? 0);
  const reusable = (id: string) => REUSABLE.includes(String((byId.get(id)?.props as { asset_kind?: string } | undefined)?.asset_kind));
  const ring2Set = new Set(ring2);
  const pool: Record<Sector, string[]> = {
    symptoms: uniq(linked(focus, (_, o) => type(o) === "phenotype")).sort((a, b) => ic(b) - ic(a)),
    studies: uniq(linked(focus, (_, o) => type(o) === "trial" || type(o) === "study")).sort((a, b) => Number(reusable(b)) - Number(reusable(a))),
    people: uniq([
      ...linked(focus, (_, o) => type(o) === "organization" || type(o) === "investigator"),
      ...ring2.flatMap((d) => linked(d, (_, o) => type(o) === "organization" || type(o) === "investigator")),
    ]),
    treatments: uniq(linked(focus, (_, o) => type(o) === "treatment")),
  };

  const out: Placed[] = [place(fn, 0, 0, 0, { size: 18 })];
  const labelIds = new Set<string>([focus]);
  around(ring1.length, -90).forEach((a, i) => { out.push(place(byId.get(ring1[i])!, a, RING[1], 1, { size: 12 })); labelIds.add(ring1[i]); });
  around(ring2.length, -90 + 180 / Math.max(1, ring2.length)).forEach((a, i) => {
    const id = ring2[i]; const st = opts.strength[id];
    out.push(place(byId.get(id)!, a, RING[2], 2, { size: 13, ...(st && opts.strengthLabel ? { name: `${byId.get(id)!.name} · ${opts.strengthLabel[st]}` } : {}) }));
    labelIds.add(id);
  });

  const sectors: SectorInfo[] = [];
  for (const sector of SECTORS) {
    if (!opts.layers.has(sector)) continue;
    const all = pool[sector].filter((id) => !ring2Set.has(id) && !ring1.includes(id));
    const expanded = opts.expanded.has(sector);
    const shown = expanded ? all : all.slice(0, TOP[sector]);
    // Two sub-rings when a sector is long, spread across a 76° wedge.
    const perRow = 8, span = 76, c = SECTOR_ANGLE[sector];
    shown.forEach((id, i) => {
      const row = Math.floor(i / perRow), inRow = Math.min(perRow, shown.length - row * perRow), k = i % perRow;
      const a = inRow === 1 ? c : c - span / 2 + (span * k) / (inRow - 1);
      out.push(place(byId.get(id)!, a, RING[3] + row * 70, 3, { size: 8 }));
    });
    const rows = Math.max(1, Math.ceil(shown.length / perRow));
    const more = all.length - shown.length;
    const label = `${opts.sectorLabel[sector]} · ${all.length ? (more > 0 ? opts.moreLabel(more) : expanded && all.length > TOP[sector] ? opts.fewerLabel : String(all.length)) : opts.noneLabel}`;
    const header: GNode = { id: `sector:${sector}`, type: "study", name: label, cluster: null, color: null, size: 4, header: sector };
    out.push(place(header, c, RING[3] + (rows - 1) * 70 + 46, 3));
    labelIds.add(header.id);
    sectors.push({ sector, shown: shown.length, total: all.length, expanded });
  }

  const keep = new Set(out.map((n) => n.id));
  const links = view.links.filter((l) => keep.has(end(l.source)) && keep.has(end(l.target)));
  return { view: { ...view, nodes: out, links }, labelIds, sectors };
}

/** Constellation: clusters as labelled regions around a circle, diseases inside their region. Diseases only. */
export function constellationLayout(view: GraphView): LaidOut {
  const diseases = view.nodes.filter((n) => n.type === "disease");
  const clusters = view.clusters.filter((c) => c.diseases.some((d) => diseases.some((n) => n.id === d)));
  const k = Math.max(1, clusters.length);
  const R = 230 + 40 * k;
  const out: Placed[] = [];
  const labelIds = new Set<string>();
  const placed = new Set<string>();
  clusters.forEach((c, i) => {
    const a = -90 + (360 * i) / k;
    const cx = R * Math.cos(rad(a)), cy = R * Math.sin(rad(a));
    const members = diseases.filter((n) => c.diseases.includes(n.id));
    const rr = members.length === 1 ? 0 : 46 + 14 * members.length;
    members.forEach((n, j) => {
      const b = -90 + (360 * j) / Math.max(1, members.length);
      const x = Math.round((cx + rr * Math.cos(rad(b))) * 10) / 10, y = Math.round((cy + rr * Math.sin(rad(b))) * 10) / 10;
      out.push({ ...n, x, y, z: 0, fx: x, fy: y, fz: 0 }); labelIds.add(n.id); placed.add(n.id);
    });
    // Region label outside the region, away from the circle's center.
    const lr = rr + 70;
    const hx = Math.round((cx + lr * Math.cos(rad(a))) * 10) / 10, hy = Math.round((cy + lr * Math.sin(rad(a))) * 10) / 10;
    const header: GNode = { id: `region:${c.id}`, type: "study", name: c.label, cluster: c.id, color: c.color, size: 4, header: "region" };
    out.push({ ...header, x: hx, y: hy, z: 0, fx: hx, fy: hy, fz: 0 }); labelIds.add(header.id);
  });
  const rest = diseases.filter((n) => !placed.has(n.id));
  rest.forEach((n, j) => {
    const b = (360 * j) / Math.max(1, rest.length), x = Math.round(60 * Math.cos(rad(b)) * 10) / 10, y = Math.round(60 * Math.sin(rad(b)) * 10) / 10;
    out.push({ ...n, x, y, z: 0, fx: x, fy: y, fz: 0 }); labelIds.add(n.id);
  });
  const keep = new Set(out.map((n) => n.id));
  const links = view.links.filter((l) => l.relation === "similar_to" && keep.has(end(l.source)) && keep.has(end(l.target)));
  return { view: { ...view, nodes: out, links }, labelIds, sectors: [] };
}
