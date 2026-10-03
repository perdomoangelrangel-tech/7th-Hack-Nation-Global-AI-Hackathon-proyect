/** Open Targets Platform (GraphQL): fármacos conocidos por enfermedad con fase y mecanismo. */
import { Graph, getJSON } from "../graph";
import type { SeedDisease } from "../types";

const ENDPOINT = "https://api.platform.opentargets.org/api/v4/graphql";
const QUERY = `
query knownDrugs($efoId: String!) {
  disease(efoId: $efoId) {
    id name
    knownDrugs(size: 50) {
      rows {
        drug { id name drugType isApproved }
        phase status mechanismOfAction
        urls { name url }
      }
    }
  }
}`;

export async function ingestOpenTargets(g: Graph, d: SeedDisease) {
  const res = await getJSON<any>(ENDPOINT, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { efoId: d.efo } }),
  }).catch(() => null);
  const rows: any[] = res?.data?.disease?.knownDrugs?.rows ?? [];
  const disease = { type: "disease" as const, canonicalId: d.orpha, name: d.name };
  const seen = new Set<string>();

  for (const r of rows) {
    const drug = r.drug; if (!drug?.id || seen.has(drug.id)) continue; seen.add(drug.id);
    const phase = Number(r.phase ?? 0);
    await g.upsertEdge({
      from: { type: "treatment", canonicalId: drug.id, name: drug.name, props: { drug_type: drug.drugType, approved: drug.isApproved, mechanism: r.mechanismOfAction } },
      to: disease, relation: "treats",
      confidence: phase >= 4 ? 0.95 : phase === 3 ? 0.8 : phase === 2 ? 0.6 : 0.4,
      confidenceBasis: "clinical_phase",
      props: { phase, status: r.status },
      evidence: [
        { source: "opentargets", externalId: `${drug.id}/${d.efo}`, url: `https://platform.opentargets.org/evidence/${drug.id}/${d.efo}`, quote: `${drug.name} · phase ${phase} · ${r.mechanismOfAction ?? ""}` },
        ...((r.urls ?? []) as any[]).slice(0, 2).map((u) => ({ source: "opentargets" as const, externalId: `${drug.id}/${u.name}`, url: u.url, quote: u.name })),
      ],
    });
  }
  await g.markSynced("opentargets");
}
