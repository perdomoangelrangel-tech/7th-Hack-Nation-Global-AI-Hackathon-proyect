/**
 * Edge kind is always visible: observed (solid) · inferred (dashed) · extracted (dotted) · proposed (ghost).
 * Amber is reserved for gaps / no evidence. Mirrors the graph's line styles so a card and its highlighted edge read the same way.
 */
import type { JourneyCopy } from "./copy";

export type Kind = "observed" | "inferred" | "extracted" | "proposed";

const STYLE: Record<Kind, string> = {
  observed: "border-solid border-brand-deep/40 text-brand-deep bg-brand-mist",
  inferred: "border-dashed border-brand-deep/70 text-brand-deep bg-paper",
  extracted: "border-dotted border-brand-deep/70 text-brand-deep bg-paper",
  proposed: "border-dashed border-ink-3/50 text-ink-3 bg-paper",
};

export function KindBadge({ kind, c }: { kind: Kind; c: JourneyCopy }) {
  const label = kind === "inferred" ? c.inferred_review : kind === "extracted" ? c.extracted : kind === "proposed" ? c.proposed : c.observed;
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-tight ${STYLE[kind]}`}>{label}</span>;
}

/** The weakest kind wins: one inferred edge makes the whole claim a hypothesis. */
export function weakestKind(kinds: string[]): Kind {
  if (kinds.includes("proposed")) return "proposed";
  if (kinds.includes("extracted")) return "extracted";
  if (kinds.includes("inferred")) return "inferred";
  return "observed";
}
