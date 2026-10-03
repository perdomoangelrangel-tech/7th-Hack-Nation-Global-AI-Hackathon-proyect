// Orphadata API: disease card (definition, synonyms, xrefs), associated genes, HPO phenotypes
// with frequency, prevalence and natural history. Monarch v3 is the fallback when Orphanet has no
// gene association (e.g. ORPHA:72, genes live on its subtypes) or fewer than 5 HPO annotations.
import type { Ctx, EntityRef, SeedDisease } from "../types.ts";
import { asArray, findKey, getJSON, today, trunc } from "../http.ts";

const BASE = "https://api.orphadata.com";
const api = (path: string, code: string) => `${BASE}/${path}/orphacodes/${code}?lang=en`;
const page = (code: string) => `https://www.orpha.net/en/disease/detail/${code}`;

// Orphanet HPO frequency -> numeric confidence
const FREQ: Record<string, number> = {
  "Obligate (100%)": 1, "Very frequent (99-80%)": 0.9, "Frequent (79-30%)": 0.55,
  "Occasional (29-5%)": 0.17, "Very rare (<4-1%)": 0.03, "Excluded (0%)": 0,
};
// Monarch / HPO frequency qualifiers
const HP_FREQ: Record<string, [string, number]> = {
  "HP:0040280": ["Obligate (100%)", 1], "HP:0040281": ["Very frequent (99-80%)", 0.9],
  "HP:0040282": ["Frequent (79-30%)", 0.55], "HP:0040283": ["Occasional (29-5%)", 0.17],
  "HP:0040284": ["Very rare (<4-1%)", 0.03], "HP:0040285": ["Excluded (0%)", 0],
};

function geneConfidence(type?: string) {
  const t = (type ?? "").toLowerCase();
  if (t.includes("disease-causing")) return 0.9;
  if (t.includes("major susceptibility") || t.includes("role in the phenotype")) return 0.6;
  if (t.includes("modifying")) return 0.5;
  if (t.includes("candidate") || t.includes("biomarker")) return 0.3;
  return 0.5;
}

// deno-lint-ignore no-explicit-any
type Any = any;

export async function orphanet(ctx: Ctx, d: SeedDisease) {
  const code = d.orpha.replace("ORPHA:", "");
  const ev = (ext: string, quote?: string) => ({ source: "orphanet" as const, externalId: ext, url: page(code), publishedOn: today(), quote });
  const get = (path: string) => getJSON<Any>(api(path, code)).catch((e) => ({ __error: String(e?.message ?? e) }));

  const [xref, genes, phen, epi, nat] = await Promise.all([
    get("rd-cross-referencing"), get("rd-associated-genes"), get("rd-phenotypes"), get("rd-epidemiology"), get("rd-natural_history"),
  ]);
  ctx.sample("orphanet.cross_referencing", xref);
  ctx.sample("orphanet.associated_genes", genes);
  ctx.sample("orphanet.phenotypes", phen);
  ctx.sample("orphanet.epidemiology", epi);
  ctx.sample("orphanet.natural_history", nat);
  for (const [k, v] of Object.entries({ xref, genes, phen, epi, nat })) if (v?.__error) ctx.note(`orphanet ${k}: ${v.__error}`);

  // 1) Disease card
  const summary = asArray(findKey(xref, "SummaryInformation"));
  const definition: string | undefined =
    summary.map((s: Any) => s?.Definition).find((x: unknown) => typeof x === "string") ?? findKey(xref, "Definition");
  const synonyms: string[] = asArray(findKey(xref, "Synonym")).map((s: Any) => (typeof s === "string" ? s : s?.label ?? s?.Synonym)).filter(Boolean);
  const xrefs: Record<string, string[]> = {};
  for (const r of asArray(findKey(xref, "ExternalReference"))) {
    const src = (r as Any)?.Source; const ref = (r as Any)?.Reference;
    if (src && ref) (xrefs[src] ??= []).push(String(ref));
  }
  const preferred: string | undefined = findKey(xref, "Preferred term");

  // Prevalence + natural history (props of the disease)
  const prevalence = asArray(findKey(epi, "Prevalence")).slice(0, 8).map((p: Any) => ({
    type: p?.PrevalenceType, qualification: p?.PrevalenceQualification, class: p?.PrevalenceClass,
    value: p?.ValMoy, geographic: p?.PrevalenceGeographic, status: p?.PrevalenceValidationStatus,
    source: trunc(p?.Source, 200),
  }));
  const onset = asArray(findKey(nat, "AverageAgeOfOnset")).map((x: Any) => x?.Name ?? x?.["Age of onset"] ?? x).filter((x: unknown) => typeof x === "string");
  const inheritance = asArray(findKey(nat, "TypeOfInheritance")).map((x: Any) => x?.Name ?? x?.["Type of inheritance"] ?? x).filter((x: unknown) => typeof x === "string");

  const disease: EntityRef = {
    type: "disease", canonicalId: d.orpha, name: d.name,
    props: {
      orpha: d.orpha, mondo: d.mondo, name_es: d.name_es, orphanet_name: preferred,
      definition, xrefs: Object.keys(xrefs).length ? xrefs : undefined,
      prevalence: prevalence.length ? prevalence : undefined,
      age_of_onset: onset.length ? onset : undefined,
      inheritance: inheritance.length ? inheritance : undefined,
      orphanet_url: page(code), genes_seed: d.genes,
    },
  };
  ctx.batch.entity(disease);
  ctx.batch.alias(disease, d.name_es, "es");
  ctx.batch.alias(disease, d.name, "en");
  for (const t of d.search_terms) ctx.batch.alias(disease, t, "en");
  for (const s of synonyms.slice(0, 15)) ctx.batch.alias(disease, s, "en");
  const diseaseRef: EntityRef = { type: "disease", canonicalId: d.orpha, name: d.name };

  // 2) Associated genes
  const geneRows: Any[] = asArray(findKey(genes, "DisorderGeneAssociation"));
  for (const row of geneRows) {
    const gene = row?.Gene ?? row;
    const symbol: string | undefined = gene?.Symbol;
    if (!symbol) continue;
    const refs: Any[] = asArray(gene?.ExternalReference);
    const ref = (src: string) => refs.find((r) => r?.Source === src)?.Reference;
    const hgnc = ref("HGNC") ?? d.hgnc?.[symbol]?.replace("HGNC:", "");
    const assocType: string | undefined = row?.DisorderGeneAssociationType ?? row?.AssociationType;
    const validation: string = String(row?.SourceOfValidation ?? "");
    const pmids = [...validation.matchAll(/(\d{5,9})\[PMID\]/g)].map((m) => m[1]).slice(0, 3);
    const geneRef: EntityRef = {
      type: "gene", canonicalId: hgnc ? `HGNC:${String(hgnc).replace("HGNC:", "")}` : `SYMBOL:${symbol}`, name: symbol,
      props: { symbol, full_name: gene?.Name, locus: asArray(gene?.Locus).map((l: Any) => l?.GeneLocus ?? l).filter((x: unknown) => typeof x === "string")[0], ensembl: ref("Ensembl"), omim: ref("OMIM"), gene_type: gene?.GeneType },
    };
    ctx.batch.edge({
      from: geneRef, to: diseaseRef, relation: "causes",
      confidence: geneConfidence(assocType), confidenceBasis: "orphanet_gene_association",
      props: { association_type: assocType, association_status: row?.DisorderGeneAssociationStatus, validation_pmids: pmids },
      evidence: [
        ev(`${d.orpha}/genes/${symbol}`, `${symbol}: ${assocType ?? "associated gene"} (Orphanet)`),
        ...pmids.map((p) => ({
          source: "pubmed" as const, externalId: `PMID:${p}`, url: `https://pubmed.ncbi.nlm.nih.gov/${p}/`,
          quote: `Cited by Orphanet as validation source for the ${symbol}–${d.name} association`,
        })),
      ],
    });
  }

  if (!geneRows.length) {
    ctx.note(`orphanet returned 0 associated genes; using Monarch causal-gene fallback`);
    await monarchGenes(ctx, d, diseaseRef);
  }

  // 3) HPO phenotypes
  const phenRows: Any[] = asArray(findKey(phen, "HPODisorderAssociation"));
  let nPhen = 0;
  for (const row of phenRows) {
    const hpId: string | undefined = row?.HPO?.HPOId ?? row?.HPOId;
    const term: string | undefined = row?.HPO?.HPOTerm ?? row?.HPOTerm;
    const freq: string | undefined = row?.HPOFrequency ?? row?.Frequency;
    if (!hpId) continue;
    nPhen++;
    ctx.batch.edge({
      from: diseaseRef, to: { type: "phenotype", canonicalId: hpId, name: term ?? hpId },
      relation: "has_phenotype",
      confidence: freq !== undefined && FREQ[freq] !== undefined ? FREQ[freq] : 0.5, confidenceBasis: "hpo_frequency",
      props: { frequency: freq, diagnostic_criteria: row?.DiagnosticCriteria },
      evidence: [ev(`${d.orpha}/phenotypes/${hpId}`, `${term ?? hpId}${freq ? ` · ${freq}` : ""}`)],
    });
  }

  // 4) Monarch fallback for phenotypes
  if (nPhen < 5) {
    ctx.note(`orphanet returned ${nPhen} HPO phenotypes; using Monarch fallback`);
    await monarchPhenotypes(ctx, d, diseaseRef);
  }
}

async function monarchPhenotypes(ctx: Ctx, d: SeedDisease, diseaseRef: EntityRef) {
  const url = `https://api-v3.monarchinitiative.org/v3/api/association?subject=${encodeURIComponent(d.mondo)}&category=biolink:DiseaseToPhenotypicFeatureAssociation&limit=150`;
  const res = await getJSON<Any>(url).catch((e) => { ctx.note(`monarch: ${e?.message ?? e}`); return null; });
  ctx.sample("monarch.disease_phenotypes", res);
  const items: Any[] = res?.items ?? [];
  for (const it of items) {
    const hp: string | undefined = it?.object;
    if (!hp?.startsWith("HP:")) continue;
    const fq = HP_FREQ[it?.frequency_qualifier ?? ""];
    ctx.batch.edge({
      from: diseaseRef, to: { type: "phenotype", canonicalId: hp, name: it?.object_label ?? hp },
      relation: "has_phenotype",
      confidence: fq ? fq[1] : 0.5, confidenceBasis: fq ? "hpo_frequency" : "source_default",
      props: { frequency: fq?.[0], via: "monarch" },
      evidence: [{
        source: "monarch", externalId: `${d.mondo}/${hp}`, url: `https://monarchinitiative.org/${d.mondo}`,
        quote: `${it?.object_label ?? hp} (${asArray(it?.primary_knowledge_source).join(", ") || "Monarch"})`,
        publishedOn: today(),
      }],
    });
  }
}

async function monarchGenes(ctx: Ctx, d: SeedDisease, diseaseRef: EntityRef) {
  const url = `https://api-v3.monarchinitiative.org/v3/api/association?object=${encodeURIComponent(d.mondo)}&category=biolink:CausalGeneToDiseaseAssociation&limit=20`;
  const res = await getJSON<Any>(url).catch((e) => { ctx.note(`monarch genes: ${e?.message ?? e}`); return null; });
  ctx.sample("monarch.causal_genes", res);
  for (const it of (res?.items ?? []) as Any[]) {
    const gid: string | undefined = it?.subject;
    const symbol: string | undefined = it?.subject_label;
    if (!gid || !symbol) continue;
    const ks = asArray(it?.primary_knowledge_source).join(", ");
    ctx.batch.edge({
      from: { type: "gene", canonicalId: gid.startsWith("HGNC:") ? gid : d.hgnc?.[symbol] ?? gid, name: symbol, props: { symbol } },
      to: diseaseRef, relation: "causes",
      confidence: 0.85, confidenceBasis: "monarch_causal_gene",
      props: { association_type: "Causal gene (Monarch)", knowledge_source: ks || undefined, via: "monarch" },
      evidence: [{
        source: "monarch", externalId: `${gid}/${d.mondo}`, url: `https://monarchinitiative.org/${d.mondo}`,
        quote: `${symbol} causal for ${it?.object_label ?? d.name}${ks ? ` (${ks})` : ""}`, publishedOn: today(),
      }],
    });
  }
}
