/** Orphadata: ficha, genes, fenotipos HPO y prevalencia por ORPHA code. */
import { Graph, getJSON, today } from "../graph";
import type { SeedDisease } from "../types";

const BASE = "https://api.orphadata.com";
const url = (path: string, code: string) => `${BASE}/${path}/orphacodes/${code}?lang=en`;
const orphaPage = (code: string) => `https://www.orpha.net/en/disease/detail/${code}`;

// Frecuencias HPO de Orphanet -> confianza numérica
const FREQ: Record<string, number> = {
  "Obligate (100%)": 1, "Very frequent (99-80%)": 0.9, "Frequent (79-30%)": 0.55,
  "Occasional (29-5%)": 0.17, "Very rare (<4-1%)": 0.03, "Excluded (0%)": 0,
};

export async function ingestOrphanet(g: Graph, d: SeedDisease) {
  const code = d.orpha.replace("ORPHA:", "");
  const ev = (ext: string) => ({ source: "orphanet" as const, externalId: ext, url: orphaPage(code), publishedOn: today() });

  // 1. Ficha de la enfermedad (definición + cruces OMIM/ICD)
  const xref = await getJSON<any>(url("rd-cross-referencing", code)).catch(() => null);
  const definition: string | undefined = xref?.data?.results?.SummaryInformation?.[0]?.Definition
    ?? xref?.data?.results?.Definition;
  const diseaseNode = { type: "disease" as const, canonicalId: d.orpha, name: d.name, props: { mondo: d.mondo, definition, name_es: d.name_es } };
  const diseaseId = await g.upsertEntity(diseaseNode);
  await g.addAlias(diseaseId, d.name_es, "es");
  for (const t of d.search_terms) await g.addAlias(diseaseId, t, "en");

  // 2. Genes asociados
  const genes = await getJSON<any>(url("rd-associated-genes", code)).catch(() => null);
  const geneRows: any[] = genes?.data?.results?.DisorderGeneAssociation ?? [];
  for (const row of geneRows) {
    const symbol = row?.Gene?.Symbol ?? row?.Symbol; const hgnc = row?.Gene?.ExternalReference?.find?.((r: any) => r.Source === "HGNC")?.Reference;
    if (!symbol) continue;
    await g.upsertEdge({
      from: { type: "gene", canonicalId: hgnc ? `HGNC:${hgnc}` : `SYMBOL:${symbol}`, name: symbol, props: { symbol } },
      to: diseaseNode, relation: "causes",
      confidence: 0.9, confidenceBasis: "orphanet_gene_association",
      props: { association_type: row?.DisorderGeneAssociationType ?? row?.AssociationType },
      evidence: [ev(`${d.orpha}/genes/${symbol}`)],
    });
  }

  // 3. Fenotipos HPO con frecuencia
  const phen = await getJSON<any>(url("rd-phenotypes", code)).catch(() => null);
  const phenRows: any[] = phen?.data?.results?.Disorder?.HPODisorderAssociation ?? phen?.data?.results?.HPODisorderAssociation ?? [];
  for (const row of phenRows) {
    const hpId = row?.HPO?.HPOId ?? row?.HPOId; const term = row?.HPO?.HPOTerm ?? row?.HPOTerm; const freq = row?.HPOFrequency ?? row?.Frequency;
    if (!hpId) continue;
    await g.upsertEdge({
      from: diseaseNode,
      to: { type: "phenotype", canonicalId: hpId, name: term ?? hpId },
      relation: "has_phenotype",
      confidence: FREQ[freq] ?? 0.5, confidenceBasis: "hpo_frequency",
      props: { frequency: freq },
      evidence: [ev(`${d.orpha}/phenotypes/${hpId}`)],
    });
  }

  // 4. Prevalencia (va a props de la enfermedad)
  const epi = await getJSON<any>(url("rd-epidemiology", code)).catch(() => null);
  const prev = epi?.data?.results?.Prevalence ?? epi?.data?.results?.Disorder?.Prevalence;
  if (prev) await g.upsertEntity({ ...diseaseNode, props: { ...diseaseNode.props, prevalence: prev } });

  await g.markSynced("orphanet");
}
