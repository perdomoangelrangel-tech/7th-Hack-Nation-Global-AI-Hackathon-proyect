/**
 * Deterministic verifier. No LLM.
 * Input: the agent's JSON answer + the evidence_ids the tools returned in THIS turn.
 * Output: the same answer with unsupported claims removed and a spoken text rebuilt only from verified claims.
 * Safety: claims that state a dose or promise a cure are dropped even when cited (non-negotiable #4).
 */
import { z } from "zod";

export const AgentOutput = z.object({
  spoken: z.string(),
  claims: z.array(z.object({ text: z.string().min(1), evidence_ids: z.array(z.string()) })),
  next_steps: z.array(z.object({
    kind: z.enum(["trial", "treatment", "community", "summary", "question_for_doctor", "research_gap"]),
    label: z.string(), ref: z.string().optional(),
  })).default([]),
});
export type AgentOutput = z.infer<typeof AgentOutput>;

export type DropReason = "no_evidence" | "unknown_evidence" | "unsafe_dose" | "unsafe_cure";

export interface VerifiedOutput extends AgentOutput {
  verified: boolean;
  dropped: { text: string; reason: DropReason }[];
  claims: (AgentOutput["claims"][number] & { verified: true })[];
}

export const NO_EVIDENCE_ES = "No hay evidencia en nuestras fuentes para una parte de lo que preguntaste, así que no la incluyo.";
export const NO_EVIDENCE_EN = "There is no evidence in our sources for part of what you asked, so I am leaving it out.";
export const DISCLAIMER_ES = "Esto es información con fuentes, no un diagnóstico ni consejo médico. Llévalo a tu médico o a un centro experto.";
export const DISCLAIMER_EN = "This is sourced information, not a diagnosis or medical advice. Take it to your doctor or a center of expertise.";
export const disclaimer = (l: "en" | "es") => (l === "es" ? DISCLAIMER_ES : DISCLAIMER_EN);

const DOSE_RE = /\b\d+(?:[.,]\d+)?\s?(?:mg\/kg|mg|mcg|µg|ml|mL|IU|UI|units?|unidades)\b/i;
const CURE_RE = /\b(?:cure[sd]?|curable|curing|cura[rn]?|curación|guarantee[sd]?|garantiza\w*|miracle|milagro\w*)\b/i;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Why a sentence is unsafe to show, or null. `allowNames` are graph entity names (e.g. "KCNQ2 Cure Alliance")
 * that may legitimately contain a flagged word; they are blanked out before the check.
 */
export function unsafeReason(text: string, allowNames: Iterable<string> = []): "unsafe_dose" | "unsafe_cure" | null {
  let t = text;
  for (const n of allowNames) if (n && CURE_RE.test(n)) t = t.replace(new RegExp(escapeRe(n), "gi"), " ");
  if (DOSE_RE.test(t)) return "unsafe_dose";
  if (CURE_RE.test(t)) return "unsafe_cure";
  return null;
}

export function verify(raw: unknown, allowedEvidenceIds: Iterable<string>, locale: "es" | "en" = "es", opts: { allowNames?: Iterable<string> } = {}): VerifiedOutput {
  const parsed = AgentOutput.safeParse(raw);
  if (!parsed.success) {
    return { spoken: `${locale === "es" ? NO_EVIDENCE_ES : NO_EVIDENCE_EN} ${disclaimer(locale)}`, claims: [], next_steps: [], verified: false, dropped: [{ text: "(invalid format)", reason: "no_evidence" }] };
  }
  const allowed = new Set(allowedEvidenceIds);
  const names = [...(opts.allowNames ?? [])];
  const kept: VerifiedOutput["claims"] = [];
  const dropped: VerifiedOutput["dropped"] = [];
  for (const c of parsed.data.claims) {
    if (!c.evidence_ids.length) { dropped.push({ text: c.text, reason: "no_evidence" }); continue; }
    if (!c.evidence_ids.every((id) => allowed.has(id))) { dropped.push({ text: c.text, reason: "unknown_evidence" }); continue; }
    const unsafe = unsafeReason(c.text, names);
    if (unsafe) { dropped.push({ text: c.text, reason: unsafe }); continue; }
    kept.push({ ...c, verified: true });
  }
  // The spoken text is rebuilt ONLY from verified claims, so an unsourced sentence never slips through.
  const parts = kept.map((c) => c.text.trim());
  if (dropped.length) parts.push(locale === "es" ? NO_EVIDENCE_ES : NO_EVIDENCE_EN);
  parts.push(disclaimer(locale));
  return { spoken: parts.join(" "), claims: kept, next_steps: parsed.data.next_steps, verified: dropped.length === 0, dropped };
}

const HEDGE_EN = /\b(suggests?|may|might|could|possibl[ey]|hypothes[ie]s|needs? (?:an )?expert review|to be confirmed|inferred|not proven|unconfirmed)\b/i;
const HEDGE_ES = /(sugiere|podría|puede|posible|hipótesis|revisión (?:de un )?experto|por confirmar|inferid[oa]|no (?:está )?probad[oa])/i;

/**
 * Inferred / AI-extracted facts must read as hypotheses. If the drafted sentence does not hedge,
 * append a fixed marker instead of trusting the model's wording.
 */
export function ensureHedged(text: string, kind: "observed" | "inferred" | "extracted" | "gap", locale: "en" | "es"): string {
  if (kind !== "inferred" && kind !== "extracted") return text;
  if ((locale === "es" ? HEDGE_ES : HEDGE_EN).test(text)) return text;
  const tag = kind === "extracted"
    ? (locale === "es" ? " (extraído por IA de un artículo: necesita revisión de un experto)" : " (AI-extracted from a paper: needs expert review)")
    : (locale === "es" ? " (el atlas lo sugiere: necesita revisión de un experto)" : " (the atlas suggests this: needs expert review)");
  return text.replace(/[.\s]*$/, "") + tag + ".";
}
