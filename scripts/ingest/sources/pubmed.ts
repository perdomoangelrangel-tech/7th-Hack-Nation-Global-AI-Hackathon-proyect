/**
 * PubMed E-utilities: artículos recientes por enfermedad + el autor senior (último autor) como investigador.
 * La identidad del investigador es por nombre (sin ORCID): confianza baja y así se muestra.
 * Respeta 3 req/s sin clave.
 */
import { type GraphWriter, getJSON, sleep } from "../graph";
import type { SeedDisease } from "../types";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const key = () => (process.env.NCBI_API_KEY ? `&api_key=${process.env.NCBI_API_KEY}` : "");

type Json = any;

export async function ingestPubMed(g: GraphWriter, d: SeedDisease, retmax = 30) {
  const disease = { type: "disease" as const, canonicalId: d.orpha, name: d.name };
  const name = d.search_terms[0];
  const term = encodeURIComponent(`("${name}"[Title/Abstract] OR ${d.genes.map((x) => `${x}[Title]`).join(" OR ")}) AND ("2019"[PDAT] : "3000"[PDAT])`);
  const search = await getJSON<Json>(`${BASE}/esearch.fcgi?db=pubmed&term=${term}&sort=relevance&retmax=${retmax}&retmode=json${key()}`);
  const ids: string[] = search?.esearchresult?.idlist ?? [];
  await g.upsertEntity({ ...disease, props: { pubmed_total_since_2019: Number(search?.esearchresult?.count ?? 0) } });
  if (!ids.length) return;
  await sleep(350);
  const sum = await getJSON<Json>(`${BASE}/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json${key()}`);
  const result = sum?.result ?? {};

  for (const pmid of ids) {
    const a = result[pmid]; if (!a) continue;
    const pubdate = toISO(a.sortpubdate ?? a.pubdate);
    const authors: string[] = (a.authors ?? []).filter((x: Json) => x.authtype === "Author").map((x: Json) => x.name);
    const pubtypes: string[] = a.pubtype ?? [];
    const paper = {
      type: "study" as const, canonicalId: `PMID:${pmid}`, name: a.title ?? `PMID ${pmid}`,
      props: { journal: a.fulljournalname ?? a.source, authors: authors.slice(0, 6), last_author: authors.at(-1), pubtype: pubtypes, doi: (a.articleids ?? []).find((x: Json) => x.idtype === "doi")?.value, year: pubdate?.slice(0, 4) },
    };
    const evidence = [{ source: "pubmed" as const, externalId: `PMID:${pmid}`, url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, publishedOn: pubdate, quote: a.title }];
    await g.upsertEdge({
      from: paper, to: disease, relation: "studies",
      confidence: pubtypes.some((t) => /review|guideline|trial/i.test(t)) ? 0.7 : 0.5,
      confidenceBasis: "publication_type", props: { asset_kind: /animal|mouse|model|ipsc|organoid/i.test(a.title ?? "") ? "model_publication" : "publication" },
      evidence,
    });
    const senior = authors.at(-1);
    if (senior && authors.length > 1) {
      await g.upsertEdge({
        from: { type: "investigator", canonicalId: `AUTHOR:${senior}`, name: senior, props: { identity: "name_only" } },
        to: disease, relation: "researches",
        confidence: 0.4, confidenceBasis: "senior_author_name_match",
        props: { role: "senior_author" },
        evidence,
      });
    }
  }
  await g.markSynced("pubmed");
}

function toISO(s?: string) {
  if (!s) return undefined;
  const m = s.match(/(\d{4})[/-](\d{2})[/-](\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const y = s.match(/\d{4}/); return y ? `${y[0]}-01-01` : undefined;
}
