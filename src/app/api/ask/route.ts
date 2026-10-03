/**
 * POST /api/ask { question, persona?: "maria"|"devon"|"priya"|"osei", locale?, disease? }
 * Pregunta libre: resuelve la enfermedad (nombre, sinónimo, gen o síntoma) y devuelve la narración
 * verificada de /api/narrate para esa persona. Guarda la conversación si Supabase está configurado.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { narrate } from "@/lib/atlas/narrate";
import { search } from "@/lib/atlas/store";
import { adminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  question: z.string().min(2).max(2000),
  persona: z.enum(["maria", "devon", "priya", "osei"]).default("maria"),
  locale: z.enum(["es", "en"]).default("en"),
  disease: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { question, persona, locale } = parsed.data;

  const disease = parsed.data.disease ?? resolve(question, locale);
  if (!disease) {
    return NextResponse.json({
      disease: null, claims: [], verified: true,
      spoken: locale === "es" ? "No encontré esa enfermedad, gen o síntoma en el atlas. Hoy cubre 9 enfermedades monogénicas del neurodesarrollo; prueba con su nombre, un gen o un síntoma." : "I could not find that disease, gene or symptom in the atlas. It currently covers 9 monogenic neurodevelopmental diseases; try a name, a gene or a symptom.",
    });
  }
  const n = await narrate(disease, persona, locale);
  if (!n) return NextResponse.json({ error: "disease not found" }, { status: 404 });

  // Persistencia opcional (no bloquea si falla).
  const db = adminClient();
  if (db) {
    try {
      const { data: conv } = await db.from("conversations").insert({ audience: persona === "devon" ? "family" : persona === "osei" ? "clinical" : "research", agent: persona }).select("id").single();
      if (conv) await db.from("messages").insert([{ conversation_id: conv.id, role: "user", content: question }, { conversation_id: conv.id, role: "assistant", content: n.spoken, verified: n.verified, dropped_claims: n.dropped.length }]);
    } catch { /* la respuesta no depende de la persistencia */ }
  }
  return NextResponse.json(n);
}

/** Prueba frases cada vez más cortas de la pregunta hasta encontrar una entidad del atlas. */
function resolve(question: string, locale: "en" | "es") {
  const STOP = new Set(["what", "which", "who", "are", "for", "the", "and", "with", "there", "have", "does", "about", "que", "qué", "para", "hay", "los", "las", "con", "del", "una", "uno", "como", "cómo", "quién", "cuál", "tiene", "sobre", "síndrome", "syndrome", "disease", "enfermedad"]);
  const words = question.replace(/[¿?¡!.,;:"]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()));
  for (let size = Math.min(5, words.length); size >= 1; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      const hit = search(words.slice(i, i + size).join(" "), locale, 1)[0];
      if (hit?.disease) return hit.disease;
    }
  }
  return null;
}
