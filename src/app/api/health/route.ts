import { NextResponse } from "next/server";
import { publicClient } from "@/lib/supabase/server";
import { snapshotInfo } from "@/lib/atlas-data";

export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, unknown> = {
    supabase_env: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "missing",
    openai_env: process.env.OPENAI_API_KEY ? "set" : "missing (demo mode)",
    elevenlabs_agents: {
      family: Boolean(process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_FAMILY),
      clinical: Boolean(process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_CLINICAL),
      research: Boolean(process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_RESEARCH),
    },
    tools_key: process.env.ATLAS_TOOLS_KEY ? "set" : "missing (tools are open)",
    snapshot: snapshotInfo(),
  };
  const db = publicClient();
  if (db) {
    try {
      const { count, error } = await db.from("entities").select("*", { count: "exact", head: true }).abortSignal(AbortSignal.timeout(4000));
      checks.graph = error ? `error: ${error.message}` : `${count ?? 0} entities`;
    } catch (e) {
      checks.graph = `unreachable (${(e as Error).name}); serving snapshot`;
    }
  }
  return NextResponse.json({ ok: true, time: new Date().toISOString(), checks });
}
