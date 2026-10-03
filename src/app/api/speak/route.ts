/**
 * Voz de una frase ya verificada (OpenAI gpt-4o-mini-tts, voz e instrucciones del perfil).
 *   GET  /api/speak?t=<texto>&p=maria&l=en   -> audio/mpeg, cacheable en la CDN (cada frase se sintetiza una vez)
 *   POST /api/speak { text, persona, locale }
 * Sin clave responde 503 y la UI usa la voz del navegador.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { openai, TTS_MODEL } from "@/lib/openai";
import { PERSONAS } from "@/lib/agents/profiles";
import { limited } from "@/lib/ratelimit";

export const runtime = "nodejs";

const Params = z.object({
  text: z.string().min(1).max(1200),
  persona: z.enum(["maria", "devon", "priya", "osei"]).default("maria"),
  locale: z.enum(["en", "es"]).default("en"),
});

async function handle(req: NextRequest, raw: unknown) {
  const parsed = Params.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const c = openai();
  if (!c) return NextResponse.json({ error: "no OPENAI_API_KEY; use browser speech" }, { status: 503 });
  if (limited(req, "speak", 60)) return NextResponse.json({ error: "too many requests" }, { status: 429 });
  const p = PERSONAS[parsed.data.persona];
  try {
    const audio = await c.audio.speech.create({
      model: TTS_MODEL, voice: p.voice, input: parsed.data.text,
      instructions: p.voiceInstructions[parsed.data.locale], response_format: "mp3",
    });
    return new NextResponse(audio.body as ReadableStream, {
      headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=86400, s-maxage=31536000, immutable" },
    });
  } catch (e) {
    console.error("[speak]", (e as Error).message);
    return NextResponse.json({ error: "tts failed" }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  return handle(req, { text: sp.get("t") ?? "", persona: sp.get("p") ?? undefined, locale: sp.get("l") ?? undefined });
}

export async function POST(req: NextRequest) {
  return handle(req, await req.json().catch(() => ({})));
}
