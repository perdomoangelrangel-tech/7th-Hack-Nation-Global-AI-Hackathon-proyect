// PubMed E-utilities: recent reviews / trials / treatment papers per disease (last 5 years).
// esearch -> esummary (metadata) -> efetch XML (authors + affiliations + ORCID).
// First and last authors are stored on the study entity; the `community` step turns them into
// research_community rows. No API key => <= 3 req/s, so calls are spaced.
import type { Ctx, EntityRef, SeedDisease } from "../types.ts";
import { getJSON, getText, isoDate, sleep, trunc } from "../http.ts";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const TOOL = "&tool=nedamex_atlas";
const key = () => (Deno.env.get("NCBI_API_KEY") ? `&api_key=${Deno.env.get("NCBI_API_KEY")}` : "");
// deno-lint-ignore no-explicit-any
type Any = any;

export interface Author { name: string; affiliation?: string; orcid?: string; country?: string }

export async function pubmed(ctx: Ctx, d: SeedDisease, retmax = 30) {
  const terms = d.search_terms.map((t) => `"${t}"[Title/Abstract]`).join(" OR ");
  const term = `(${terms}) AND (review[pt] OR clinical trial[pt] OR treatment[Title/Abstract] OR therapy[Title/Abstract]) AND english[la]`;
  const search = await getJSON<Any>(
    `${BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(term)}&sort=pub_date&datetype=pdat&reldate=1825&retmax=${retmax}&retmode=json${TOOL}${key()}`,
  );
  const ids: string[] = search?.esearchresult?.idlist ?? [];
  ctx.sample("pubmed.esearch", search?.esearchresult);
  if (!ids.length) { ctx.note("pubmed: 0 results"); return; }
  await sleep(400);
  const sum = await getJSON<Any>(`${BASE}/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json${TOOL}${key()}`);
  const result = sum?.result ?? {};
  ctx.sample("pubmed.esummary", result[ids[0]]);
  await sleep(400);
  const xml = await getText(`${BASE}/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml${TOOL}${key()}`).catch((e) => { ctx.note(`pubmed efetch: ${e?.message ?? e}`); return ""; });
  const authorsByPmid = parseAuthors(xml);
  ctx.sample("pubmed.efetch_authors", Object.fromEntries([...authorsByPmid].slice(0, 2)));

  const diseaseRef: EntityRef = { type: "disease", canonicalId: d.orpha, name: d.name };
  for (const pmid of ids) {
    const a = result[pmid]; if (!a || a.error) continue;
    const pubdate = isoDate(a.sortpubdate ?? a.pubdate);
    const authors = authorsByPmid.get(pmid) ?? [];
    const pubtype: string[] = a.pubtype ?? [];
    ctx.batch.edge({
      from: {
        type: "study", canonicalId: `PMID:${pmid}`, name: a.title ?? `PMID ${pmid}`,
        props: {
          pmid, journal: a.fulljournalname ?? a.source, pub_date: pubdate,
          authors: (a.authors ?? []).slice(0, 6).map((x: Any) => x.name),
          pubtype, doi: (a.articleids ?? []).find((x: Any) => x.idtype === "doi")?.value,
          first_author: authors[0], last_author: authors.length > 1 ? authors[authors.length - 1] : undefined,
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        },
      },
      to: diseaseRef, relation: "studies",
      confidence: pubtype.some((t) => /guideline|meta-analysis|randomized/i.test(t)) ? 0.8 : pubtype.some((t) => /review|trial/i.test(t)) ? 0.7 : 0.5,
      confidenceBasis: "publication_type",
      props: { pubtype },
      evidence: [{ source: "pubmed", externalId: `PMID:${pmid}`, url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, publishedOn: pubdate, quote: trunc(a.title, 300) }],
    });
  }
  ctx.extra.papers = ids.length;
}

const decode = (s: string) =>
  s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, " ").trim();
const tag = (s: string, t: string) => { const m = s.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`)); return m ? decode(m[1]) : undefined; };

/** PMID -> ordered authors with first affiliation and ORCID (regex over PubMed XML; no DOM in Deno edge). */
export function parseAuthors(xml: string): Map<string, Author[]> {
  const out = new Map<string, Author[]>();
  for (const art of xml.split("</PubmedArticle>")) {
    const pmid = art.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1];
    if (!pmid) continue;
    const list = art.match(/<AuthorList[^>]*>([\s\S]*?)<\/AuthorList>/)?.[1] ?? "";
    const authors: Author[] = [];
    for (const m of list.matchAll(/<Author\b[^>]*>([\s\S]*?)<\/Author>/g)) {
      const block = m[1];
      const last = tag(block, "LastName"); const fore = tag(block, "ForeName") ?? tag(block, "Initials");
      const collective = tag(block, "CollectiveName");
      const name = last ? `${fore ? fore + " " : ""}${last}` : collective;
      if (!name) continue;
      const aff = tag(block, "Affiliation");
      const orcidRaw = block.match(/<Identifier Source="ORCID">([^<]+)<\/Identifier>/)?.[1];
      const orcid = orcidRaw?.match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/)?.[0];
      authors.push({ name, affiliation: trunc(aff, 300), orcid, country: aff ? country(aff) : undefined });
    }
    out.set(pmid, authors);
  }
  return out;
}

/** Last comma-separated chunk of an affiliation when it looks like a country name ("..., Italy."). */
function country(aff: string): string | undefined {
  const clean = aff.replace(/\S+@\S+/g, "").replace(/electronic address:?/i, "").replace(/[.;\s]+$/, "");
  const last = clean.split(",").pop()?.trim().replace(/\d+/g, "").trim();
  if (!last || last.length < 2 || last.length > 30 || !/^[A-Za-z .'()-]+$/.test(last)) return undefined;
  return last;
}
