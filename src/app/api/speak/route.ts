/**
 * POST /api/speak { text, persona, locale } -> audio/mpeg (OpenAI gpt-4o-mini-tts, voz e instrucciones del perfil).
 * Solo lee texto que ya pasó por el verificador (lo manda la UI desde /api/narrate).
 * Sin clave responde 503 y la UI usa la voz del navegador.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { openai, TTS_MODEL } from "@/lib/openai";
import { PERSONAS } from "@/lib/agents/profiles";

export const runtime = "nodejs";

const Body = z.object({
  text: z.string().min(1).max(1500),
  persona: z.enum(["maria", "devon", "priya", "osei"]).default("maria"),
  locale: z.enum(["en", "es"]).default("en"),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const c = openai();
  if (!c) return NextResponse.json({ error: "no OPENAI_API_KEY; use browser speech" }, { status: 503 });
  const p = PERSONAS[parsed.data.persona];
  try {
    const audio = await c.audio.speech.create({
      model: TTS_MODEL, voice: p.voice, input: parsed.data.text,
      instructions: p.voiceInstructions[parsed.data.locale], response_format: "mp3",
    });
    return new NextResponse(audio.body as ReadableStream, { headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=3600" } });
  } catch (e) {
    console.error("[speak]", (e as Error).message);
    return NextResponse.json({ error: "tts failed" }, { status: 502 });
  }
}
