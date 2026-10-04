/**
 * "Explore in the graph": any component (Guide chat, transcript cards, the Lovable medicine chat via `?hl=`) can ask the
 * atlas to highlight evidence. The atlas lights the edges and their endpoints, dims the rest, frames them and opens the
 * evidence drawer on the first edge. Same-page callers use the window event; deep links use `/atlas?d=…&hl=edge:a,edge:b`.
 */
export const FOCUS_EVIDENCE_EVENT = "nedamex:focus-evidence";
export interface FocusEvidence { edgeIds?: string[]; entityIds?: string[]; openDrawer?: boolean }

export function focusOnEvidence(detail: FocusEvidence) {
  window.dispatchEvent(new CustomEvent<FocusEvidence>(FOCUS_EVIDENCE_EVENT, { detail }));
}

/** `hl=edge:a,edge:b,disease:ORPHA:1` → edges (ids starting with "edge:") and entities (everything else). */
export function parseHl(raw: string | null): FocusEvidence | null {
  if (!raw) return null;
  const ids = raw.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 40);
  if (!ids.length) return null;
  return { edgeIds: ids.filter((x) => x.startsWith("edge:")), entityIds: ids.filter((x) => !x.startsWith("edge:")), openDrawer: true };
}
