/**
 * POST /api/speak { text, persona, locale, voiceId?, rate? } -> audio/mpeg (ElevenLabs, persona voice).
 * Only reads text that already passed the verifier (sent by the UI from /api/narrate or a verified answer).
 * Without ELEVENLABS_API_KEY it answers 503 and the UI falls back to browser speech.
 * OWNER: voice lane. Logic lives in src/lib/voice/speak.ts (unit-tested).
 */
import { NextRequest } from "next/server";
import { handleSpeak } from "@/lib/voice/speak";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return handleSpeak(await req.json().catch(() => ({})));
}
