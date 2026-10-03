import { NextResponse } from "next/server";
import { stats } from "@/lib/atlas/store";
import { TEXT_MODEL, TTS_MODEL } from "@/lib/openai";

export const runtime = "nodejs";

/** Estado del sistema: tamaño del grafo y qué modo de IA/voz está activo. Nunca expone claves. */
export async function GET() {
  const hasKey = !!process.env.OPENAI_API_KEY;
  let graph: ReturnType<typeof stats> | { error: string };
  try { graph = stats(); } catch (e) { graph = { error: (e as Error).message }; }
  return NextResponse.json({
    ok: !("error" in graph),
    time: new Date().toISOString(),
    graph,
    ai: {
      narration: hasKey ? `openai (${TEXT_MODEL})` : "template (no OPENAI_API_KEY)",
      voice: hasKey ? `openai (${TTS_MODEL})` : "browser speechSynthesis (no OPENAI_API_KEY)",
    },
    supabase: process.env.NEXT_PUBLIC_SUPABASE_URL ? "configured (conversation logging)" : "not configured (optional)",
  });
}
