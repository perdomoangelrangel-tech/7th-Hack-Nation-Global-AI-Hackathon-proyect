/**
 * ClinVar vía E-utilities: variantes patogénicas / probablemente patogénicas por gen, con su consecuencia
 * molecular (para inferir efecto de pérdida de función vs. cambio de sentido) y el conteo de variantes con
 * interpretaciones en conflicto (evidencia contradictoria que se muestra, no se esconde).
 */
import { type GraphWriter, getJSON, sleep } from "../graph";
import type { SeedDisease } from "../types";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const key = () => (process.env.NCBI_API_KEY ? `&api_key=${process.env.NCBI_API_KEY}` : "");

type Json = any;

const PLP = "(clinsig_pathogenic[prop] OR clinsig_likely_pathogenic[prop])";
const MISSENSE_Q = `"missense variant"[molecular consequence]`;
const TRUNC_Q = `("frameshift variant"[molecular consequence] OR "nonsense"[molecular consequence] OR "splice donor variant"[molecular consequence] OR "splice acceptor variant"[molecular consequence])`;

async function count(term: string) {
  const r = await getJSON<Json>(`${BASE}/esearch.fcgi?db=clinvar&term=${encodeURIComponent(term)}&retmax=0&retmode=json${key()}`);
  await sleep(350);
  return Number(r?.esearchresult?.count ?? 0);
}

/**
 * Perfil de variantes POR ENFERMEDAD (no por gen): el mismo gen puede actuar por mecanismos distintos según
 * la enfermedad. KCNQ2 en total tiene muchas variantes truncantes (epilepsia neonatal benigna), pero en la
 * encefalopatía (DEE7) dominan las de sentido erróneo. Conteo completo, no muestra.
 */
async function variantProfile(g: GraphWriter, d: SeedDisease, symbol: string) {
  if (!d.clinvar_disease) return;
  const scope = `${symbol}[gene] AND ${PLP} AND "${d.clinvar_disease}"[dis]`;
  const total = await count(scope);
  if (!total) return;
  const missense = await count(`${scope} AND ${MISSENSE_Q}`);
  const truncating = await count(`${scope} AND ${TRUNC_Q}`);
  const searchUrl = `https://www.ncbi.nlm.nih.gov/clinvar/?term=${encodeURIComponent(scope)}`;
  await g.upsertEdge({
    from: { type: "gene", canonicalId: `SYMBOL:${symbol}`, name: symbol },
    to: { type: "disease", canonicalId: d.orpha, name: d.name },
    relation: "causes", confidence: 0.9, confidenceBasis: "orphanet_gene_association",
    props: { primary: true, variant_counts: { total, missense, truncating, clinvar_disease: d.clinvar_disease, search_url: searchUrl } },
    evidence: [{ source: "clinvar", externalId: `count:${symbol}:${d.clinvar_disease}`, url: searchUrl, quote: `${total} P/LP ${symbol} variants for "${d.clinvar_disease}": ${missense} missense, ${truncating} truncating` }],
  });
}

export async function ingestClinVar(g: GraphWriter, d: SeedDisease, retmax = 60) {
  for (const symbol of d.genes) {
    await variantProfile(g, d, symbol);
    const term = encodeURIComponent(`${symbol}[gene] AND (clinsig_pathogenic[prop] OR clinsig_likely_pathogenic[prop])`);
    const search = await getJSON<Json>(`${BASE}/esearch.fcgi?db=clinvar&term=${term}&retmax=${retmax}&retmode=json${key()}`);
    const ids: string[] = search?.esearchresult?.idlist ?? [];
    const total = Number(search?.esearchresult?.count ?? 0);
    await sleep(350);
    const conflictTerm = encodeURIComponent(`${symbol}[gene] AND clinsig_has_conflicts[prop]`);
    const conflicts = await getJSON<Json>(`${BASE}/esearch.fcgi?db=clinvar&term=${conflictTerm}&retmax=0&retmode=json${key()}`).catch(() => null);
    await g.upsertEntity({ type: "gene", canonicalId: `SYMBOL:${symbol}`, name: symbol, props: { clinvar_pathogenic_total: total, clinvar_conflicting_total: Number(conflicts?.esearchresult?.count ?? 0) } });
    if (!ids.length) continue;
    await sleep(350);
    const sum = await getJSON<Json>(`${BASE}/esummary.fcgi?db=clinvar&id=${ids.join(",")}&retmode=json${key()}`);
    const result = sum?.result ?? {};

    for (const id of ids) {
      const v = result[id]; if (!v) continue;
      const sig: string = v.germline_classification?.description ?? v.clinical_significance?.description ?? "";
      const consequences: string[] = v.molecular_consequence_list ?? [];
      await g.upsertEdge({
        from: { type: "gene", canonicalId: `SYMBOL:${symbol}`, name: symbol },
        to: {
          type: "variant", canonicalId: `CLINVAR:${id}`, name: v.title ?? `ClinVar ${id}`,
          props: { significance: sig, review_status: v.germline_classification?.review_status, consequences, variant_type: v.obj_type, conditions: (v.germline_classification?.trait_set ?? []).map((t: Json) => t.trait_name).slice(0, 5) },
        },
        relation: "has_variant",
        confidence: /^pathogenic/i.test(sig) ? 0.9 : 0.7, confidenceBasis: "clinvar_significance",
        evidence: [{ source: "clinvar", externalId: `VCV:${v.accession ?? id}`, url: `https://www.ncbi.nlm.nih.gov/clinvar/variation/${id}/`, publishedOn: toISO(v.germline_classification?.last_evaluated), quote: `${sig}${consequences.length ? ` · ${consequences.join(", ")}` : ""}` }],
      });
    }
    await sleep(350);
  }
  await g.markSynced("clinvar");
}

function toISO(s?: string) {
  if (!s) return undefined;
  const m = s.match(/(\d{4})\/(\d{2})\/(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s); return isNaN(+d) ? undefined : d.toISOString().slice(0, 10);
}
