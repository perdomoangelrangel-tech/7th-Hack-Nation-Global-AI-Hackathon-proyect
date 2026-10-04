/**
 * GET /api/voice/agents -> { agents: { devon, maria, osei, priya }, names, ttsAvailable }
 * Public ElevenLabs agent ids per mode (null = not configured). OWNER: voice lane.
 */
import { NextResponse } from "next/server";
import { AGENT_NAMES, agentIds } from "@/lib/voice/agents";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(
    { agents: agentIds(), names: AGENT_NAMES, ttsAvailable: Boolean(process.env.ELEVENLABS_API_KEY?.trim()) },
    { headers: { "cache-control": "public, s-maxage=300" } },
  );
}
