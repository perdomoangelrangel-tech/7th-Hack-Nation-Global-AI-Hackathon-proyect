/**
 * Open Targets Platform (GraphQL).
 *  - Fármacos y candidatos clínicos por enfermedad (drugAndClinicalCandidates; `knownDrugs` ya no existe en la API).
 *  - Vías Reactome por gen: la capa de MECANISMO que permite agrupar enfermedades por biología y no por nombre.
 * Usa graphql() que falla en voz alta si el esquema cambia.
 */
import { type GraphWriter, graphql, sleep } from "../graph";
import type { SeedDisease } from "../types";

const ENDPOINT = "https://api.platform.opentargets.org/api/v4/graphql";

const DRUGS = `
query drugs($efoId: String!) {
  disease(efoId: $efoId) {
    id name
    drugAndClinicalCandidates {
      rows {
        maxClinicalStage
        drug { id name drugType mechanismsOfAction { rows { mechanismOfAction } } }
        clinicalReports { id source url clinicalStage trialOverallStatus trialWhyStopped year }
      }
    }
  }
}`;

interface DrugRow {
  maxClinicalStage: string;
  drug: { id: string; name: string; drugType: string; mechanismsOfAction?: { rows: { mechanismOfAction: string }[] } } | null;
  clinicalReports: { id: string; source: string; url: string | null; clinicalStage: string; trialOverallStatus: string | null; trialWhyStopped: string | null; year: number | null }[];
}

const STAGE: Record<string, number> = { APPROVAL: 4, PHASE_4: 4, PHASE_3: 3, PHASE_2_3: 2.5, PHASE_2: 2, PHASE_1_2: 1.5, PHASE_1: 1, EARLY_PHASE_1: 0.5 };

export async function ingestOpenTargetsDrugs(g: GraphWriter, d: SeedDisease) {
  const res = await graphql<{ disease: { drugAndClinicalCandidates: { rows: DrugRow[] } } | null }>(ENDPOINT, DRUGS, { efoId: d.efo });
  const disease = { type: "disease" as const, canonicalId: d.orpha, name: d.name };
  if (!res.disease) {
    // No es un error del pipeline: es un hueco de cobertura que la UI debe poder decir.
    await g.upsertEntity({ ...disease, props: { opentargets_indexed: false } });
    console.warn(`    ⚠ Open Targets no indexa ${d.efo}; se registra como hueco de cobertura`);
    return;
  }
  await g.upsertEntity({ ...disease, props: { opentargets_indexed: true, opentargets_id: d.efo } });

  for (const r of res.disease.drugAndClinicalCandidates.rows) {
    if (!r.drug) continue;
    const stage = r.maxClinicalStage;
    const phase = STAGE[stage] ?? 0;
    const approved = /APPROV/.test(stage);
    const mechanisms = (r.drug.mechanismsOfAction?.rows ?? []).map((m) => m.mechanismOfAction);
    const reports = r.clinicalReports.slice(0, 4);
    const stopped = reports.filter((c) => ["TERMINATED", "WITHDRAWN", "SUSPENDED"].includes(c.trialOverallStatus ?? ""));
    await g.upsertEdge({
      from: { type: "treatment", canonicalId: r.drug.id, name: titleCase(r.drug.name), props: { drug_type: r.drug.drugType, mechanism: mechanisms[0], mechanisms } },
      to: disease, relation: "treats",
      confidence: approved ? 0.95 : phase >= 3 ? 0.75 : phase >= 2 ? 0.55 : 0.35,
      confidenceBasis: "clinical_stage",
      props: { stage, phase, approved, stopped_reports: stopped.map((c) => ({ id: c.id, why: c.trialWhyStopped })) },
      evidence: [
        { source: "opentargets", externalId: `${r.drug.id}/${d.efo}`, url: `https://platform.opentargets.org/drug/${r.drug.id}`, quote: `${titleCase(r.drug.name)} · ${stage}${mechanisms[0] ? ` · ${mechanisms[0]}` : ""}` },
        ...reports.filter((c) => c.url).map((c) => ({
          source: (c.source === "ClinicalTrials.gov" ? "ctgov" : "opentargets") as "ctgov" | "opentargets",
          externalId: c.id.toUpperCase(), url: c.url!,
          quote: `${c.clinicalStage}${c.trialOverallStatus ? ` · ${c.trialOverallStatus}` : ""}${c.trialWhyStopped ? ` · ${c.trialWhyStopped}` : ""}`,
        })),
      ],
    });
  }
  await g.markSynced("opentargets");
}

const SEARCH = `query s($q: String!) { search(queryString: $q, entityNames: ["target"], page: { index: 0, size: 3 }) { hits { id name } } }`;
const PATHWAYS = `query p($id: String!) { target(ensemblId: $id) { id approvedSymbol approvedName pathways { pathway pathwayId topLevelTerm } } }`;

/** Vías Reactome para cada gen del grafo que tenga asociación causal (no "candidate"). */
export async function ingestPathways(g: GraphWriter, symbols: string[]) {
  for (const symbol of symbols) {
    const s = await graphql<{ search: { hits: { id: string; name: string }[] } }>(ENDPOINT, SEARCH, { q: symbol });
    const hit = s.search.hits.find((h) => h.name.toUpperCase() === symbol.toUpperCase());
    if (!hit) continue;
    const t = await graphql<{ target: { id: string; approvedSymbol: string; approvedName: string; pathways: { pathway: string; pathwayId: string; topLevelTerm: string }[] } | null }>(ENDPOINT, PATHWAYS, { id: hit.id });
    if (!t.target) continue;
    await g.upsertEntity({ type: "gene", canonicalId: `SYMBOL:${symbol}`, name: symbol, props: { ensembl: t.target.id, full_name: t.target.approvedName } });
    for (const p of t.target.pathways.slice(0, 40)) {
      await g.upsertEdge({
        from: { type: "gene", canonicalId: `SYMBOL:${symbol}`, name: symbol },
        to: { type: "pathway", canonicalId: `REACT:${p.pathwayId}`, name: p.pathway, props: { top_level: p.topLevelTerm } },
        relation: "participates_in", confidence: 0.9, confidenceBasis: "reactome_curated",
        evidence: [{ source: "reactome", externalId: p.pathwayId, url: `https://reactome.org/content/detail/${p.pathwayId}`, quote: `${symbol} participa en ${p.pathway}` }],
      });
    }
    await sleep(150);
  }
  await g.markSynced("reactome");
}

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
