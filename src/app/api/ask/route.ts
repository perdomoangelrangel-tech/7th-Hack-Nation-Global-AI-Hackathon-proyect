/**
 * POST /api/ask  { question, audience: "family"|"clinical"|"research", locale?: "es"|"en", conversation_id? }
 * 1. Recupera evidencia del grafo según la pregunta (herramientas).
 * 2. El LLM redacta SOLO con esa evidencia, en JSON con claims + evidence_ids.
 * 3. El verificador elimina lo que no está respaldado.
 * 4. Se guarda la conversación con sus citas.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PROFILES } from "@/lib/agents/profiles";
import { verify } from "@/lib/verifier";
import { diseaseProfile, trialsFor, treatmentsFor, literatureFor, communitiesFor, gapsFor, type Evidence, type ToolResult } from "@/lib/graph";
import { adminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  question: z.string().min(2).max(2000),
  audience: z.enum(["family", "clinical", "research"]).default("family"),
  locale: z.enum(["es", "en"]).default("es"),
  disease: z.string().optional(),            // ORPHA o nombre; si no viene, se intenta extraer de la pregunta
  conversation_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { question, audience, locale, conversation_id } = parsed.data;
  const profile = PROFILES[audience];

  // 1. Recuperación. Para el hackathon buscamos por el nombre de enfermedad en la pregunta o el que mande el cliente.
  const diseaseKey = parsed.data.disease ?? guessDisease(question);
  const tools: Record<string, unknown> = {};
  const evidence: Evidence[] = [];
  if (diseaseKey) {
    const calls: Record<string, () => Promise<ToolResult<unknown> | null>> = {
      disease: () => diseaseProfile(diseaseKey), treatments: () => treatmentsFor(diseaseKey), trials: () => trialsFor(diseaseKey),
      literature: () => literatureFor(diseaseKey), communities: () => communitiesFor(diseaseKey), gaps: () => gapsFor(diseaseKey),
    };
    for (const t of profile.tools) {
      const fn = calls[t]; if (!fn) continue;
      const r = await fn(); if (!r) continue;
      tools[t] = r.data; evidence.push(...r.evidence);
    }
  }
  const allowed = new Set(evidence.map((e) => e.id));

  // 2. Redacción. Sin clave de modelo se devuelve una respuesta determinista a partir de la evidencia (modo demo).
  const raw = await draft(profile.system(locale), question, tools, evidence, locale);

  // 3. Verificación.
  const out = verify(raw, allowed, locale);

  // 4. Persistencia (si hay service role). No bloquea la respuesta.
  const db = adminClient();
  let convId = conversation_id;
  if (db) {
    if (!convId) {
      const { data } = await db.from("conversations").insert({ audience, agent: profile.id }).select("id").single();
      convId = data?.id;
    }
    if (convId) {
      await db.from("messages").insert({ conversation_id: convId, role: "user", content: question });
      const { data: m } = await db.from("messages").insert({ conversation_id: convId, role: "assistant", content: out.spoken, verified: out.verified, dropped_claims: out.dropped.length }).select("id").single();
      const cited = [...new Set(out.claims.flatMap((c) => c.evidence_ids))];
      if (m && cited.length) await db.from("message_citations").insert(cited.map((evidence_id) => ({ message_id: m.id, evidence_id })));
    }
  }

  const byId = new Map(evidence.map((e) => [e.id, e]));
  return NextResponse.json({
    agent: profile.id, conversation_id: convId ?? null, disease: diseaseKey ?? null,
    spoken: out.spoken, verified: out.verified, dropped: out.dropped,
    claims: out.claims.map((c) => ({ text: c.text, citations: c.evidence_ids.map((id) => byId.get(id)).filter(Boolean) })),
    next_steps: out.next_steps,
    retrieved_at: new Date().toISOString(),
  });
}

/** Detección simple de la enfermedad en la pregunta. Para producción: búsqueda semántica con pgvector. */
function guessDisease(q: string) {
  const known = ["dravet", "rett", "cdkl5", "angelman", "cln2", "batten"];
  const hit = known.find((k) => q.toLowerCase().includes(k));
  return hit;
}

async function draft(system: string, question: string, tools: Record<string, unknown>, evidence: Evidence[], locale: "es" | "en") {
  const apiKey = process.env.OPENAI_API_KEY;
  const context = JSON.stringify({ tools, evidence: evidence.map((e) => ({ id: e.id, source: e.source, external_id: e.external_id, quote: e.quote, published_on: e.published_on, retrieved_at: e.retrieved_at })) }).slice(0, 60_000);

  if (!apiKey) return demoDraft(tools, evidence, locale);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: `EVIDENCIA DISPONIBLE EN ESTE TURNO (solo puedes usar estos evidence_ids):\n${context}\n\nPREGUNTA DEL USUARIO:\n${question}` },
      ],
    }),
  });
  if (!res.ok) return demoDraft(tools, evidence, locale);
  const json = await res.json();
  try { return JSON.parse(json.choices?.[0]?.message?.content ?? "{}"); } catch { return {}; }
}

/** Respuesta sin LLM: una frase por dato con su evidencia. Sirve para probar el flujo completo sin claves. */
interface DemoDisease { disease?: { name: string }; genes?: { symbol: string; evidence_ids: string[] }[] }
interface DemoTreatment { name: string; phase?: number; evidence_ids: string[] }
interface DemoTrial { title: string; nct: string; evidence_ids: string[] }

function demoDraft(tools: Record<string, unknown>, _evidence: Evidence[], locale: "es" | "en") {
  const claims: { text: string; evidence_ids: string[] }[] = [];
  const dp = tools.disease as DemoDisease | undefined;
  const d = dp?.disease;
  if (d) {
    const genes = dp?.genes ?? [];
    for (const g of genes.slice(0, 2)) claims.push({ text: locale === "es" ? `El gen ${g.symbol} está asociado con ${d.name}.` : `The gene ${g.symbol} is associated with ${d.name}.`, evidence_ids: g.evidence_ids });
  }
  for (const t of ((tools.treatments as DemoTreatment[] | undefined) ?? []).slice(0, 2)) claims.push({ text: locale === "es" ? `${t.name} aparece como tratamiento en fase ${t.phase ?? "?"}.` : `${t.name} is listed as a treatment at phase ${t.phase ?? "?"}.`, evidence_ids: t.evidence_ids });
  for (const t of ((tools.trials as DemoTrial[] | undefined) ?? []).slice(0, 2)) claims.push({ text: locale === "es" ? `Hay un ensayo activo: ${t.title} (${t.nct}).` : `There is an active trial: ${t.title} (${t.nct}).`, evidence_ids: t.evidence_ids });
  return { spoken: "", claims, next_steps: claims.length ? [{ kind: "question_for_doctor", label: locale === "es" ? "Preguntas para llevar al médico" : "Questions for your doctor" }] : [] };
}
