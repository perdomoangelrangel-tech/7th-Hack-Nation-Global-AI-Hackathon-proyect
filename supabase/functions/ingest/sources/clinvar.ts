// ClinVar via E-utilities: pathogenic / likely pathogenic germline variants per gene.
import type { Ctx, EntityRef, SeedDisease } from "../types.ts";
import { getJSON, sleep, trunc } from "../http.ts";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const TOOL = "&tool=nedamex_atlas";
const key = () => (Deno.env.get("NCBI_API_KEY") ? `&api_key=${Deno.env.get("NCBI_API_KEY")}` : "");
// deno-lint-ignore no-explicit-any
type Any = any;

// Search terms, first that returns >= 5 ids wins (ClinVar query syntax has changed over time)
const TERMS = (symbol: string) => [
  `${symbol}[gene] AND (clinsig_pathogenic[prop] OR clinsig_likely_pathogenic[prop])`,
  `${symbol}[gene] AND (pathogenic[CLNSIG] OR likely pathogenic[CLNSIG])`,
];

export async function clinvar(ctx: Ctx, d: SeedDisease, retmax = 25) {
  for (const symbol of d.genes) {
    let ids: string[] = []; let used = "";
    for (const t of TERMS(symbol)) {
      const s = await getJSON<Any>(`${BASE}/esearch.fcgi?db=clinvar&term=${encodeURIComponent(t)}&retmax=${retmax}&retmode=json${TOOL}${key()}`).catch((e) => { ctx.note(`clinvar esearch: ${e?.message ?? e}`); return null; });
      ctx.sample(`clinvar.esearch.${symbol}.${TERMS(symbol).indexOf(t)}`, { count: s?.esearchresult?.count, ids: s?.esearchresult?.idlist?.slice(0, 3), err: s?.esearchresult?.errorlist ?? s?.esearchresult?.warninglist });
      await sleep(400);
      ids = s?.esearchresult?.idlist ?? [];
      if (ids.length >= 5) { used = t; break; }
    }
    if (!ids.length) { ctx.note(`clinvar: no variants for ${symbol}`); continue; }
    const sum = await getJSON<Any>(`${BASE}/esummary.fcgi?db=clinvar&id=${ids.join(",")}&retmode=json${TOOL}${key()}`);
    await sleep(400);
    const result = sum?.result ?? {};
    ctx.sample(`clinvar.esummary.${symbol}`, result[ids[0]]);

    const geneId = await geneCanonicalId(ctx, symbol, d);
    const gene: EntityRef = { type: "gene", canonicalId: geneId, name: symbol, props: { symbol } };
    for (const id of ids) {
      const v = result[id]; if (!v || v.error) continue;
      const gc = v.germline_classification ?? v.clinical_significance ?? {};
      const sig: string = gc.description ?? "";
      if (!/pathogenic/i.test(sig) || /conflicting/i.test(sig)) continue;
      const accession: string = v.accession ?? `VCV${id}`;
      const vs = (v.variation_set ?? [])[0] ?? {};
      ctx.batch.edge({
        from: gene,
        to: {
          type: "variant", canonicalId: `CLINVAR:${id}`, name: trunc(v.title ?? `ClinVar ${id}`, 200)!,
          props: {
            clinvar_id: id, accession, significance: sig, review_status: gc.review_status, last_evaluated: gc.last_evaluated,
            conditions: (gc.trait_set ?? []).map((t: Any) => t.trait_name).filter(Boolean).slice(0, 5),
            protein_change: v.protein_change || undefined, variation_type: v.obj_type ?? vs.variant_type,
            molecular_consequence: (v.molecular_consequence_list ?? []).slice(0, 3), cdna_change: vs.cdna_change,
          },
        },
        relation: "has_variant",
        confidence: /^pathogenic/i.test(sig) ? 0.9 : 0.7, confidenceBasis: "clinvar_significance",
        props: { significance: sig, review_status: gc.review_status },
        evidence: [{
          source: "clinvar", externalId: accession, url: `https://www.ncbi.nlm.nih.gov/clinvar/variation/${id}/`,
          publishedOn: gc.last_evaluated, quote: trunc(`${sig} · ${gc.review_status ?? ""}`, 300),
        }],
      });
    }
    ctx.extra[`variants_${symbol}`] = ids.length;
    if (used) ctx.extra[`clinvar_term_${symbol}`] = TERMS(symbol).indexOf(used);
  }
}

/** Reuse the gene node Orphanet created (HGNC id); fall back to seed HGNC, then SYMBOL:. */
async function geneCanonicalId(ctx: Ctx, symbol: string, d: SeedDisease): Promise<string> {
  const { data } = await ctx.db.from("entities").select("canonical_id").eq("type", "gene").eq("props->>symbol", symbol).limit(5);
  const hit = (data ?? []).map((r: Any) => r.canonical_id as string).sort((a: string, b: string) => (a.startsWith("HGNC:") ? 0 : 1) - (b.startsWith("HGNC:") ? 0 : 1))[0];
  return hit ?? d.hgnc?.[symbol] ?? `SYMBOL:${symbol}`;
}
