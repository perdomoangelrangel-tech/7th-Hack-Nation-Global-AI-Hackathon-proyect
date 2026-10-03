// Open Targets Platform (GraphQL): drug and clinical candidates per disease (ChEMBL, AACT, regulators)
// with max clinical stage, approval and mechanism of action. Writes `treats` edges treatment -> disease.
import type { Ctx, SeedDisease } from "../types.ts";
import { getJSON, today, trunc } from "../http.ts";

const ENDPOINT = "https://api.platform.opentargets.org/api/v4/graphql";
// deno-lint-ignore no-explicit-any
type Any = any;

const gql = (query: string, variables: Record<string, unknown> = {}) =>
  getJSON<Any>(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, variables }) });

// Open Targets 25.x replaced `knownDrugs` with `drugAndClinicalCandidates` (ChEMBL + AACT + regulatory reports).
const CANDIDATES = `
query candidates($efoId: String!) {
  disease(efoId: $efoId) {
    id name
    drugAndClinicalCandidates {
      count
      rows {
        id maxClinicalStage
        drug {
          id name drugType maximumClinicalStage
          parentMolecule { id name maximumClinicalStage }
          tradeNames { label source }
          synonyms { label source }
          mechanismsOfAction { rows { mechanismOfAction targets { approvedSymbol } } }
        }
        clinicalReports { id origin source title url clinicalStage trialPhase trialOverallStatus trialStartDate year }
      }
    }
  }
}`;

/** "APPROVAL" -> 4, "PHASE_3" -> 3, "PHASE_2_3" -> 3, "EARLY_PHASE_1" -> 0.5, else 0 */
export function stageToPhase(stage?: string | null): number {
  const s = (stage ?? "").toUpperCase();
  if (s.includes("APPROV") || s === "PHASE_4") return 4;
  if (s.startsWith("EARLY_PHASE")) return 0.5;
  const nums = [...s.matchAll(/\d/g)].map((m) => Number(m[0]));
  return nums.length ? Math.max(...nums) : 0;
}

const SEARCH = `
query s($q: String!) {
  search(queryString: $q, entityNames: ["disease"], page: { index: 0, size: 5 }) {
    hits { id name entity }
  }
}`;

async function resolveDiseaseId(ctx: Ctx, d: SeedDisease): Promise<string | null> {
  const probe = await gql(`query p($id: String!) { disease(efoId: $id) { id name } }`, { id: d.efo }).catch(() => null);
  if (probe?.data?.disease?.id) return probe.data.disease.id;
  for (const q of [d.name, ...d.search_terms]) {
    const res = await gql(SEARCH, { q }).catch(() => null);
    const hit = (res?.data?.search?.hits ?? []).find((h: Any) => h.entity === "disease");
    if (hit?.id) { ctx.note(`opentargets: ${d.efo} not found, resolved "${q}" -> ${hit.id} (${hit.name})`); return hit.id; }
  }
  return null;
}

export async function opentargets(ctx: Ctx, d: SeedDisease) {
  // Debug: { dry: true, step: "opentargets", gql: "<query>", vars: {...} } returns the raw response.
  if (ctx.dry && typeof ctx.params.gql === "string") {
    const r = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: ctx.params.gql, variables: ctx.params.vars ?? {} }) });
    ctx.sample("opentargets.raw", `${r.status} ${(await r.text()).slice(0, 7900)}`);
    return;
  }
  const efo = await resolveDiseaseId(ctx, d);
  if (!efo) { ctx.note(`opentargets: no disease id for ${d.name}`); return; }

  const res = await gql(CANDIDATES, { efoId: efo });
  if (res?.errors?.length) throw new Error(`opentargets graphql: ${JSON.stringify(res.errors).slice(0, 500)}`);
  const rows: Any[] = res?.data?.disease?.drugAndClinicalCandidates?.rows ?? [];
  ctx.sample("opentargets.candidates", { count: res?.data?.disease?.drugAndClinicalCandidates?.count, first: rows[0] });

  const diseaseRef = { type: "disease" as const, canonicalId: d.orpha, name: d.name };

  // Salt forms (e.g. FENFLURAMINE HYDROCHLORIDE) are folded into their parent molecule (FENFLURAMINE),
  // so one drug = one treatment node. The salt entity keeps `parent_chembl` for trial-name matching.
  const groups = new Map<string, Any>();
  for (const r of rows) {
    const drug = r?.drug; if (!drug?.id) continue;
    const parent = drug.parentMolecule?.id ? drug.parentMolecule : null;
    const key: string = parent?.id ?? drug.id;
    if (parent) {
      ctx.batch.entity({ type: "treatment", canonicalId: drug.id, name: titleCase(drug.name ?? drug.id), props: { chembl_id: drug.id, parent_chembl: parent.id, salt_of: titleCase(parent.name ?? parent.id) } });
    }
    const g = groups.get(key);
    if (!g) {
      groups.set(key, {
        ...r,
        drug: { ...drug, id: key, name: parent?.name ?? drug.name, maximumClinicalStage: parent?.maximumClinicalStage ?? drug.maximumClinicalStage },
        clinicalReports: [...(r.clinicalReports ?? [])],
      });
      continue;
    }
    if (stageToPhase(r.maxClinicalStage) > stageToPhase(g.maxClinicalStage)) g.maxClinicalStage = r.maxClinicalStage;
    g.clinicalReports.push(...(r.clinicalReports ?? []));
    g.drug.tradeNames = [...(g.drug.tradeNames ?? []), ...(drug.tradeNames ?? [])];
    g.drug.synonyms = [...(g.drug.synonyms ?? []), ...(drug.synonyms ?? [])];
    g.drug.mechanismsOfAction = { rows: [...(g.drug.mechanismsOfAction?.rows ?? []), ...(drug.mechanismsOfAction?.rows ?? [])] };
  }

  const seen = new Set<string>();
  for (const r of groups.values()) {
    const drug = r.drug; const chembl: string = drug.id;
    seen.add(chembl);
    const phase = stageToPhase(r.maxClinicalStage);
    const approvedForIndication = phase >= 4;
    const approvedAnywhere = stageToPhase(drug.maximumClinicalStage) >= 4;
    const moaRows: Any[] = drug.mechanismsOfAction?.rows ?? [];
    const mechanism = [...new Set(moaRows.map((m) => m?.mechanismOfAction).filter(Boolean))].slice(0, 3).join("; ") || undefined;
    const targets = [...new Set(moaRows.flatMap((m) => (m?.targets ?? []).map((t: Any) => t?.approvedSymbol)).filter(Boolean))].slice(0, 5);
    const tradeNames = [...new Set((drug.tradeNames ?? []).map((t: Any) => t?.label).filter(Boolean))].slice(0, 10) as string[];
    // ChEMBL synonyms only (AACT free-text synonyms are noisy, e.g. "cbd" listed for dronabinol)
    const synonyms = [...new Set((drug.synonyms ?? []).filter((x: Any) => x?.source === "ChEMBL").map((x: Any) => x?.label).filter(Boolean))].slice(0, 15) as string[];
    const reports: Any[] = r.clinicalReports ?? [];
    const ncts = [...new Set(reports.map((c) => String(c?.id ?? "")).filter((id) => /^nct\d+$/i.test(id)).map((id) => id.toUpperCase()))].slice(0, 20);
    const statuses = [...new Set(reports.map((c) => c?.trialOverallStatus).filter(Boolean))] as string[];
    const regulators = [...new Set(reports.filter((c) => c?.origin === "REGULATORY_AGENCY").map((c) => c?.source).filter(Boolean))] as string[];

    const treatment = {
      type: "treatment" as const, canonicalId: chembl, name: titleCase(drug.name ?? chembl),
      props: {
        chembl_id: chembl, drug_type: drug.drugType, approved: approvedAnywhere, max_stage: drug.maximumClinicalStage,
        mechanism, targets, trade_names: tradeNames, synonyms, intervention_type: "DRUG",
        opentargets_url: `https://platform.opentargets.org/drug/${chembl}`,
      },
    };
    for (const n of [drug.name, ...tradeNames, ...synonyms]) ctx.batch.alias(treatment, n, "en");

    // Evidence: the Open Targets drug page + up to 3 underlying reports (regulators first, then trials)
    const ranked = [...reports].filter((c) => c?.url)
      .sort((a, b) => (a.origin === "REGULATORY_AGENCY" ? 0 : 1) - (b.origin === "REGULATORY_AGENCY" ? 0 : 1) || stageToPhase(b.clinicalStage) - stageToPhase(a.clinicalStage))
      .slice(0, 3);
    ctx.batch.edge({
      from: treatment, to: diseaseRef, relation: "treats",
      confidence: phase >= 4 ? 0.95 : phase >= 3 ? 0.8 : phase >= 2 ? 0.6 : 0.4,
      confidenceBasis: "clinical_phase",
      props: {
        origin: "opentargets", phase, stage: r.maxClinicalStage, status: approvedForIndication ? "APPROVED" : statuses[0],
        approved: approvedAnywhere, approved_for_indication: approvedForIndication, investigational: !approvedForIndication,
        mechanism, intervention_type: "DRUG", nct_ids: ncts, regulators,
      },
      evidence: [
        {
          source: "opentargets", externalId: `${chembl}/${efo}`, url: `https://platform.opentargets.org/drug/${chembl}`,
          quote: trunc(`${drug.name} · ${r.maxClinicalStage} for ${d.name}${mechanism ? ` · ${mechanism}` : ""}`, 300),
          publishedOn: today(),
        },
        ...ranked.map((c) => ({
          source: "opentargets" as const, externalId: `${chembl}/${c.id}`, url: c.url,
          quote: trunc(`${c.source ?? c.origin}: ${c.title ?? ""} (${c.clinicalStage ?? ""})`, 300),
          publishedOn: c.trialStartDate ?? (c.year ? `${c.year}-01-01` : undefined),
        })),
      ],
    });
  }
  // Retract Open Targets edges for this disease that the source no longer reports (or that were salt
  // duplicates of a parent molecule). Skipped when the API returned nothing.
  if (!ctx.dry && seen.size) {
    const { data: existing } = await ctx.db.from("edge_evidence").select("edge_id, from_canonical_id, edge_props")
      .eq("relation", "treats").eq("to_canonical_id", d.orpha).limit(500);
    const stale = (existing ?? []).filter((x: Any) => x.edge_props?.origin === "opentargets" && !seen.has(x.from_canonical_id)).map((x: Any) => x.edge_id as string);
    if (stale.length) {
      const { error } = await ctx.db.from("edges").update({ status: "retracted", updated_at: new Date().toISOString() }).in("id", stale);
      if (error) ctx.note(`opentargets retract: ${error.message}`);
    }
    ctx.extra.retracted = stale.length;
  }
  ctx.extra.candidates = seen.size;
  if (!seen.size) ctx.note(`opentargets: 0 drug/clinical candidates for ${efo}`);
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_m, p, c) => p + c.toUpperCase());
}
