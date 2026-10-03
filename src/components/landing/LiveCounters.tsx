/**
 * Server component: reads the `graph_stats` view with the public (anon) client, 3 s budget.
 * Any failure (no env, network, RLS, timeout, bad shape) → render nothing. Never a fake number.
 */
import { publicClient } from "@/lib/supabase/server";
import { CountersView, type GraphStats } from "./CountersView";

const KEYS = ["entities", "edges", "evidence", "diseases", "trials", "treatments", "sources_used"] as const;

async function getStats(): Promise<GraphStats | null> {
  const sb = publicClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from("graph_stats").select("*").abortSignal(AbortSignal.timeout(3000)).maybeSingle();
    if (error || !data) return null;
    const row = data as Record<string, unknown>;
    const out = {} as GraphStats;
    for (const k of KEYS) {
      const n = Number(row[k]);
      if (!Number.isFinite(n) || n < 0) return null;
      out[k] = n;
    }
    const last = typeof row.last_retrieved_at === "string" ? row.last_retrieved_at : null;
    out.last_retrieved_at = last && !Number.isNaN(Date.parse(last)) ? last : null;
    // An empty graph is not worth a counter strip.
    if (out.entities === 0 || out.evidence === 0) return null;
    return out;
  } catch {
    return null;
  }
}

export async function LiveCounters() {
  const stats = await getStats();
  if (!stats) return null;
  return <CountersView stats={stats} />;
}
