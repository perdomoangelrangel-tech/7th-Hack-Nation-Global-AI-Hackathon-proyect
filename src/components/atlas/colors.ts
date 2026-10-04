/**
 * Data-viz palette for the graph (the ONLY place raw hex is allowed, per CLAUDE.md §7).
 * Light canvas: marks read on white / brand-mist at ≥ 3:1, label ink at ≥ 4.5:1.
 * Shared by the 2D/3D canvases (client only) and server-rendered legend chips.
 */
export const TYPE_COLOR: Record<string, string> = {
  disease: "#1f5f94",       // search / legend only (canvases color diseases by cluster)
  gene: "#3a86bf",          // logo blue
  pathway: "#6d5bd0",       // mechanism
  phenotype: "#7f97ab",     // symptom (quiet: there are many)
  organization: "#14907d",  // patient group / community
  trial: "#c0508a",         // study / reusable asset
  investigator: "#d0603f",  // researcher
  treatment: "#3f9a5a",
  study: "#8ea3b6",
  variant: "#8ea3b6",
};

/** Edge kinds (CLAUDE.md §3): the line style carries the epistemic status, never only the color. */
export type LinkKind = "observed" | "inferred" | "extracted" | "proposed";
export const KIND_STYLE: Record<LinkKind, { color: string; dash: number[] | null; opacity: number }> = {
  observed: { color: "#3a86bf", dash: null, opacity: 0.55 },      // solid · a source states it
  inferred: { color: "#1f5f94", dash: [6, 4], opacity: 0.8 },     // dashed · Nedamex analysis
  extracted: { color: "#6d5bd0", dash: [1.5, 3], opacity: 0.85 }, // dotted · AI-extracted, needs review
  proposed: { color: "#8ea3b6", dash: [3, 5], opacity: 0.35 },    // ghost · community draft, never evidence
};
export const KINDS = Object.keys(KIND_STYLE) as LinkKind[];
export const kindOf = (k: string | undefined): LinkKind => (k === "inferred" || k === "extracted" || k === "proposed" ? k : "observed");

export const CANVAS = {
  background: "#f3f8fc",    // --brand-mist
  ink: "#0e2c47",           // --brand-ink (labels, focus ring)
  labelBg: "rgba(255,255,255,0.9)",
  bridge: "#d0603f",        // cross-cluster bridges
  dimAlpha: 0.14,
  fallbackDisease: "#3a86bf",
};

export function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
