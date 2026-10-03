/**
 * Facts in, verified sentences out. Shared by explain, narrate and ask.
 *
 * 1. The caller turns graph data into numbered FACTS (each with evidence ids and a status).
 * 2. The model (or the deterministic template) drafts sentences that cite fact_ids — never evidence ids directly.
 * 3. `verifyDraft` maps fact_ids → evidence ids, drops sentences with no / unknown fact_ids, runs the
 *    deterministic verifier (citations + dose/cure safety) and hedges inferred / extracted wording.
 */
import { z } from "zod";
import { disclaimer, ensureHedged, verify, NO_EVIDENCE_EN, NO_EVIDENCE_ES, type DropReason } from "../verifier";
import type { FactKind } from "../agents/profiles";

export type FactStatus = "observed" | "inferred" | "extracted" | "gap";
export interface Fact {
  id: string;
  kind: FactKind | "edge";
  status: FactStatus;
  text: string;
  /** Plain-language version (grade ~6) used by the template when `simple`. */
  simple?: string;
  evidence_ids: string[];
  nodes: string[];
  edges: string[];
}

export const DraftSchema = z.object({
  sentences: z.array(z.object({ text: z.string(), fact_ids: z.array(z.string()) })),
});
export type Draft = z.infer<typeof DraftSchema>["sentences"];

export interface VerifiedSentence { text: string; fact_ids: string[]; evidence_ids: string[]; status: FactStatus; nodes: string[]; edges: string[] }
export interface VerifiedDraft { sentences: VerifiedSentence[]; dropped: { text: string; reason: DropReason | "unknown_fact" }[]; spoken: string; verified: boolean }

const LABEL = {
  en: { observed: "OBSERVED", inferred: "INFERRED", extracted: "EXTRACTED", gap: "GAP" },
  es: { observed: "OBSERVADO", inferred: "INFERIDO", extracted: "EXTRAÍDO", gap: "HUECO" },
} as const;

/** The FACTS block given to the model. Only ids, status and text: no URLs, no raw evidence. */
export function factsBlock(facts: Fact[], locale: "en" | "es") {
  return `FACTS:\n${facts.map((f) => `[${f.id}] (${LABEL[locale][f.status]}, ${f.kind}) ${f.text}`).join("\n")}`;
}

/** Weakest status wins: one inferred fact makes the whole sentence a hypothesis. */
function statusOf(fs: Fact[]): FactStatus {
  if (fs.some((f) => f.status === "gap")) return "gap";
  if (fs.some((f) => f.status === "extracted")) return "extracted";
  if (fs.some((f) => f.status === "inferred")) return "inferred";
  return "observed";
}

export function verifyDraft(draft: Draft, facts: Fact[], locale: "en" | "es", opts: { allowNames?: Iterable<string> } = {}): VerifiedDraft {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const dropped: VerifiedDraft["dropped"] = [];
  const candidates: (VerifiedSentence & { key: number })[] = [];
  draft.forEach((s, i) => {
    const ids = [...new Set(s.fact_ids)];
    if (!ids.length || !ids.every((id) => byId.has(id))) {
      dropped.push({ text: s.text, reason: ids.length ? "unknown_fact" : "no_evidence" });
      return;
    }
    const fs = ids.map((id) => byId.get(id)!);
    const status = statusOf(fs);
    candidates.push({
      key: i, text: ensureHedged(s.text.trim(), status, locale), fact_ids: ids, status,
      evidence_ids: [...new Set(fs.flatMap((f) => f.evidence_ids))],
      nodes: [...new Set(fs.flatMap((f) => f.nodes))], edges: [...new Set(fs.flatMap((f) => f.edges))],
    });
  });
  const allowed = facts.flatMap((f) => f.evidence_ids);
  const v = verify({ spoken: "", claims: candidates.map((c) => ({ text: c.text, evidence_ids: c.evidence_ids })), next_steps: [] }, allowed, locale, opts);
  const kept = new Set(v.claims.map((c) => c.text));
  const sentences = candidates.filter((c) => kept.has(c.text)).map(({ key, ...rest }) => { void key; return rest; });
  const all = [...dropped, ...v.dropped];
  // Spoken text = verified sentences only, then the "left out" note, then the disclaimer.
  const parts = sentences.map((s) => s.text);
  if (all.length) parts.push(locale === "es" ? NO_EVIDENCE_ES : NO_EVIDENCE_EN);
  parts.push(disclaimer(locale));
  return { sentences, dropped: all, spoken: parts.join(" "), verified: all.length === 0 };
}

/** Deterministic drafter: one sentence per fact (plain version when `simple`). */
export function templateDraft(facts: Fact[], simple = false): Draft {
  return facts.map((f) => ({ text: simple && f.simple ? f.simple : f.text, fact_ids: [f.id] }));
}
