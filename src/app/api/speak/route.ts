/**
 * POST /api/speak { text, persona, locale, voiceId?, rate? } -> audio/mpeg (ElevenLabs, persona voice).
 * Only reads text that already passed the verifier (sent by the UI from /api/narrate or a verified answer).
 * Without ELEVENLABS_API_KEY it answers 503 and the UI falls back to browser speech.
 * Guards (WAVE 7): 20 requests/min per IP → 429 + Retry-After · JSON only (415) · body ≤ 32 kB (413) · control chars stripped.
 * OWNER: voice lane. Logic lives in src/lib/voice/speak.ts (unit-tested).
 */
import { NextRequest } from "next/server";
import { speakRequest } from "@/lib/voice/speak";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return speakRequest(req);
}
