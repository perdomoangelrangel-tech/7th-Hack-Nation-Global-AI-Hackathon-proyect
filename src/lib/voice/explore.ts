/**
 * "Explore in the graph" from the Guide (chat answers, transcript cards). OWNER: voice lane.
 * Uses the explorer's CONTRACT (07:01): window event `nedamex:focus-evidence` with { edgeIds, entityIds, openDrawer }
 * → the atlas lights those edges + endpoints, dims the rest, frames them and opens the drawer on the first edge.
 * Dispatching the event directly keeps the voice lane free of an import from explorer's file.
 */
export const FOCUS_EVIDENCE_EVENT = "nedamex:focus-evidence";
export interface FocusEvidence { edgeIds: string[]; entityIds: string[]; openDrawer: boolean }

/** Deduplicated, bounded focus request from claims' edges/nodes (pure; unit-tested). */
export function focusFrom(items: { edges?: string[]; nodes?: string[] }[], max = 40): FocusEvidence | null {
  const edgeIds = [...new Set(items.flatMap((i) => i.edges ?? []))].filter((x) => x.startsWith("edge:")).slice(0, max);
  const entityIds = [...new Set(items.flatMap((i) => i.nodes ?? []))].filter((x) => x && !x.startsWith("edge:")).slice(0, max);
  if (!edgeIds.length && !entityIds.length) return null;
  return { edgeIds, entityIds, openDrawer: edgeIds.length > 0 };
}

export function exploreInGraph(items: { edges?: string[]; nodes?: string[] }[]): boolean {
  const detail = focusFrom(items);
  if (!detail || typeof window === "undefined") return false;
  window.dispatchEvent(new CustomEvent<FocusEvidence>(FOCUS_EVIDENCE_EVENT, { detail }));
  return true;
}

/** Human source names for chips/links (QA-47: never show raw ids like "nexmed_analysis"). */
const SOURCE_LABEL: Record<string, string> = {
  nexmed_analysis: "Nedamex analysis", nedamex_analysis: "Nedamex analysis", atlas_analysis: "Nedamex analysis",
  orphanet: "Orphanet", hpo: "HPO", clinvar: "ClinVar", pubmed: "PubMed", ctgov: "ClinicalTrials.gov", clinicaltrials: "ClinicalTrials.gov",
  opentargets: "Open Targets", reactome: "Reactome", monarch: "Monarch", nih_reporter: "NIH RePORTER", reporter: "NIH RePORTER",
  patient_orgs: "Patient organization", fda: "FDA", openfda: "openFDA", dailymed: "DailyMed", ema: "EMA", chembl: "ChEMBL", community: "Community draft",
};
export const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? s;

/** External id as shown to people (internal analysis ids are replaced by a plain description). */
export function displayId(source: string, id: string): string {
  if (/similarity_v\d/.test(id)) return "shared-mechanism analysis";
  return id.length > 26 ? `${id.slice(0, 25)}…` : id;
}
