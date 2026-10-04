/**
 * Server-side, for the website teasers (WAVE 6): live numbers + examples from the platform's public views
 * (Supabase migration 0014: medicines_public, community_profiles_public). Read-only with the public key.
 * Any failure returns null and the teaser renders without numbers — never invented ones.
 */
import { publicClient } from "@/lib/supabase/server";

interface IndicationSource { url?: string; source?: string; external_id?: string }
interface Indication { stage?: string; disease?: string; disease_id?: string; sources?: IndicationSource[] }

export interface MedicineExample { name: string; disease: string; sourceUrl: string; sourceLabel: string }
export interface PlatformTeasers {
  medicines: { total: number; approved: number; examples: MedicineExample[] } | null;
  community: { total: number } | null;
}

const within = <T>(p: PromiseLike<T>, ms = 6000) => Promise.race([Promise.resolve(p), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/** Prefer the regulator's own label page; else the Open Targets drug page that states the indication. */
function bestSource(sources: IndicationSource[] = []): { url: string; label: string } | null {
  const reg = sources.find((s) => s.url && /(fda\.gov|dailymed\.nlm\.nih\.gov|ema\.europa\.eu)/.test(s.url));
  if (reg?.url) return { url: reg.url, label: /ema\.europa/.test(reg.url) ? "EMA" : /dailymed/.test(reg.url) ? "DailyMed label" : "FDA label" };
  const ot = sources.find((s) => s.url && /platform\.opentargets\.org/.test(s.url));
  return ot?.url ? { url: ot.url, label: "Open Targets" } : null;
}

export async function platformTeasers(): Promise<PlatformTeasers> {
  const db = publicClient();
  const [medTotal, medApproved, examples, people] = await Promise.allSettled([
    within(db.from("medicines_public").select("entity_id", { count: "exact", head: true })),
    within(db.from("medicines_public").select("entity_id", { count: "exact", head: true }).eq("approved_for_listed_disease", true)),
    within(db.from("medicines_public").select("name, indications").eq("approved_for_listed_disease", true).order("name").limit(60)),
    within(db.from("community_profiles_public").select("entity_id", { count: "exact", head: true })),
  ]);
  const count = (r: PromiseSettledResult<{ count: number | null; error: unknown }>) => (r.status === "fulfilled" && !r.value.error && typeof r.value.count === "number" ? r.value.count : null);
  const total = count(medTotal as PromiseSettledResult<{ count: number | null; error: unknown }>);
  const approved = count(medApproved as PromiseSettledResult<{ count: number | null; error: unknown }>);
  const researchers = count(people as PromiseSettledResult<{ count: number | null; error: unknown }>);

  // Three approved medicines whose indication is confirmed by the regulator's label (one per disease).
  const picks: MedicineExample[] = [];
  if (examples.status === "fulfilled" && !examples.value.error && Array.isArray(examples.value.data)) {
    const seen = new Set<string>();
    for (const row of examples.value.data as { name: string; indications: Indication[] | null }[]) {
      for (const ind of row.indications ?? []) {
        if (ind.stage !== "APPROVAL" || !ind.disease || seen.has(ind.disease)) continue;
        const src = bestSource(ind.sources);
        if (!src || src.label === "Open Targets") continue;
        picks.push({ name: row.name, disease: ind.disease, sourceUrl: src.url, sourceLabel: src.label });
        seen.add(ind.disease);
        break;
      }
      if (picks.length === 3) break;
    }
  }
  return {
    medicines: total !== null && approved !== null ? { total, approved, examples: picks } : null,
    community: researchers !== null ? { total: researchers } : null,
  };
}
