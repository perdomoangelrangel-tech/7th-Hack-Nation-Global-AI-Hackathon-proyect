/**
 * Explain (one of the three OpenAI jobs): a graph path / set of edges → plain language for one persona.
 * Every sentence carries edge_ids + evidence_ids; the verifier drops uncited sentences; inferred and
 * extracted edges are worded as hypotheses. Without a key (or on any model failure) a deterministic
 * template restates each edge with its source.
 */
import { structured, untrusted } from "./client";
import { DraftSchema, factsBlock, templateDraft, verifyDraft, type FactStatus } from "./draft";
import { edgeFacts, namesOf } from "./edge-facts";
import { systemPrompt } from "../agents/prompts";
import { PERSONAS, type PersonaId } from "../agents/profiles";
import { disclaimer } from "../verifier";
import type { AtlasIndex, Locale } from "./types";
import type { ExplainResponse } from "./contract";

export type { ExplainResponse };

export const MAX_EDGES = 20;

export interface ExplainRequest { edgeIds: string[]; persona: PersonaId; locale: Locale; simple?: boolean; question?: string }

export async function explain(idx: AtlasIndex, req: ExplainRequest): Promise<ExplainResponse> {
  const { facts, unknown, skipped } = edgeFacts(idx, req.edgeIds.slice(0, MAX_EDGES), req.locale);
  const simple = !!req.simple;
  const base = { simple, unknown_edge_ids: unknown, skipped_edge_ids: skipped, disclaimer: disclaimer(req.locale) };
  if (!facts.length) {
    const none = req.locale === "es" ? "No hay conexiones con evidencia para explicar." : "There are no evidence-backed connections to explain.";
    return { ...base, sentences: [], dropped: [], mode: "deterministic", spoken: `${none} ${disclaimer(req.locale)}` };
  }

  const p = PERSONAS[req.persona];
  const task = req.locale === "es"
    ? `TAREA: explica estas conexiones del grafo a ${p.name} en un máximo de ${Math.min(p.maxClaims, facts.length + 1)} frases, en el orden más útil para esa persona. Cada frase cita los fact_ids que usa. Si varios hechos forman un camino, explica el camino. Explica lo que dicen los hechos; no recomiendes acciones.`
    : `TASK: explain these graph connections to ${p.name} in at most ${Math.min(p.maxClaims, facts.length + 1)} sentences, in the order most useful to that person. Each sentence cites the fact_ids it uses. If several facts form a path, explain the path. Explain what the facts say; do not recommend actions.`;
  const llm = await structured({
    name: "nedamex_explain",
    system: systemPrompt({ persona: req.persona, locale: req.locale, task, simple, explainOnly: true }),
    input: [factsBlock(facts, req.locale), req.question ? untrusted("question", req.question, 500) : ""].filter(Boolean).join("\n\n"),
    schema: DraftSchema,
    fast: facts.length <= 3,
  });
  const draft = llm.mode === "openai" ? llm.data.sentences.slice(0, p.maxClaims + 1) : templateDraft(facts, simple);
  const v = verifyDraft(draft, facts, req.locale, { allowNames: namesOf(idx, facts), noAdvice: true });

  // Model output that loses every sentence in verification is worse than the template: fall back.
  if (llm.mode === "openai" && !v.sentences.length) {
    const t = verifyDraft(templateDraft(facts, simple), facts, req.locale, { allowNames: namesOf(idx, facts) });
    return { ...base, sentences: t.sentences.map(toOut), dropped: [...v.dropped, ...t.dropped], mode: "deterministic", spoken: t.spoken };
  }
  return { ...base, sentences: v.sentences.map(toOut), dropped: v.dropped, mode: llm.mode, ...(llm.mode === "openai" ? { model: llm.model } : {}), spoken: v.spoken };
}

const toOut = (s: { text: string; edges: string[]; evidence_ids: string[]; status: FactStatus }) => ({ text: s.text, edge_ids: s.edges, evidence_ids: s.evidence_ids, kind: s.status });
