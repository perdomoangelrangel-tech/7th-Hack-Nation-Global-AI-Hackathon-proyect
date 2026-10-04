// Reactome pathways (via Open Targets) for each seed gene: the MECHANISM layer that lets Nedamex group diseases
// by biology instead of by name. gene -[participates_in]-> pathway, evidence = the Reactome pathway page.
// Requires migration 0011 (entity type `pathway`, relation `participates_in`, source `reactome`).
import type { Ctx, SeedDisease } from "../types.ts";
import { getJSON, sleep } from "../http.ts";

const ENDPOINT = "https://api.platform.opentargets.org/api/v4/graphql";
const SEARCH = `query s($q: String!) { search(queryString: $q, entityNames: ["target"], page: { index: 0, size: 3 }) { hits { id name } } }`;
const PATHWAYS = `query p($id: String!) { target(ensemblId: $id) { id approvedSymbol approvedName pathways { pathway pathwayId topLevelTerm } } }`;
const MAX_PATHWAYS = 40;

// deno-lint-ignore no-explicit-any
type Any = any;
const gql = (query: string, variables: Record<string, unknown>) =>
  getJSON<Any>(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, variables }) });

export async function reactome(ctx: Ctx, d: SeedDisease) {
  for (const symbol of d.genes) {
    const hgnc = d.hgnc?.[symbol];
    if (!hgnc) { ctx.note(`reactome: no HGNC id for ${symbol} in the seed`); continue; }
    const s = await gql(SEARCH, { q: symbol });
    const hit = (s?.data?.search?.hits ?? []).find((h: Any) => String(h?.name).toUpperCase() === symbol.toUpperCase());
    if (!hit) { ctx.note(`reactome: Open Targets has no target ${symbol}`); continue; }
    const t = (await gql(PATHWAYS, { id: hit.id }))?.data?.target;
    ctx.sample(`reactome.${symbol}`, t);
    if (!t) continue;
    const gene = { type: "gene" as const, canonicalId: hgnc, name: symbol, props: { symbol, ensembl: t.id, full_name: t.approvedName } };
    ctx.batch.entity(gene);
    for (const p of (t.pathways ?? []).slice(0, MAX_PATHWAYS)) {
      if (!p?.pathwayId) continue;
      ctx.batch.edge({
        from: gene,
        to: { type: "pathway", canonicalId: `REACT:${p.pathwayId}`, name: p.pathway, props: { top_level: p.topLevelTerm, reactome_id: p.pathwayId } },
        relation: "participates_in", confidence: 0.9, confidenceBasis: "reactome_curated",
        evidence: [{ source: "reactome", externalId: p.pathwayId, url: `https://reactome.org/content/detail/${p.pathwayId}`, quote: `${symbol} participates in ${p.pathway}` }],
      });
    }
    await sleep(150);
  }
}
