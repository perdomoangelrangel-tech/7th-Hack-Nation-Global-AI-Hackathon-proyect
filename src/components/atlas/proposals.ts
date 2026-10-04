/**
 * Proposals layer: community drafts from GET /api/proposals?d= (action lane) rendered as ghost nodes/edges.
 * Drafts are NEVER evidence — kind "proposed", dashed ghost style, labeled "community draft — not evidence".
 * The route may not exist yet (404) or may change shape: parsing is defensive and anything unknown is skipped.
 */
import type { GLink, GNode, GraphView } from "@/lib/atlas/store";

export interface Draft { id: string; kind: string; title: string; body?: string; persona?: string; created_at?: string; entities: string[] }

export function parseDrafts(json: unknown): Draft[] {
  const list = Array.isArray(json) ? json : Array.isArray((json as { proposals?: unknown })?.proposals) ? (json as { proposals: unknown[] }).proposals : [];
  return list.flatMap((x) => {
    const p = x as Record<string, unknown>;
    if (typeof p?.id !== "string" || typeof p.title !== "string") return [];
    const ents = Array.isArray(p.entities) ? p.entities.filter((e): e is string => typeof e === "string") : [];
    return [{ id: p.id, kind: String(p.kind ?? "hypothesis"), title: p.title, body: typeof p.body === "string" ? p.body : undefined, persona: typeof p.persona === "string" ? p.persona : undefined, created_at: typeof p.created_at === "string" ? p.created_at : undefined, entities: ents }];
  });
}

export const draftNodeId = (id: string) => `draft:${id}`;
export const isDraftId = (id: string) => id.startsWith("draft:");

/** Add drafts to a view: one ghost node per draft, ghost links to the entities it mentions that are on screen (else the focus). */
export function withDrafts(view: GraphView, drafts: Draft[]): GraphView {
  if (!drafts.length) return view;
  const onScreen = new Set(view.nodes.map((n) => n.id));
  const nodes: GNode[] = [...view.nodes];
  const links: GLink[] = [...view.links];
  for (const d of drafts.slice(0, 12)) {
    const nid = draftNodeId(d.id);
    nodes.push({ id: nid, type: "study", name: `Draft: ${d.title}`, cluster: null, color: null, size: 3.5, draft: true });
    const targets = d.entities.filter((e) => onScreen.has(e));
    for (const tgt of targets.length ? targets : view.focus ? [view.focus] : []) {
      links.push({ id: `${nid}->${tgt}`, source: nid, target: tgt, relation: "proposes", kind: "proposed", confidence: 0 });
    }
  }
  return { ...view, nodes, links };
}
