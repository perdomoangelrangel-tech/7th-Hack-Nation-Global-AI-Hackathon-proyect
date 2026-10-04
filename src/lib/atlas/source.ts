/**
 * Live graph source. OWNER: data lane.
 * Returns the full graph in AtlasSnapshot format (entities, edges with >= 1 evidence each, analytics) read from
 * Supabase project zuqwmvshkhniqebtxlks, or null when Supabase is unreachable / disabled (NEDAMEX_DATA_SOURCE=file)
 * or when the live graph covers fewer diseases than the bundled data/atlas.json (so a partial ingest never
 * hides a disease the demo relies on). NEDAMEX_DATA_SOURCE=supabase skips that coverage guard.
 * Analytics (clusters, similarity, bridges, gaps, counterexamples) are computed in-process with ./analyze.ts.
 * Saved extractions arrive as kind "extracted" edges; proposals as `snapshot.proposals` (overlay, never evidence).
 * Caching lives in ./store.ts (5-minute TTL).
 */
import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { publicClient } from "../supabase/server";
import { fetchSnapshot } from "../supabase/snapshot";
import { withAnalytics } from "./analyze";
import type { AtlasSnapshot } from "./types";

let bundledDiseases: string[] | null = null;
function diseasesInBundledSnapshot(): string[] {
  if (bundledDiseases) return bundledDiseases;
  try {
    const snap = JSON.parse(readFileSync(join(process.cwd(), "data", "atlas.json"), "utf8")) as AtlasSnapshot;
    bundledDiseases = snap.entities.filter((e) => e.type === "disease").map((e) => e.id);
  } catch { bundledDiseases = []; }
  return bundledDiseases;
}

export async function loadFromSupabase(): Promise<AtlasSnapshot | null> {
  const mode = process.env.NEDAMEX_DATA_SOURCE ?? process.env.NEXMED_DATA_SOURCE; // old name still accepted
  if (mode === "file") return null;
  const t0 = Date.now();
  const { snapshot, stats } = await fetchSnapshot(publicClient());
  if (!snapshot.entities.length) return null;
  if (mode !== "supabase") {
    const live = new Set(snapshot.entities.filter((e) => e.type === "disease").map((e) => e.id));
    const missing = diseasesInBundledSnapshot().filter((d) => !live.has(d));
    if (missing.length) {
      console.warn(`[atlas] live graph misses ${missing.length} bundled disease(s) (${missing.slice(0, 4).join(", ")}…): using data/atlas.json`);
      return null;
    }
  }
  const snap = withAnalytics(snapshot);
  if (process.env.NODE_ENV !== "production" || process.env.NEDAMEX_DEBUG) {
    console.info(`[atlas] supabase: ${snap.entities.length} entities, ${snap.edges.length} edges, ${snap.analytics?.clusters.length ?? 0} clusters · fetch ${stats.ms} ms (${stats.requests} requests) · total ${Date.now() - t0} ms`);
  }
  return snap;
}
