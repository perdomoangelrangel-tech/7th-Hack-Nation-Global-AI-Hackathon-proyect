/** Orphadata: ficha, genes (con efecto de la variante cuando Orphanet lo declara), fenotipos HPO y prevalencia por ORPHA code. */
import { type GraphWriter, getJSON, today } from "../graph";
import type { SeedDisease } from "../types";

const BASE = "https://api.orphadata.com";
const url = (path: string, code: string) => `${BASE}/${path}/orphacodes/${code}?lang=en`;
const orphaPage = (code: string) => `https://www.orpha.net/en/disease/detail/${code}`;

// Frecuencias HPO de Orphanet -> confianza numérica (punto medio del rango)
const FREQ: Record<string, number> = {
  "Obligate (100%)": 1, "Very frequent (99-80%)": 0.9, "Frequent (79-30%)": 0.55,
  "Occasional (29-5%)": 0.17, "Very rare (<4-1%)": 0.03, "Excluded (0%)": 0,
};

interface OrphaGeneRow {
  DisorderGeneAssociationType?: string; DisorderGeneAssociationStatus?: string; SourceOfValidation?: string;
  Gene?: { Symbol?: string; name?: string; Synonym?: string[]; ExternalReference?: { Source: string; Reference: string }[] };
}
interface OrphaPhenRow { HPO?: { HPOId?: string; HPOTerm?: string }; HPOFrequency?: string; DiagnosticCriteria?: string | null }

export async function ingestOrphanet(g: GraphWriter, d: SeedDisease) {
  const code = d.orpha.replace("ORPHA:", "");
  const ev = (ext: string, quote?: string) => ({ source: "orphanet" as const, externalId: ext, url: orphaPage(code), publishedOn: today(), quote });

  // 1. Ficha (definición, sinónimos, cruces OMIM/MONDO/ICD)
  const xref = await getJSON<{ data?: { results?: { SummaryInformation?: { Definition?: string }[]; Synonym?: string[]; ExternalReference?: { Source: string; Reference: string }[] } } }>(url("rd-cross-referencing", code));
  const x = xref.data?.results;
  const definition = x?.SummaryInformation?.[0]?.Definition;
  const xrefs = (x?.ExternalReference ?? []).map((r) => `${r.Source}:${r.Reference}`);
  const diseaseNode = { type: "disease" as const, canonicalId: d.orpha, name: d.name, props: { mondo: d.mondo, omim: d.omim, definition, name_es: d.name_es, short_name: d.short_name, short_name_es: d.short_name_es, xrefs, orphanet_url: orphaPage(code) } };
  const diseaseId = await g.upsertEntity(diseaseNode);
  await g.addAlias(diseaseId, d.name_es, "es");
  for (const t of [...d.search_terms, ...(x?.Synonym ?? [])]) await g.addAlias(diseaseId, t, "en");

  // 2. Genes asociados. "Candidate gene tested in" queda con confianza baja: no es causalidad demostrada.
  //    Algunas entradas de Orphanet (grupos clínicos como Angelman o CLN2) no tienen genes en este endpoint:
  //    entonces se usa la asociación causal de Monarch (OMIM / ClinGen), citada como tal.
  const genes = await getJSON<{ data?: { results?: { DisorderGeneAssociation?: OrphaGeneRow[] } } }>(url("rd-associated-genes", code)).catch(() => null);
  const geneRows = genes?.data?.results?.DisorderGeneAssociation ?? [];
  if (!geneRows.length) await monarchCausalGenes(g, d, diseaseNode);
  for (const row of geneRows) {
    const symbol = row.Gene?.Symbol; if (!symbol) continue;
    const refs = row.Gene?.ExternalReference ?? [];
    const hgnc = refs.find((r) => r.Source === "HGNC")?.Reference;
    const ensembl = refs.find((r) => r.Source === "Ensembl")?.Reference;
    const type = row.DisorderGeneAssociationType ?? "";
    const candidate = /candidate/i.test(type);
    const effect = /loss of function/i.test(type) ? "loss_of_function" : /gain of function/i.test(type) ? "gain_of_function" : null;
    const geneId = await g.upsertEntity({ type: "gene", canonicalId: `SYMBOL:${symbol}`, name: symbol, props: { symbol, hgnc: hgnc ? `HGNC:${hgnc}` : undefined, ensembl, full_name: row.Gene?.name } });
    for (const s of row.Gene?.Synonym ?? []) await g.addAlias(geneId, s);
    await g.upsertEdge({
      from: { type: "gene", canonicalId: `SYMBOL:${symbol}`, name: symbol },
      to: diseaseNode, relation: "causes",
      confidence: candidate ? 0.3 : 0.9, confidenceBasis: "orphanet_gene_association",
      props: { association_type: type, status: row.DisorderGeneAssociationStatus, variant_effect: effect, primary: d.genes.includes(symbol) },
      evidence: [ev(`${d.orpha}/genes/${symbol}`, `${type} ${symbol}`.trim())],
    });
  }

  // 3. Fenotipos HPO con frecuencia (respaldo: anotaciones OMIM vía Monarch, sin frecuencia)
  const phen = await getJSON<{ data?: { results?: { Disorder?: { HPODisorderAssociation?: OrphaPhenRow[] } } } }>(url("rd-phenotypes", code)).catch(() => null);
  const phenRows = phen?.data?.results?.Disorder?.HPODisorderAssociation ?? [];
  if (!phenRows.length) await monarchPhenotypes(g, d, diseaseNode);
  for (const row of phenRows) {
    const hpId = row.HPO?.HPOId; if (!hpId) continue;
    const freq = row.HPOFrequency ?? "";
    if (FREQ[freq] === 0) continue; // "Excluded (0%)" es evidencia en contra; se guarda como prop del nodo, no como arista
    await g.upsertEdge({
      from: diseaseNode,
      to: { type: "phenotype", canonicalId: hpId, name: row.HPO?.HPOTerm ?? hpId },
      relation: "has_phenotype",
      confidence: FREQ[freq] ?? 0.5, confidenceBasis: "hpo_frequency",
      props: { frequency: freq, diagnostic_criteria: row.DiagnosticCriteria },
      evidence: [ev(`${d.orpha}/phenotypes/${hpId}`, `${row.HPO?.HPOTerm} · ${freq}`)],
    });
  }

  // 4. Prevalencia (va a props de la enfermedad)
  const epi = await getJSON<{ data?: { results?: { Prevalence?: { PrevalenceClass?: string; PrevalenceType?: string; PrevalenceGeographic?: string; ValMoy?: string }[] } } }>(url("rd-epidemiology", code)).catch(() => null);
  const prev = (epi?.data?.results?.Prevalence ?? []).filter((p) => p.PrevalenceClass && p.PrevalenceClass !== "Unknown")
    .map((p) => ({ class: p.PrevalenceClass, type: p.PrevalenceType, geo: p.PrevalenceGeographic }));
  if (prev.length) await g.upsertEntity({ ...diseaseNode, props: { ...diseaseNode.props, prevalence: prev.slice(0, 4) } });

  await g.markSynced("orphanet");
}

/* ---- Respaldo Monarch (OMIM / ClinGen) ---------------------------- */
const MONARCH = "https://api.monarchinitiative.org/v3/api/association";
interface MonarchAssoc { subject: string; subject_label: string; object: string; object_label: string; primary_knowledge_source: string; original_subject?: string | null; frequency_qualifier_label?: string | null }
type DiseaseNode = { type: "disease"; canonicalId: string; name: string; props: Record<string, unknown> };

async function monarchCausalGenes(g: GraphWriter, d: SeedDisease, diseaseNode: DiseaseNode) {
  const res = await getJSON<{ items: MonarchAssoc[] }>(`${MONARCH}?object=${d.mondo}&category=biolink:CausalGeneToDiseaseAssociation&limit=50`);
  const seen = new Set<string>();
  for (const a of res.items) {
    const symbol = a.subject_label; if (!symbol || seen.has(symbol)) continue; seen.add(symbol);
    const kb = a.primary_knowledge_source.replace("infores:", "").toUpperCase();
    await g.upsertEntity({ type: "gene", canonicalId: `SYMBOL:${symbol}`, name: symbol, props: { symbol, hgnc: a.subject } });
    await g.upsertEdge({
      from: { type: "gene", canonicalId: `SYMBOL:${symbol}`, name: symbol },
      to: diseaseNode, relation: "causes",
      confidence: 0.9, confidenceBasis: `monarch_${kb.toLowerCase()}_causal`,
      props: { association_type: `causes (${kb} vía Monarch)`, primary: d.genes.includes(symbol) },
      evidence: res.items.filter((x) => x.subject_label === symbol).map((x) => ({
        source: "monarch" as const, externalId: `${x.subject}/${d.mondo}/${x.primary_knowledge_source}`,
        url: `https://monarchinitiative.org/${d.mondo}`, publishedOn: today(),
        quote: `${symbol} causes ${d.name} · ${x.primary_knowledge_source.replace("infores:", "").toUpperCase()}`,
      })),
    });
  }
  await g.markSynced("monarch");
}

async function monarchPhenotypes(g: GraphWriter, d: SeedDisease, diseaseNode: DiseaseNode) {
  const res = await getJSON<{ items: MonarchAssoc[] }>(`${MONARCH}?subject=${d.mondo}&category=biolink:DiseaseToPhenotypicFeatureAssociation&limit=200`);
  for (const a of res.items) {
    if (!a.object?.startsWith("HP:")) continue;
    await g.upsertEdge({
      from: diseaseNode,
      to: { type: "phenotype", canonicalId: a.object, name: a.object_label },
      relation: "has_phenotype",
      confidence: 0.5, confidenceBasis: "monarch_annotation_no_frequency",
      props: { frequency: a.frequency_qualifier_label ?? "sin frecuencia (anotación OMIM)" },
      evidence: [{ source: "monarch", externalId: `${d.mondo}/${a.object}`, url: `https://monarchinitiative.org/${d.mondo}`, publishedOn: today(), quote: `${a.object_label} · ${a.primary_knowledge_source.replace("infores:", "")}` }],
    });
  }
  await g.markSynced("monarch");
}
