/**
 * Live graph source. OWNER: data lane.
 * Returns the full graph in AtlasSnapshot format (entities, edges with >= 1 evidence each, analytics) read from
 * Supabase project zuqwmvshkhniqebtxlks, or null when Supabase is unreachable / disabled (NEDAMEX_DATA_SOURCE=file)
 * or when the live graph is poorer than the bundled data/atlas.json — it misses a bundled disease or has fewer than
 * MIN_EDGE_RATIO of its observed edges — so a partial ingest never hides data the demo relies on. In that case it
 * returns the bundled file PLUS the live overlays (saved OpenAI extractions as kind "extracted" edges, community
 * proposals), so AI-extracted claims are visible whichever graph is served. NEDAMEX_DATA_SOURCE=supabase skips the guard.
 * Analytics (clusters, similarity, bridges, gaps, counterexamples) are computed in-process with ./analyze.ts.
 * Saved extractions arrive as kind "extracted" edges; proposals as `snapshot.proposals` (overlay, never evidence).
 * Caching lives in ./store.ts (5-minute TTL).
 */
import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { publicClient } from "../supabase/server";
import { applyOverlays, fetchOverlays, fetchSnapshot } from "../supabase/snapshot";
import { withAnalytics } from "./analyze";
import type { AtlasSnapshot } from "./types";

const MIN_EDGE_RATIO = 0.8;
let bundled: { snap: AtlasSnapshot | null; diseases: string[]; observedEdges: number } | null = null;
function bundledSnapshot() {
  if (bundled) return bundled;
  try {
    const snap = JSON.parse(readFileSync(join(process.cwd(), "data", "atlas.json"), "utf8")) as AtlasSnapshot;
    bundled = { snap, diseases: snap.entities.filter((e) => e.type === "disease").map((e) => e.id), observedEdges: snap.edges.filter((e) => e.kind === "observed").length };
  } catch { bundled = { snap: null, diseases: [], observedEdges: 0 }; }
  return bundled;
}

/** The bundled file with the live overlays on top (analytics of the file are kept: overlays never feed the analysis). */
async function fileWithOverlays(reason: string): Promise<AtlasSnapshot | null> {
  const file = bundledSnapshot();
  if (!file.snap) return null;
  const { snapshot, extracted } = applyOverlays(file.snap, await fetchOverlays(publicClient()));
  console.warn(`[atlas] ${reason}: using data/atlas.json + live overlays (${extracted} extracted edges, ${snapshot.proposals?.length ?? 0} proposals)`);
  return { ...snapshot, origin: "file+live-overlays" };
}

export async function loadFromSupabase(): Promise<AtlasSnapshot | null> {
  const mode = process.env.NEDAMEX_DATA_SOURCE ?? process.env.NEXMED_DATA_SOURCE; // old name still accepted
  if (mode === "file") return null;
  const t0 = Date.now();
  const { snapshot, stats } = await fetchSnapshot(publicClient());
  if (!snapshot.entities.length) return null;
  if (mode !== "supabase") {
    const live = new Set(snapshot.entities.filter((e) => e.type === "disease").map((e) => e.id));
    const file = bundledSnapshot();
    const missing = file.diseases.filter((d) => !live.has(d));
    if (missing.length) return fileWithOverlays(`live graph misses ${missing.length} bundled disease(s) (${missing.slice(0, 4).join(", ")}…)`);
    const liveObserved = snapshot.edges.filter((e) => e.kind === "observed").length;
    if (liveObserved < MIN_EDGE_RATIO * file.observedEdges) return fileWithOverlays(`live graph has ${liveObserved} observed edges vs ${file.observedEdges} in data/atlas.json (< ${MIN_EDGE_RATIO * 100}%)`);
  }
  const snap = withAnalytics(snapshot);
  if (process.env.NODE_ENV !== "production" || process.env.NEDAMEX_DEBUG) {
    console.info(`[atlas] supabase: ${snap.entities.length} entities, ${snap.edges.length} edges, ${snap.analytics?.clusters.length ?? 0} clusters · fetch ${stats.ms} ms (${stats.requests} requests) · total ${Date.now() - t0} ms`);
  }
  return snap;
}
