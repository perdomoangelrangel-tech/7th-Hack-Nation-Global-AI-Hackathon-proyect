/**
 * Medicines bank (WAVE 6 · T5). One row per treatment that has a `treats` edge to a disease in the graph.
 * Live source: Supabase view `medicines_public` (migration 0014). Fallback: the same shape built from the
 * graph snapshot, so the bank never goes blank. Every indication lists its sources with links.
 * No doses, no efficacy numbers — only what the sources state (stage, status, links).
 */
import type { Edge, Entity } from "../atlas/types";
import { outOf, type GraphIndex } from "./graph";

export interface MedicineSource { source: string; url: string; external_id: string }
export interface MedicineIndication { disease_id: string; disease: string; stage: string | null; status: string | null; nct_ids: string[]; edge_id: string; sources: MedicineSource[] }
export interface Medicine {
  id: string;                 // entity id, e.g. treatment:CHEMBL1009
  chembl_id: string | null;
  name: string;
  drug_type: string | null;
  mechanism: string | null;
  targets: string[];
  trade_names: string[];
  approved_for_listed_disease: boolean;
  max_stage: string | null;
  links: Record<string, string>;   // fda_label · dailymed · drugs_fda · ema_epar · chembl (data lane, from regulator APIs)
  indications: MedicineIndication[];
  bank_url: string | null;         // platform page: <APP_URL>/medicines/<chembl>
}
export interface MedicineQuery { q?: string | null; d?: string | null; approved?: boolean | null; limit?: number }
export interface MedicinesResult { medicines: Medicine[]; total: number; source: "supabase" | "graph"; disclaimer: string }

export const MEDICINES_DISCLAIMER = "Not medical advice. Sourced records only — whether a medicine fits a person is a decision for their clinician.";

/** Platform page for a medicine ("Open in Medicines bank"). */
export function medicineBankUrl(appUrl: string, chemblOrId: string | null | undefined): string | null {
  if (!chemblOrId) return null;
  const chembl = chemblOrId.replace(/^treatment:/, "");
  if (!/^CHEMBL\d+$/i.test(chembl)) return null;
  return `${appUrl.replace(/\/$/, "")}/medicines/${chembl.toUpperCase()}`;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function matchesQuery(m: Pick<Medicine, "name" | "trade_names" | "mechanism" | "chembl_id">, q: string): boolean {
  const n = norm(q.trim()); if (!n) return true;
  return [m.name, m.chembl_id ?? "", m.mechanism ?? "", ...m.trade_names].some((x) => norm(x).includes(n));
}

/** Graph fallback with the same shape as `medicines_public`. */
export function medicinesFromGraph(g: GraphIndex, appUrl: string, query: MedicineQuery = {}): MedicinesResult {
  const rows: Medicine[] = [];
  for (const t of g.snap.entities.filter((e) => e.type === "treatment")) {
    const treats = outOf(g, t.id).filter((e) => e.relation === "treats" && g.byId.get(e.to)?.type === "disease");
    if (!treats.length) continue;
    rows.push(toMedicine(g, t, treats, appUrl));
  }
  return filterMedicines(rows, query, "graph");
}

function toMedicine(g: GraphIndex, t: Entity, treats: Edge[], appUrl: string): Medicine {
  const p = t.props as Record<string, unknown>;
  const chembl = (p.chembl_id as string | undefined) ?? (/^CHEMBL\d+$/.test(t.canonical_id) ? t.canonical_id : null);
  return {
    id: t.id, chembl_id: chembl, name: t.name,
    drug_type: (p.drug_type as string | undefined) ?? null,
    mechanism: (p.mechanism as string | undefined) ?? null,
    targets: strs(p.targets), trade_names: strs(p.trade_names),
    approved_for_listed_disease: treats.some((e) => e.props.stage === "APPROVAL" || e.props.approved === true),
    max_stage: (p.max_stage as string | undefined) ?? null,
    links: (p.links as Record<string, string> | undefined) ?? {},
    indications: treats.map((e) => ({
      disease_id: e.to, disease: g.byId.get(e.to)?.name ?? e.to,
      stage: (e.props.stage as string | undefined) ?? null, status: (e.props.status as string | undefined) ?? null,
      nct_ids: strs(e.props.nct_ids), edge_id: e.id,
      sources: e.evidence.map((ev) => ({ source: ev.source, url: ev.url, external_id: ev.external_id })),
    })),
    bank_url: medicineBankUrl(appUrl, chembl),
  };
}

export function filterMedicines(rows: Medicine[], query: MedicineQuery, source: MedicinesResult["source"]): MedicinesResult {
  let out = rows;
  if (query.d) out = out.filter((m) => m.indications.some((i) => i.disease_id === query.d));
  if (query.approved) out = out.filter((m) => m.approved_for_listed_disease);
  if (query.q) out = out.filter((m) => matchesQuery(m, query.q!));
  out = [...out].sort((a, b) => Number(b.approved_for_listed_disease) - Number(a.approved_for_listed_disease) || a.name.localeCompare(b.name));
  return { medicines: out.slice(0, query.limit ?? 50), total: out.length, source, disclaimer: MEDICINES_DISCLAIMER };
}

/** Map one `medicines_public` row (PostgREST JSON) to a Medicine. */
export function fromView(r: Record<string, unknown>, appUrl: string): Medicine {
  const chembl = (r.chembl_id as string | null) ?? ((r.canonical_id as string | undefined)?.startsWith("CHEMBL") ? (r.canonical_id as string) : null);
  return {
    id: String(r.entity_id), chembl_id: chembl, name: String(r.name),
    drug_type: (r.drug_type as string | null) ?? null, mechanism: (r.mechanism as string | null) ?? null,
    targets: strs(r.targets), trade_names: strs(r.trade_names),
    approved_for_listed_disease: r.approved_for_listed_disease === true,
    max_stage: (r.max_stage as string | null) ?? null,
    links: (r.links as Record<string, string> | null) ?? {},
    indications: ((r.indications as Record<string, unknown>[] | null) ?? []).map((i) => ({
      disease_id: String(i.disease_id), disease: String(i.disease), stage: (i.stage as string | null) ?? null, status: (i.status as string | null) ?? null,
      nct_ids: strs(i.nct_ids), edge_id: String(i.edge_id),
      sources: ((i.sources as MedicineSource[] | null) ?? []).filter((s) => s && typeof s.url === "string"),
    })),
    bank_url: medicineBankUrl(appUrl, chembl),
  };
}

