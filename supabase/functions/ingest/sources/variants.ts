// Variant profile PER DISEASE (not per gene): the same gene can act through different mechanisms depending on the
// disease (KCNQ2 overall has many truncating variants — benign neonatal epilepsy — but in the encephalopathy DEE7
// missense variants dominate). Full ClinVar counts (not a sample) for the seed gene restricted to the ClinVar trait
// name, written on the gene -[causes]-> disease edge as `variant_counts` + `primary: true`.
import type { Ctx, SeedDisease } from "../types.ts";
import { getJSON, sleep } from "../http.ts";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const TOOL = "&tool=nedamex_atlas";
const key = () => (Deno.env.get("NCBI_API_KEY") ? `&api_key=${Deno.env.get("NCBI_API_KEY")}` : "");
const PLP = "(clinsig_pathogenic[prop] OR clinsig_likely_pathogenic[prop])";
const MISSENSE_Q = `"missense variant"[molecular consequence]`;
const TRUNC_Q = `("frameshift variant"[molecular consequence] OR "nonsense"[molecular consequence] OR "splice donor variant"[molecular consequence] OR "splice acceptor variant"[molecular consequence])`;

// deno-lint-ignore no-explicit-any
type Any = any;
async function count(term: string) {
  const r = await getJSON<Any>(`${BASE}/esearch.fcgi?db=clinvar&term=${encodeURIComponent(term)}&retmax=0&retmode=json${TOOL}${key()}`);
  await sleep(380);
  return Number(r?.esearchresult?.count ?? 0);
}

export async function variants(ctx: Ctx, d: SeedDisease) {
  const disease = { type: "disease" as const, canonicalId: d.orpha, name: d.name };
  for (const symbol of d.genes) {
    const hgnc = d.hgnc?.[symbol];
    if (!hgnc) continue;
    const gene = { type: "gene" as const, canonicalId: hgnc, name: symbol, props: { symbol } };
    const evidence = { source: "orphanet" as const, externalId: `${d.orpha}/genes/${symbol}`, url: `https://www.orpha.net/en/disease/detail/${d.orpha.replace("ORPHA:", "")}`, quote: `${symbol} is the seed causal gene for ${d.name}` };
    if (!d.clinvar_disease) {
      // No ClinVar trait name: only flag the primary gene; the analysis falls back to the gene's variant sample.
      ctx.batch.edge({ from: gene, to: disease, relation: "causes", confidence: 0.9, confidenceBasis: "orphanet_gene_association", props: { primary: true }, evidence: [evidence] });
      continue;
    }
    const scope = `${symbol}[gene] AND ${PLP} AND "${d.clinvar_disease}"[dis]`;
    const total = await count(scope);
    const searchUrl = `https://www.ncbi.nlm.nih.gov/clinvar/?term=${encodeURIComponent(scope)}`;
    if (!total) {
      ctx.note(`variants: 0 P/LP for ${symbol} + "${d.clinvar_disease}"`);
      ctx.batch.edge({ from: gene, to: disease, relation: "causes", confidence: 0.9, confidenceBasis: "orphanet_gene_association", props: { primary: true }, evidence: [evidence] });
      continue;
    }
    const missense = await count(`${scope} AND ${MISSENSE_Q}`);
    const truncating = await count(`${scope} AND ${TRUNC_Q}`);
    ctx.batch.edge({
      from: gene, to: disease, relation: "causes", confidence: 0.9, confidenceBasis: "orphanet_gene_association",
      props: { primary: true, variant_counts: { total, missense, truncating, clinvar_disease: d.clinvar_disease, search_url: searchUrl } },
      evidence: [evidence, { source: "clinvar", externalId: `count:${symbol}:${d.clinvar_disease}`, url: searchUrl, quote: `${total} P/LP ${symbol} variants for "${d.clinvar_disease}": ${missense} missense, ${truncating} truncating` }],
    });
  }
}
