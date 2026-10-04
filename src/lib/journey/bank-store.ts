/**
 * Server reads/writes for the Medicines bank and the Community (migration 0014). Small views (~300 medicines,
 * ~800 researchers): read whole, cache 5 min, filter in memory. If Supabase does not answer, rebuild from the
 * graph snapshot and say so (`source: "graph"`).
 */
import "server-only";
import { publicClient } from "@/lib/supabase/server";
import { site } from "@/lib/site";
import { graph } from "./server";
import { filterMedicines, fromView, medicinesFromGraph, type Medicine, type MedicineQuery, type MedicinesResult } from "./medicines";
import { COMMUNITY_NOTE, communityFromGraph, fromProfileView, fromSubmission, matchesProfile, rankProfiles, type CommunityProfile, type CommunityQuery, type CommunityResult, type ProfileInput } from "./community";

const TTL = 5 * 60_000;
let medCache: { at: number; rows: Medicine[] } | null = null;
let nihCache: { at: number; rows: CommunityProfile[] } | null = null;

export async function getMedicines(query: MedicineQuery): Promise<MedicinesResult> {
  try {
    if (!medCache || Date.now() - medCache.at > TTL) {
      const { data, error } = await publicClient().from("medicines_public").select("*").limit(2000);
      if (error) throw new Error(error.message);
      medCache = { at: Date.now(), rows: (data ?? []).map((r) => fromView(r as Record<string, unknown>, site.appUrl)) };
    }
    return filterMedicines(medCache.rows, query, "supabase");
  } catch (e) {
    console.warn("[medicines] medicines_public unavailable, using the graph:", (e as Error).message);
    return medicinesFromGraph(await graph(), site.appUrl, query);
  }
}

export async function getCommunity(query: CommunityQuery): Promise<CommunityResult> {
  const g = await graph();
  const name = (id: string) => g.byId.get(id)?.name ?? id;
  const sources: CommunityResult["sources"] = [];
  let nih: CommunityProfile[];
  try {
    if (!nihCache || Date.now() - nihCache.at > TTL) {
      const { data, error } = await publicClient().from("community_profiles_public").select("*").limit(5000);
      if (error) throw new Error(error.message);
      nihCache = { at: Date.now(), rows: (data ?? []).map((r) => fromProfileView(r as Record<string, unknown>)) };
    }
    nih = nihCache.rows.filter((p) => !query.d || p.diseases.some((x) => x.disease_id === query.d));
    sources.push("supabase");
  } catch (e) {
    console.warn("[community] community_profiles_public unavailable, using the graph:", (e as Error).message);
    nih = communityFromGraph(g, { d: query.d });
    sources.push("graph");
  }
  let self: CommunityProfile[] = [];
  try {
    let q = publicClient().from("profile_submissions").select("id,display_name,role,institution,diseases,focus,orcid,link,status,created_at").neq("status", "rejected").order("created_at", { ascending: false }).limit(500);
    if (query.d) q = q.contains("diseases", [query.d]);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    self = (data ?? []).map((r) => fromSubmission(r as Record<string, unknown>, name));
  } catch (e) {
    console.warn("[community] profile_submissions unavailable:", (e as Error).message);
  }
  let all = [...nih, ...self];
  if (query.q) all = all.filter((p) => matchesProfile(p, query.q!));
  const ranked = rankProfiles(all);
  return { profiles: ranked.slice(0, query.limit ?? 50), total: ranked.length, sources, note: COMMUNITY_NOTE };
}

/** RPC submit_profile (security definer, consent enforced in SQL too). Unknown disease ids are dropped. */
export async function submitProfile(input: ProfileInput): Promise<{ ok: true; id: string; dropped_diseases: string[] } | { ok: false; error: string }> {
  const g = await graph();
  const diseases = [...new Set(input.diseases)].filter((d) => g.byId.get(d)?.type === "disease");
  const dropped_diseases = input.diseases.filter((d) => !diseases.includes(d));
  const { data, error } = await publicClient().rpc("submit_profile", {
    p_display_name: input.display_name, p_role: input.role, p_institution: input.institution ?? null, p_diseases: diseases,
    p_focus: input.focus ?? null, p_orcid: input.orcid ?? null, p_link: input.link ?? null, p_consent: input.consent,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: String(data), dropped_diseases };
}
