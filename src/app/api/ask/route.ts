/**
 * POST /api/ask { question, persona, locale, focus?, simple? }
 * → { claims:[{ text, evidence_ids[], evidence[], status, nodes[], edges[] }], dropped, mode, disease, resolved_via, notice, spoken, disclaimer, … }
 * Strict disease resolution (focus entity id → exact/alias/normalized mention; never stray words), then the
 * verified, persona-ordered narration focused on what was asked. Unknown → honest "not in the atlas", 0 claims.
 * Legacy fields accepted: `disease` (= focus), `audience` (family→devon, clinical→osei, research→priya).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { narrate } from "@/lib/atlas/narrate";
import { atlas, loadAtlas } from "@/lib/atlas/store";
import { adminClient } from "@/lib/supabase/server";
import { notFound, resolveQuestion, safetyFlags, safetyNotice, type AskAnswer } from "@/lib/ai/ask";
import type { PersonaId } from "@/lib/agents/profiles";

export const runtime = "nodejs";

const LEGACY_AUDIENCE: Record<string, PersonaId> = { family: "devon", clinical: "osei", research: "priya" };

const Body = z.object({
  question: z.string().trim().min(2).max(2000),
  persona: z.enum(["maria", "devon", "priya", "osei"]).optional(),
  audience: z.string().optional(),
  locale: z.enum(["es", "en"]).default("en"),
  focus: z.string().max(200).optional(),
  disease: z.string().max(200).optional(),
  simple: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  await loadAtlas();
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
  const { question, locale } = parsed.data;
  const persona: PersonaId = parsed.data.persona ?? LEGACY_AUDIENCE[parsed.data.audience ?? ""] ?? "maria";
  const simple = !!parsed.data.simple;
  const idx = atlas();

  const resolved = resolveQuestion(idx, question, parsed.data.focus ?? parsed.data.disease);
  if (!resolved) return NextResponse.json(notFound(idx, question, persona, locale, simple));

  const n = await narrate(resolved.disease, persona, locale, { simple, question });
  if (!n) return NextResponse.json(notFound(idx, question, persona, locale, simple));

  const flags = safetyFlags(question);
  const notice = safetyNotice(flags, locale);
  const answer: AskAnswer = {
    question, persona, disease: resolved.disease, disease_name: idx.byId.get(resolved.disease)?.name ?? null, resolved_via: resolved.via,
    claims: n.claims.map((c) => ({ text: c.text, evidence_ids: c.evidence_ids, evidence: c.evidence, status: c.status, nodes: c.nodes, edges: c.edges })),
    dropped: n.dropped, mode: n.mode, model: n.model, simple, notice, safety_flags: flags,
    spoken: [notice, n.spoken].filter(Boolean).join(" "), verified: n.verified, disclaimer: n.disclaimer,
  };

  // Optional persistence (never blocks the answer). Only the question and the verified spoken text are stored.
  const db = adminClient();
  if (db) {
    try {
      const { data: conv } = await db.from("conversations").insert({ audience: persona === "devon" ? "family" : persona === "osei" ? "clinical" : "research", agent: persona }).select("id").single();
      if (conv) await db.from("messages").insert([{ conversation_id: conv.id, role: "user", content: question }, { conversation_id: conv.id, role: "assistant", content: answer.spoken, verified: answer.verified, dropped_claims: answer.dropped.length }]);
    } catch { /* the answer does not depend on persistence */ }
  }
  return NextResponse.json(answer);
}
