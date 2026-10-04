/**
 * GET /api/atlas/sources — every source behind the graph with what it contributes ("Sources & coverage" panel, website).
 *   { origin, generated_at, totals, kinds, sources: [{ id, name, license, url, last_synced_at, edges, evidence, kinds, relations }] }
 * Counts are computed from the graph actually served (live Supabase, or the bundled snapshot + live overlays).
 * OWNER: data lane. A static segment, so it takes precedence over /api/atlas/[view].
 */
import { NextResponse } from "next/server";
import { atlas, atlasSource, loadAtlas } from "@/lib/atlas/store";
import type { EdgeKind, SourceId } from "@/lib/atlas/types";

export const runtime = "nodejs";

// Display fallback for sources that appear in evidence but not in the snapshot's `sources` table.
const FALLBACK: Partial<Record<SourceId, { name: string; license: string; url: string }>> = {
  orphanet: { name: "Orphanet / Orphadata", license: "CC BY 4.0", url: "https://www.orpha.net" },
  hpo: { name: "Human Phenotype Ontology", license: "HPO license", url: "https://hpo.jax.org" },
  monarch: { name: "Monarch Initiative", license: "CC BY 4.0", url: "https://monarchinitiative.org" },
  clinvar: { name: "ClinVar (NCBI)", license: "Public domain", url: "https://www.ncbi.nlm.nih.gov/clinvar" },
  ctgov: { name: "ClinicalTrials.gov", license: "Public domain", url: "https://clinicaltrials.gov" },
  opentargets: { name: "Open Targets Platform", license: "CC0", url: "https://platform.opentargets.org" },
  reactome: { name: "Reactome (via Open Targets)", license: "CC BY 4.0", url: "https://reactome.org" },
  pubmed: { name: "PubMed (NCBI)", license: "Public domain (metadata)", url: "https://pubmed.ncbi.nlm.nih.gov" },
  nih_reporter: { name: "NIH RePORTER", license: "Public domain", url: "https://reporter.nih.gov" },
  patient_orgs: { name: "Patient organizations (curated, official sites)", license: "Public data of each organization", url: "https://github.com/perdomoangelrangel-tech/7th-Hack-Nation-Global-AI-Hackathon-proyect/blob/main/supabase/seed/organizations.json" },
  fda: { name: "U.S. Food and Drug Administration", license: "Public domain", url: "https://www.fda.gov" },
  atlas_analysis: { name: "Nedamex analysis (inferred)", license: "MIT", url: "https://github.com/perdomoangelrangel-tech/7th-Hack-Nation-Global-AI-Hackathon-proyect/blob/main/src/lib/atlas/analyze.ts" },
  nexmed_analysis: { name: "Nedamex analysis (inferred)", license: "MIT", url: "https://github.com/perdomoangelrangel-tech/7th-Hack-Nation-Global-AI-Hackathon-proyect/blob/main/src/lib/atlas/analyze.ts" },
  openai_extraction: { name: "OpenAI extraction from a cited paper (needs expert review)", license: "Derived; cites the PubMed paper", url: "https://pubmed.ncbi.nlm.nih.gov" },
};
// Older snapshots and the live DB may carry Spanish or legacy display names; never show them.
const DISPLAY_FIX: Partial<Record<SourceId, string>> = { patient_orgs: "Patient organizations (curated, official sites)", atlas_analysis: "Nedamex analysis (inferred)", nexmed_analysis: "Nedamex analysis (inferred)" };

export async function GET() {
  await loadAtlas();
  const { snap } = atlas();
  const rows = new Map<string, { edges: Set<string>; evidence: number; kinds: Partial<Record<EdgeKind, number>>; relations: Record<string, number> }>();
  const kinds: Partial<Record<EdgeKind, number>> = {};
  let evidence = 0;
  for (const e of snap.edges) {
    kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
    // AI-extracted claims cite PubMed, but their provenance is the extraction: count them under openai_extraction.
    for (const v of e.evidence) {
      const id = e.kind === "extracted" ? "openai_extraction" : v.source;
      const r = rows.get(id) ?? { edges: new Set<string>(), evidence: 0, kinds: {}, relations: {} };
      if (!r.edges.has(e.id)) { r.edges.add(e.id); r.kinds[e.kind] = (r.kinds[e.kind] ?? 0) + 1; r.relations[e.relation] = (r.relations[e.relation] ?? 0) + 1; }
      r.evidence++; evidence++;
      rows.set(id, r);
    }
  }
  const sources = [...rows].map(([id, r]) => {
    const info = snap.sources[id as SourceId]; const fb = FALLBACK[id as SourceId];
    return {
      id,
      name: DISPLAY_FIX[id as SourceId] ?? info?.name ?? fb?.name ?? id,
      license: info?.license ?? fb?.license ?? null,
      url: info?.url && /^https?:/.test(info.url) ? info.url : fb?.url ?? null,
      last_synced_at: info?.last_synced_at ?? null,
      edges: r.edges.size, evidence: r.evidence, kinds: r.kinds, relations: r.relations,
    };
  }).sort((a, b) => b.evidence - a.evidence || a.id.localeCompare(b.id));
  const count = (t: string) => snap.entities.filter((e) => e.type === t).length;
  return NextResponse.json({
    origin: snap.origin ?? atlasSource(),
    generated_at: snap.generated_at,
    totals: { sources: sources.length, entities: snap.entities.length, diseases: count("disease"), edges: snap.edges.length, evidence },
    kinds,
    sources,
    note: "Observed = a source states it · Inferred = Nedamex analysis (needs expert review) · Extracted = OpenAI from a cited paper (needs expert review) · Proposed = community draft, never evidence.",
  }, { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
