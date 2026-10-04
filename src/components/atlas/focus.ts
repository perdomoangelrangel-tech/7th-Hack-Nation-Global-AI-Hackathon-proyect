/**
 * "One route, not a map" (UX_WAVE4 §4.3): the default Focus view keeps the focus disease, its direct neighbours
 * (1 hop) and the endpoints of the route edges (the edges the journey cites). "All" shows the full view.
 */
import type { GLink, GraphView, Journey } from "@/lib/atlas/store";

const end = (v: unknown) => (typeof v === "object" && v ? String((v as { id: string }).id) : String(v));

/** Every edge the route cites: neighbours, assets, collaborators and next steps. */
export function routeEdges(j: Journey | null): Set<string> {
  if (!j) return new Set();
  return new Set([
    ...j.shares.map((s) => s.edge),
    ...j.assets.own.map((a) => a.edge), ...j.assets.reusable.map((a) => a.edge),
    ...j.assets.treatments.map((x) => x.edge), ...j.assets.neighbor_approved.map((x) => x.edge),
    ...j.collaborators.flatMap((c) => c.edges),
    ...j.steps.flatMap((s) => s.evidence_edges),
  ].filter(Boolean));
}

export function focusView(view: GraphView, focus: string, route: Set<string>): GraphView {
  const keep = new Set([focus]);
  for (const l of view.links) {
    const a = end(l.source), b = end(l.target);
    if (a === focus) keep.add(b);
    if (b === focus) keep.add(a);
    if (route.has(l.id)) { keep.add(a); keep.add(b); }
  }
  // Mechanism of every kept disease (variant-effect class: loss vs gain/altered function).
  for (const l of view.links) if (l.relation === "has_mechanism" && keep.has(end(l.source))) keep.add(end(l.target));
  const nodes = view.nodes.filter((n) => keep.has(n.id));
  const links: GLink[] = view.links.filter((l) => keep.has(end(l.source)) && keep.has(end(l.target)));
  return { ...view, nodes, links };
}

/** Labels: the focus, its neighbour diseases and the endpoints of route edges (plus whatever is hovered/lit). */
export function labelSet(view: GraphView, focus: string, route: Set<string>): Set<string> {
  const ids = new Set([focus]);
  for (const l of view.links) {
    const a = end(l.source), b = end(l.target);
    if (route.has(l.id)) { ids.add(a); ids.add(b); }
    if (l.relation === "similar_to" && (a === focus || b === focus)) { ids.add(a); ids.add(b); }
    if (l.relation === "has_mechanism") ids.add(b);
  }
  return ids;
}

export { end as linkEnd };
