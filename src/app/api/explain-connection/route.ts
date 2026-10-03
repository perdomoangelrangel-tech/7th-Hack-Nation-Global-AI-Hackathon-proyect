/**
 * POST /api/explain-connection { orpha, neighbor_orpha, locale?, audience? }
 * "Explain this connection": OpenAI (OPENAI_MODEL, json_object) writes plain-language claims citing ONLY this
 * pair's evidence ids; the deterministic verifier drops anything else. Without a key, a deterministic
 * explanation is built from the same shared items. Response shape matches /api/ask.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getConnections } from "@/lib/atlas-data";
import { buildExplainMessages, explainDraft, pairEvidence } from "@/lib/agents/connections";
import { verify } from "@/lib/verifier";

export const runtime = "nodejs";

const Body = z.object({
  orpha: z.string().min(3).max(40),
  neighbor_orpha: z.string().min(3).max(40),
  locale: z.enum(["en", "es"]).default("en"),
  audience: z.enum(["family", "clinical", "research"]).default("family"),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });
  const { orpha, neighbor_orpha, locale, audience } = parsed.data;
  const conn = await getConnections(orpha);
  const n = conn?.neighbors.find((x) => x.disease.orpha === neighbor_orpha);
  if (!conn || !n) return NextResponse.json({ error: "unknown pair" }, { status: 404 });

  const evidence = pairEvidence(n);
  const allowed = new Set(evidence.map((e) => e.id));
  let mode: "llm" | "demo" = "demo";
  let raw: unknown = null;
  if (process.env.OPENAI_API_KEY && !n.gap) {
    const { system, user } = buildExplainMessages(conn.disease, n, locale, audience);
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? "gpt-4o-mini", temperature: 0.2, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      });
      if (res.ok) {
        const json = await res.json();
        raw = JSON.parse(json.choices?.[0]?.message?.content ?? "null");
        mode = "llm";
      }
    } catch { /* fall back to the deterministic explanation */ }
  }
  if (!raw) raw = explainDraft(conn.disease, n, locale, audience);
  const out = verify(raw, allowed, locale);
  const byId = new Map(evidence.map((e) => [e.id, e]));
  return NextResponse.json({
    mode, source: conn.source, pair: { a: conn.disease.orpha, b: n.disease.orpha, score: n.score },
    spoken: out.spoken, verified: out.verified, dropped: out.dropped,
    claims: out.claims.map((c) => ({ text: c.text, citations: c.evidence_ids.map((id) => byId.get(id)).filter(Boolean) })),
    retrieved_at: conn.retrieved_at,
  });
}
