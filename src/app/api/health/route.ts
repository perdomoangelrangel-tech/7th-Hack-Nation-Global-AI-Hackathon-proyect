import { NextResponse } from "next/server";
import { publicClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, string> = {
    supabase_env: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "missing",
    openai_env: process.env.OPENAI_API_KEY ? "set" : "missing (demo mode)",
    elevenlabs_env: process.env.ELEVENLABS_API_KEY ? "set" : "missing",
  };
  const db = publicClient();
  if (db) {
    const { count, error } = await db.from("entities").select("*", { count: "exact", head: true });
    checks.graph = error ? `error: ${error.message}` : `${count ?? 0} entities`;
  }
  return NextResponse.json({ ok: true, time: new Date().toISOString(), checks });
}
