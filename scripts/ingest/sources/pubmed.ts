/** PubMed E-utilities: artículos recientes por enfermedad y por gen. Respeta 3 req/s sin clave. */
import { Graph, getJSON, sleep } from "../graph";
import type { SeedDisease } from "../types";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const key = () => (process.env.NCBI_API_KEY ? `&api_key=${process.env.NCBI_API_KEY}` : "");

export async function ingestPubMed(g: Graph, d: SeedDisease, retmax = 25) {
  const disease = { type: "disease" as const, canonicalId: d.orpha, name: d.name };
  const term = encodeURIComponent(`("${d.search_terms[0]}"[Title/Abstract]) AND (review[pt] OR clinical trial[pt] OR "treatment"[Title/Abstract])`);
  const search = await getJSON<any>(`${BASE}/esearch.fcgi?db=pubmed&term=${term}&sort=date&retmax=${retmax}&retmode=json${key()}`).catch(() => null);
  const ids: string[] = search?.esearchresult?.idlist ?? [];
  if (!ids.length) return;
  await sleep(350);
  const sum = await getJSON<any>(`${BASE}/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json${key()}`).catch(() => null);
  const result = sum?.result ?? {};

  for (const pmid of ids) {
    const a = result[pmid]; if (!a) continue;
    const pubdate = toISO(a.sortpubdate ?? a.pubdate);
    await g.upsertEdge({
      from: {
        type: "study", canonicalId: `PMID:${pmid}`, name: a.title ?? `PMID ${pmid}`,
        props: { journal: a.fulljournalname ?? a.source, authors: (a.authors ?? []).slice(0, 5).map((x: any) => x.name), pubtype: a.pubtype, doi: (a.articleids ?? []).find((x: any) => x.idtype === "doi")?.value },
      },
      to: disease, relation: "studies",
      confidence: (a.pubtype ?? []).some((t: string) => /review|guideline|trial/i.test(t)) ? 0.7 : 0.5,
      confidenceBasis: "publication_type",
      evidence: [{ source: "pubmed", externalId: `PMID:${pmid}`, url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, publishedOn: pubdate, quote: a.title }],
    });
  }
  await g.markSynced("pubmed");
}

function toISO(s?: string) {
  if (!s) return undefined;
  const m = s.match(/(\d{4})[\/-](\d{2})[\/-](\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const y = s.match(/\d{4}/); return y ? `${y[0]}-01-01` : undefined;
}
