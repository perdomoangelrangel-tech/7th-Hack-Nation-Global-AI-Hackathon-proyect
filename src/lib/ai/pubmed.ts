/**
 * PubMed title + abstract via NCBI E-utilities (server side, no key needed at our volume).
 * https://www.ncbi.nlm.nih.gov/books/NBK25499/ — efetch, db=pubmed, retmode=xml.
 */
export interface Paper { pmid: string; title: string; abstract: string; url: string }

export const normalizePmid = (s: string) => {
  const m = s.trim().match(/^(?:PMID:?\s*)?(\d{1,9})$/i);
  return m ? m[1] : null;
};

const decode = (s: string) => s
  .replace(/<[^>]+>/g, "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** Parses efetch XML. Structured abstracts keep their section labels ("BACKGROUND: …"). */
export function parsePubmedXml(xml: string, pmid: string): Paper | null {
  const title = decode(xml.match(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/)?.[1] ?? "");
  const parts = [...xml.matchAll(/<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/g)].map((m) => {
    const label = m[1].match(/Label="([^"]+)"/)?.[1];
    return `${label ? `${label}: ` : ""}${decode(m[2])}`;
  });
  if (!title && !parts.length) return null;
  return { pmid, title, abstract: parts.join("\n"), url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` };
}

export type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export async function fetchPaper(pmidRaw: string, fetcher: FetchLike = fetch): Promise<Paper | null> {
  const pmid = normalizePmid(pmidRaw);
  if (!pmid) return null;
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml&tool=nexmed`;
  const r = await fetcher(url, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`pubmed ${r.status}`);
  return parsePubmedXml(await r.text(), pmid);
}
