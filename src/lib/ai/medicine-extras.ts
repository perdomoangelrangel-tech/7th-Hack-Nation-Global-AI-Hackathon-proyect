/**
 * Regulatory + literature fields for one medicine (data lane, migration 0015 on `medicines_public`): label use,
 * label URL/date, Rx status, routes, dosage forms, EMA/FDA regulatory, papers. Read null-safe with the public key
 * (5-minute cache), merged over the treatment's graph props. Missing columns simply yield no extra facts.
 */
import "server-only";
import { publicClient } from "../supabase/server";
import type { Entity } from "../atlas/types";
import { findTreatment, type MedicineExtras } from "./medicine";
import { reconcileOne } from "./reconcile";
import type { AtlasIndex } from "./types";

const TTL = 5 * 60_000;
const cache = new Map<string, { at: number; v: MedicineExtras }>();

const pick = (row: Record<string, unknown>): MedicineExtras => ({
  label_use: typeof row.label_use === "string" ? row.label_use : null,
  label_url: typeof row.label_url === "string" ? row.label_url : null,
  label_effective: typeof row.label_effective === "string" ? row.label_effective : null,
  rx_status: typeof row.rx_status === "string" ? row.rx_status : null,
  routes: Array.isArray(row.routes) ? (row.routes as unknown[]).filter((x): x is string => typeof x === "string") : null,
  dosage_forms: Array.isArray(row.dosage_forms) ? (row.dosage_forms as unknown[]).filter((x): x is string => typeof x === "string") : null,
  regulatory: row.regulatory && typeof row.regulatory === "object" ? row.regulatory as MedicineExtras["regulatory"] : null,
  links: row.links && typeof row.links === "object" ? row.links as MedicineExtras["links"] : null,
  papers: Array.isArray(row.papers) ? row.papers as MedicineExtras["papers"] : null,
});

export async function medicineExtras(t: Entity): Promise<MedicineExtras> {
  const hit = cache.get(t.id);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  const fromProps = pick(t.props);
  let fromDb: MedicineExtras = {};
  try {
    const { data } = await publicClient().from("medicines_public").select("*").eq("entity_id", t.id).limit(1).abortSignal(AbortSignal.timeout(4000));
    if (data?.[0]) fromDb = pick(data[0] as Record<string, unknown>);
  } catch { /* the summary still works from graph facts */ }
  const merged = Object.fromEntries(Object.entries({ ...fromProps, ...fromDb }).map(([k, v]) => [k, v ?? (fromProps as Record<string, unknown>)[k] ?? null])) as MedicineExtras;
  cache.set(t.id, { at: Date.now(), v: merged });
  return merged;
}

/**
 * The graph record for a medicine id coming from the medicines bank. Bank rows (live DB) and the served graph can
 * file the same drug under different ChEMBL records (e.g. "Fenfluramine Hydrochloride" CHEMBL2106217 vs "Fenfluramine"
 * CHEMBL87493): id first, then the bank row's name matched salt-insensitively. `bankName` is set when the bank knows
 * the id but the graph does not link it yet.
 */
export async function resolveMedicine(idx: AtlasIndex, idOrName: string): Promise<{ entity: Entity | null; bankName: string | null }> {
  const direct = findTreatment(idx, idOrName);
  if (direct) return { entity: direct, bankName: null };
  const id = /^treatment:/i.test(idOrName) ? idOrName : /^CHEMBL\d+$/i.test(idOrName) ? `treatment:${idOrName.toUpperCase()}` : null;
  if (!id) return { entity: null, bankName: null };
  let name: string | null = null;
  try {
    const { data } = await publicClient().from("medicines_public").select("name").eq("entity_id", id).limit(1).abortSignal(AbortSignal.timeout(4000));
    name = (data?.[0] as { name?: string } | undefined)?.name ?? null;
  } catch { /* bank unavailable */ }
  if (!name) return { entity: null, bankName: null };
  const byName = findTreatment(idx, name) ?? (() => { const m = reconcileOne(idx, name, { type: "treatment", strict: true }); return m.entity_id ? idx.byId.get(m.entity_id) ?? null : null; })();
  return { entity: byName, bankName: byName ? null : name };
}
