/**
 * Edge kind is always visible: observed (solid) · inferred (dashed) · extracted (dotted) · proposed (ghost).
 * Amber is reserved for gaps / no evidence. Icons per UX_WAVE4 §1.4.
 */
import { BadgeCheck, Footprints, PencilLine, Sigma, Sparkles } from "lucide-react";
import type { JourneyCopy } from "./copy";

export type Kind = "observed" | "inferred" | "extracted" | "proposed";

const STYLE: Record<Kind, string> = {
  observed: "border-solid border-brand-deep/40 text-brand-deep bg-brand-mist",
  inferred: "border-dashed border-brand-deep/70 text-brand-deep bg-paper",
  extracted: "border-dotted border-brand-deep/70 text-brand-deep bg-paper",
  proposed: "border-dashed border-ink-3/50 text-ink-3 bg-paper",
};
const ICON = { observed: BadgeCheck, inferred: Sigma, extracted: Sparkles, proposed: PencilLine };

export function KindBadge({ kind, c }: { kind: Kind; c: JourneyCopy }) {
  const label = kind === "inferred" ? c.inferred_review : kind === "extracted" ? c.extracted : kind === "proposed" ? c.proposed : c.observed;
  const Icon = ICON[kind];
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-tight ${STYLE[kind]}`}><Icon size={12} aria-hidden />{label}</span>;
}

/** Step 4 is a recommendation built from sourced records, never an observation. */
export function RecommendationBadge({ records, c }: { records: number; c: JourneyCopy }) {
  return <span className="inline-flex items-center gap-1 rounded-full border border-brand/50 bg-brand-soft px-2 py-0.5 text-[11px] leading-tight text-brand-deep"><Footprints size={12} aria-hidden />{c.recommendation(records)}</span>;
}

/** Strong / Possible / Weak lead (UX_WAVE4 §3); the rule is in the tooltip, the raw score only in the drawer. */
export function StrengthBadge({ level, label, basis }: { level: "strong" | "possible" | "weak"; label: string; basis: string }) {
  const tone = level === "strong" ? "bg-brand-deep text-white border-brand-deep" : level === "possible" ? "bg-brand-soft text-brand-deep border-brand/50" : "bg-paper text-ink-3 border-line";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight ${tone}`} title={basis}>{label}</span>;
}

/** The weakest kind wins: one inferred edge makes the whole claim a hypothesis. */
export function weakestKind(kinds: string[]): Kind {
  if (kinds.includes("proposed")) return "proposed";
  if (kinds.includes("extracted")) return "extracted";
  if (kinds.includes("inferred")) return "inferred";
  return "observed";
}
