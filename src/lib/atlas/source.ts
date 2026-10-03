/**
 * Live graph source. OWNER: data lane.
 * Must return the full graph in AtlasSnapshot format (entities, edges with >= 1 evidence each, analytics)
 * read from Supabase project zuqwmvshkhniqebtxlks, or null when Supabase is not configured / unreachable.
 * Analytics (clusters, similarity, bridges, gaps, counterexamples) are computed in-process with
 * ./analyze.ts when the database does not provide them.
 */
import "server-only";
import type { AtlasSnapshot } from "./types";

export async function loadFromSupabase(): Promise<AtlasSnapshot | null> {
  // TODO(data lane): implement (RPC atlas_snapshot() or paginated PostgREST reads + analyze()).
  return null;
}
