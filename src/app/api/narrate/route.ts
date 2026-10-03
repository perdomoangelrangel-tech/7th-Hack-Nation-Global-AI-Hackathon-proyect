/**
 * POST /api/narrate { disease, persona: "maria"|"devon"|"priya"|"osei", locale?: "en"|"es" }
 * Devuelve afirmaciones verificadas, cada una con su evidencia y los nodos/aristas que la UI ilumina
 * mientras la voz la lee. Con OPENAI_API_KEY redacta GPT; sin ella, plantilla determinista.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { narrate } from "@/lib/atlas/narrate";

export const runtime = "nodejs";

const Body = z.object({
  disease: z.string().min(3),
  persona: z.enum(["maria", "devon", "priya", "osei"]).default("maria"),
  locale: z.enum(["en", "es"]).default("en"),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const n = await narrate(parsed.data.disease, parsed.data.persona, parsed.data.locale);
  if (!n) return NextResponse.json({ error: "disease not found" }, { status: 404 });
  return NextResponse.json(n);
}
