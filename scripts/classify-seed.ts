/**
 * Orphanet classification groups for each seed disease (e.g. Fabry → "Sphingolipidosis" → "Lysosomal disease"),
 * with each group's preferred term, Orphanet synonyms and — when Monarch maps that exact Orphanet group to MONDO —
 * the MONDO name and synonyms (ORPHA:68366 "Lysosomal disease" = MONDO:0002561 "lysosomal storage disease"). These are the words people search with
 * ("lysosomal storage disease", "genetic epilepsy"), so they become search aliases of the disease and of the
 * computed clusters. Source: Orphadata rd-classification + rd-cross-referencing — never hand-written.
 *
 *   npx tsx scripts/classify-seed.ts   -> supabase/seed/groups.json
 */
import { readFileSync, writeFileSync } from "node:fs";

interface Group { orpha: string; name: string; synonyms: string[]; depth: number; hierarchy: string; mondo?: string }
const MAX_DEPTH = 2; // direct parent and grandparent: higher levels are too generic ("Rare neurologic disease")
// Top-level / organ-wide groups that would match almost every disease and only add noise to search.
const TOO_GENERIC = /^rare (genetic|neurologic|inborn error|metabolic|developmental|cardiac|renal|eye|bone|skin|hepatic|systemic|gastroenterologic|hematologic|immune|respiratory|endocrine|odontologic|otorhinolaryngologic|gynecologic|urogenital|infertility|surgical|teratologic|circulatory|abdominal|allergic|tumor)|^(inborn errors of metabolism|disease|clinical group)$/i;

const UA = { "user-agent": "nedamex-classify-seed/1.0", accept: "application/json" };
// deno-lint-ignore no-explicit-any
type Any = any;
async function orpha(path: string): Promise<Any> {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`https://api.orphadata.com/${path}?lang=en`, { headers: UA, signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (r?.ok) return (await r.json())?.data?.results ?? null;
    if (r?.status === 404) return null;
    await new Promise((res) => setTimeout(res, 800 * (i + 1)));
  }
  return null;
}
const arr = <T>(x: T | T[] | null | undefined): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);
const card = new Map<number, { name: string; synonyms: string[] } | null>();
async function cardOf(code: number) {
  if (!card.has(code)) {
    const x = await orpha(`rd-cross-referencing/orphacodes/${code}`);
    card.set(code, x ? { name: x["Preferred term"], synonyms: arr(x.Synonym).map((s: Any) => (typeof s === "string" ? s : s?.label)).filter(Boolean) } : null);
  }
  return card.get(code)!;
}

/** MONDO term mapped to this exact Orphanet group (Monarch record must cross-reference Orphanet:<code>). */
const mondoCache = new Map<number, { id: string; name: string; synonyms: string[] } | null>();
async function mondoOf(code: number) {
  if (!mondoCache.has(code)) {
    const r = await fetch(`https://api-v3.monarchinitiative.org/v3/api/search?q=Orphanet:${code}&limit=3`, { headers: UA, signal: AbortSignal.timeout(20_000) })
      .then((x) => (x.ok ? x.json() : null)).catch(() => null);
    const hit = arr(r?.items).find((i: Any) => String(i?.id).startsWith("MONDO:") && arr(i?.xref).includes(`Orphanet:${code}`) && !/^obsolete/i.test(String(i?.name)));
    mondoCache.set(code, hit ? { id: hit.id, name: hit.name, synonyms: arr(hit.synonym).slice(0, 8) } : null);
  }
  return mondoCache.get(code)!;
}

async function groupsFor(code: number): Promise<Group[]> {
  const out = new Map<number, Group>();
  const trees: Any[] = arr(await orpha(`rd-classification/orphacodes/${code}/hchids`));
  for (const t of trees) {
    let frontier: number[] = arr(t.parents).map(Number);
    for (let depth = 1; depth <= MAX_DEPTH && frontier.length; depth++) {
      const next: number[] = [];
      for (const p of frontier) {
        const c = await cardOf(p);
        if (c && !TOO_GENERIC.test(c.name) && !out.has(p)) {
          const m = await mondoOf(p);
          const synonyms = [...new Set([...c.synonyms.slice(0, 6), ...(m ? [m.name, ...m.synonyms] : [])])]
            .filter((x) => x && x.toLowerCase() !== c.name.toLowerCase()).slice(0, 12);
          out.set(p, { orpha: `ORPHA:${p}`, name: c.name, synonyms, depth, hierarchy: String(t.hch_tag ?? ""), ...(m ? { mondo: m.id } : {}) });
        }
        const up = arr((await orpha(`rd-classification/orphacodes/${p}/hchids/${t.hch_id}`))?.parents).map(Number);
        next.push(...up);
      }
      frontier = [...new Set(next)];
    }
  }
  return [...out.values()].sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));
}

async function main() {
  const diseases = JSON.parse(readFileSync("supabase/seed/diseases.json", "utf8")) as { orpha: string; slug: string }[];
  const result: Record<string, Group[]> = {};
  for (const d of diseases) {
    result[d.orpha] = await groupsFor(Number(d.orpha.replace("ORPHA:", "")));
    console.log(`${d.slug.padEnd(12)} ${result[d.orpha].map((g) => g.name).join(" | ")}`);
  }
  writeFileSync("supabase/seed/groups.json", JSON.stringify(result, null, 2) + "\n");
  console.log(`✔ supabase/seed/groups.json (${Object.values(result).flat().length} disease→group links, ${card.size} groups read)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
