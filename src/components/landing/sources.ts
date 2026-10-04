/**
 * Server-side: the website's "Data & licenses" table, computed from the graph actually served (same rule as data's
 * GET /api/atlas/sources: AI-extracted claims count under the extraction, not under PubMed). Pure function.
 */
import type { AtlasSnapshot, SourceId } from "@/lib/atlas/types";

export interface SourceRow { id: string; name: string; license: string | null; url: string | null; edges: number; evidence: number }

const DISPLAY: Record<string, { name: string; license?: string }> = {
  atlas_analysis: { name: "Nedamex analysis (inferred)", license: "MIT (our code)" },
  nexmed_analysis: { name: "Nedamex analysis (inferred)", license: "MIT (our code)" },
  openai_extraction: { name: "OpenAI extraction from a cited paper (needs expert review)", license: "Derived; cites the PubMed paper" },
  patient_orgs: { name: "Patient organizations (official sites)", license: "Public information of each organization" },
};

export function sourceRows(snap: AtlasSnapshot): SourceRow[] {
  const rows = new Map<string, { edges: Set<string>; evidence: number }>();
  for (const e of snap.edges) {
    for (const v of e.evidence) {
      const id = e.kind === "extracted" ? "openai_extraction" : v.source;
      const r = rows.get(id) ?? { edges: new Set<string>(), evidence: 0 };
      r.edges.add(e.id);
      r.evidence++;
      rows.set(id, r);
    }
  }
  const merged = new Map<string, SourceRow>();
  for (const [id, r] of rows) {
    const info = snap.sources[id as SourceId];
    const fix = DISPLAY[id];
    const name = fix?.name ?? info?.name ?? id;
    const prev = merged.get(name);
    if (prev) { prev.edges += r.edges.size; prev.evidence += r.evidence; continue; }
    merged.set(name, { id, name, license: fix?.license ?? info?.license ?? null, url: info?.url && /^https?:/.test(info.url) ? info.url : null, edges: r.edges.size, evidence: r.evidence });
  }
  return [...merged.values()].sort((a, b) => b.evidence - a.evidence);
}
