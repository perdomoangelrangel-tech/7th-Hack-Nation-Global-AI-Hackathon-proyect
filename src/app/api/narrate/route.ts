/**
 * Narración verificada de un recorrido.
 *   GET  /api/narrate?d=disease:ORPHA:599373&p=maria&l=en   (cacheable en la CDN: cada combinación se genera una vez)
 *   POST /api/narrate { disease, persona, locale }
 * Devuelve afirmaciones verificadas, cada una con su evidencia y los nodos/aristas que la UI ilumina
 * mientras la voz la lee. Con OPENAI_API_KEY redacta GPT; sin ella, plantilla determinista.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { narrate } from "@/lib/atlas/narrate";
import { limited } from "@/lib/ratelimit";

export const runtime = "nodejs";

const Params = z.object({
  disease: z.string().min(3).max(80),
  persona: z.enum(["maria", "devon", "priya", "osei"]).default("maria"),
  locale: z.enum(["en", "es"]).default("en"),
});

async function handle(req: NextRequest, raw: unknown) {
  const parsed = Params.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (limited(req, "narrate", 30)) return NextResponse.json({ error: "too many requests" }, { status: 429 });
  const n = await narrate(parsed.data.disease, parsed.data.persona, parsed.data.locale);
  if (!n) return NextResponse.json({ error: "disease not found" }, { status: 404 });
  // El grafo solo cambia con un nuevo despliegue: la narración se puede cachear un día en la CDN.
  return NextResponse.json(n, { headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  return handle(req, { disease: sp.get("d") ?? "", persona: sp.get("p") ?? undefined, locale: sp.get("l") ?? undefined });
}

export async function POST(req: NextRequest) {
  return handle(req, await req.json().catch(() => ({})));
}
