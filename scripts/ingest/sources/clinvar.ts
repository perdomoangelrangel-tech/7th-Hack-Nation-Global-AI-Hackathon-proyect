/** ClinVar vía E-utilities: variantes patogénicas / probablemente patogénicas por gen. */
import { Graph, getJSON, sleep } from "../graph";
import type { SeedDisease } from "../types";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const key = () => (process.env.NCBI_API_KEY ? `&api_key=${process.env.NCBI_API_KEY}` : "");

export async function ingestClinVar(g: Graph, d: SeedDisease, retmax = 20) {
  for (const symbol of d.genes) {
    const term = encodeURIComponent(`${symbol}[gene] AND (pathogenic[CLNSIG] OR likely pathogenic[CLNSIG])`);
    const search = await getJSON<any>(`${BASE}/esearch.fcgi?db=clinvar&term=${term}&retmax=${retmax}&retmode=json${key()}`).catch(() => null);
    const ids: string[] = search?.esearchresult?.idlist ?? [];
    if (!ids.length) continue;
    await sleep(350);
    const sum = await getJSON<any>(`${BASE}/esummary.fcgi?db=clinvar&id=${ids.join(",")}&retmode=json${key()}`).catch(() => null);
    const result = sum?.result ?? {};
    const gene = { type: "gene" as const, canonicalId: `SYMBOL:${symbol}`, name: symbol, props: { symbol } };

    for (const id of ids) {
      const v = result[id]; if (!v) continue;
      const sig: string = v.germline_classification?.description ?? v.clinical_significance?.description ?? "";
      await g.upsertEdge({
        from: gene,
        to: { type: "variant", canonicalId: `CLINVAR:${id}`, name: v.title ?? `ClinVar ${id}`, props: { significance: sig, review_status: v.germline_classification?.review_status, conditions: (v.germline_classification?.trait_set ?? []).map((t: any) => t.trait_name).slice(0, 5) } },
        relation: "has_variant",
        confidence: /^pathogenic/i.test(sig) ? 0.9 : 0.7, confidenceBasis: "clinvar_significance",
        evidence: [{ source: "clinvar", externalId: `VCV:${v.accession ?? id}`, url: `https://www.ncbi.nlm.nih.gov/clinvar/variation/${id}/`, publishedOn: v.germline_classification?.last_evaluated, quote: sig }],
      });
    }
    await sleep(350);
  }
  await g.markSynced("clinvar");
}
