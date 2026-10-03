/**
 * The answer pipeline shared by POST /api/ask (text) and GET /api/tools/ask (voice agents):
 * retrieval (disease from question or UI → evidence map) → drafting (LLM or deterministic) → verification.
 * Server-only: reads the graph through atlas-data.
 */
import { getConnections, getDiseaseMap, listDiseases, type DiseaseMap, type EvidenceRef } from "../atlas-data";
import { verify, type VerifiedOutput } from "../verifier";
import { PROFILES, type Audience } from "./profiles";
import { detectDisease, detectIntents, resolveDisease } from "./detect";
import { demoDraft } from "./demo";
import { onlyAllowed, toolsForTurn } from "./turn";

export interface AnswerInput { question: string; audience: Audience; locale: "en" | "es"; disease?: string }
export interface AnswerResult { map: DiseaseMap | null; evidence: EvidenceRef[]; out: VerifiedOutput; mode: "llm" | "demo" }

export async function answer({ question, audience, locale, disease }: AnswerInput): Promise<AnswerResult> {
  const profile = PROFILES[audience];
  const diseases = await listDiseases();
  const target = detectDisease(question, diseases) ?? resolveDisease(disease, diseases);
  const intents = detectIntents(question);
  const [map, conn] = await Promise.all([
    target ? getDiseaseMap(target.orpha) : Promise.resolve(null),
    target && intents.includes("connections") ? getConnections(target.orpha) : Promise.resolve(null),
  ]);
  const { tools, evidence } = map ? toolsForTurn(map, profile.tools, intents, conn) : { tools: {}, evidence: [] as EvidenceRef[] };
  const allowed = new Set(evidence.map((e) => e.id));
  const llm = process.env.OPENAI_API_KEY && map ? await llmDraft(profile.system(locale), question, tools, evidence) : null;
  const raw = llm ?? onlyAllowed(demoDraft(map, audience, locale, question, conn), allowed);
  return { map, evidence, out: verify(raw, allowed, locale), mode: llm ? "llm" : "demo" };
}

async function llmDraft(system: string, question: string, tools: Record<string, unknown>, evidence: EvidenceRef[]): Promise<unknown | null> {
  const context = JSON.stringify({
    tools,
    evidence: evidence.map((e) => ({ id: e.id, source: e.source, external_id: e.external_id, quote: e.quote ?? null, published_on: e.published_on, retrieved_at: e.retrieved_at })),
  }).slice(0, 60_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(25_000),
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: `EVIDENCE AVAILABLE IN THIS TURN (you may only cite these evidence_ids; at most 6 claims):\n${context}\n\nUSER QUESTION:\n${question}` },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return JSON.parse(json.choices?.[0]?.message?.content ?? "null");
  } catch {
    return null;
  }
}
