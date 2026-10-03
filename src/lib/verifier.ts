/**
 * Verificador determinista. No usa LLM.
 * Entrada: la respuesta del agente en JSON + los evidence_ids que devolvieron las herramientas en ESTE turno.
 * Salida: la misma respuesta con los claims sin respaldo eliminados y un texto hablado reconstruido.
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

export interface VerifiedOutput extends AgentOutput {
  verified: boolean;
  dropped: { text: string; reason: "no_evidence" | "unknown_evidence" }[];
  claims: (AgentOutput["claims"][number] & { verified: true })[];
}

export const NO_EVIDENCE_ES = "No hay evidencia en nuestras fuentes para una parte de lo que preguntaste, así que no la incluyo.";
export const NO_EVIDENCE_EN = "There is no evidence in our sources for part of what you asked, so I am leaving it out.";
export const DISCLAIMER_ES = "Esto es información con fuentes, no un diagnóstico. Llévalo a tu médico o a un centro experto.";
export const DISCLAIMER_EN = "This is sourced information, not a diagnosis. Take it to your doctor or a center of expertise.";

export function verify(raw: unknown, allowedEvidenceIds: Iterable<string>, locale: "es" | "en" = "es"): VerifiedOutput {
  const parsed = AgentOutput.safeParse(raw);
  if (!parsed.success) {
    return { spoken: locale === "es" ? NO_EVIDENCE_ES : NO_EVIDENCE_EN, claims: [], next_steps: [], verified: false, dropped: [{ text: "(formato inválido)", reason: "no_evidence" }] };
  }
  const allowed = new Set(allowedEvidenceIds);
  const kept: VerifiedOutput["claims"] = [];
  const dropped: VerifiedOutput["dropped"] = [];
  for (const c of parsed.data.claims) {
    if (!c.evidence_ids.length) { dropped.push({ text: c.text, reason: "no_evidence" }); continue; }
    if (!c.evidence_ids.every((id) => allowed.has(id))) { dropped.push({ text: c.text, reason: "unknown_evidence" }); continue; }
    kept.push({ ...c, verified: true });
  }
  // El texto hablado se reconstruye SOLO con claims verificados, así nunca se cuela una frase sin fuente.
  const parts = kept.map((c) => c.text.trim());
  if (dropped.length) parts.push(locale === "es" ? NO_EVIDENCE_ES : NO_EVIDENCE_EN);
  parts.push(locale === "es" ? DISCLAIMER_ES : DISCLAIMER_EN);
  return { spoken: parts.join(" "), claims: kept, next_steps: parsed.data.next_steps, verified: dropped.length === 0, dropped };
}
