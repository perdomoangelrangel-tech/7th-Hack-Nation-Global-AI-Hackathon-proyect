/**
 * Deterministic, explainable labels for the evidence drawer (UX_WAVE4 §3). No model involved.
 *  - Strength (similarity edges): Strong = shared gene or Reactome pathway AND ≥ 3 informative symptoms ·
 *    Possible = ≥ 5 informative symptoms · Weak = anything else. Shared phenotypes in the analytics are already the
 *    informative (IC-weighted) ones, so each counts.
 *  - Uncertain: what could make this edge wrong, from the edge itself (kind, confidence, sources, variant effect).
 */
import type { SimilarityExplanation } from "@/lib/atlas/types";

export type Strength = "strong" | "possible" | "weak";

export function strengthOf(sim: Pick<SimilarityExplanation, "shared_phenotypes" | "shared_pathways" | "shared_genes">): Strength {
  const s = sim.shared_phenotypes.length, p = sim.shared_pathways.length, g = sim.shared_genes.length;
  if ((p > 0 || g > 0) && s >= 3) return "strong";
  if (s >= 5) return "possible";
  return "weak";
}

export type UncertainReason = "u_inferred" | "u_extracted" | "u_proposed" | "u_low" | "u_variant" | "u_no_pathway" | "u_single";

export function uncertainReasons(edge: { kind: string; confidence: number; evidence: unknown[] }, sim: Pick<SimilarityExplanation, "shared_pathways" | "variant_effect_match"> | null): UncertainReason[] {
  const out: UncertainReason[] = [];
  if (edge.kind === "inferred") out.push("u_inferred");
  if (edge.kind === "extracted") out.push("u_extracted");
  if (edge.kind === "proposed") out.push("u_proposed");
  if (edge.confidence < 0.3) out.push("u_low");
  if (sim?.variant_effect_match === false) out.push("u_variant");
  if (sim && sim.shared_pathways.length === 0) out.push("u_no_pathway");
  if (edge.kind === "observed" && edge.evidence.length === 1) out.push("u_single");
  return out;
}
