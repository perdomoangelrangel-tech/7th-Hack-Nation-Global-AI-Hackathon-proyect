/**
 * POST /api/ask  { question, audience: "family"|"clinical"|"research", locale?: "en"|"es", disease?: ORPHA|name, conversation_id? }
 * 1. Retrieval: the disease named in the question (EN/ES, aliases) or the one selected in the UI → its evidence map
 *    (live graph, 4 s budget, snapshot fallback). The audience profile picks which slices ("tools") are in play.
 * 2. Drafting: an LLM writes JSON claims citing evidence_ids (OPENAI_API_KEY), or the deterministic demo drafter does.
 * 3. Verification: the deterministic verifier drops every claim without evidence returned in this turn.
 * 4. Persistence (optional, service role only): conversation + citations, after the response is sent.
 */
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { PROFILES } from "@/lib/agents/profiles";
import { answer } from "@/lib/agents/answer";
import type { VerifiedOutput } from "@/lib/verifier";
import { adminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  question: z.string().trim().min(2).max(2000),
  audience: z.enum(["family", "clinical", "research"]).default("family"),
  locale: z.enum(["es", "en"]).default("en"),
  disease: z.string().max(200).optional(),
  conversation_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid request", issues: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  const { question, audience, locale, disease } = parsed.data;
  const profile = PROFILES[audience];

  const { map, evidence, out, mode } = await answer({ question, audience, locale, disease });

  // Persistence never blocks the answer.
  const db = adminClient();
  const convId = db ? parsed.data.conversation_id ?? randomUUID() : null;
  if (db && convId) after(() => persist(db, convId, !parsed.data.conversation_id, audience, profile.id, question, out).catch(() => {}));

  const byId = new Map(evidence.map((e) => [e.id, e]));
  return NextResponse.json({
    agent: profile.id,
    mode,
    source: map?.source ?? "none",
    conversation_id: convId,
    disease: map ? { orpha: map.disease.orpha, name: map.disease.name, name_es: map.disease.name_es } : null,
    spoken: out.spoken,
    verified: out.verified,
    dropped: out.dropped,
    claims: out.claims.map((c) => ({ text: c.text, citations: c.evidence_ids.map((id) => byId.get(id)).filter(Boolean) })),
    next_steps: out.next_steps,
    retrieved_at: map?.retrieved_at ?? new Date().toISOString(),
  });
}

async function persist(db: NonNullable<ReturnType<typeof adminClient>>, convId: string, isNew: boolean, audience: string, agent: string, question: string, out: VerifiedOutput) {
  if (isNew) await db.from("conversations").insert({ id: convId, audience, agent });
  await db.from("messages").insert({ conversation_id: convId, role: "user", content: question });
  const { data: m } = await db.from("messages").insert({ conversation_id: convId, role: "assistant", content: out.spoken, verified: out.verified, dropped_claims: out.dropped.length }).select("id").single();
  // message_citations references evidence(id): only real graph uuids (researcher rows use "rc:" ids).
  const cited = [...new Set(out.claims.flatMap((c) => c.evidence_ids))].filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (m && cited.length) await db.from("message_citations").insert(cited.map((evidence_id) => ({ message_id: m.id, evidence_id })));
}
