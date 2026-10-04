/**
 * Resolve and VERIFY the disease slice ids against the authorities before they enter the seed — never guess an id.
 * For each candidate: Orphadata (preferred term, disease-causing gene + its HGNC id, MONDO cross-reference,
 * Spanish preferred term) and Open Targets (the MONDO id must exist as a disease). A candidate whose ORPHAcode
 * does not list the expected gene as disease-causing is rejected and reported.
 *
 *   npx tsx scripts/resolve-seed.ts            -> prints the report, writes supabase/seed/diseases.json (merged)
 *   npx tsx scripts/resolve-seed.ts --dry      -> report only
 */
import { readFileSync, writeFileSync } from "node:fs";

interface Candidate { slug: string; orpha: number; gene: string; cluster: string; extra_terms?: string[] }
interface SeedDisease { slug: string; orpha: string; mondo: string; efo: string; name: string; name_es: string; genes: string[]; hgnc: Record<string, string>; search_terms: string[]; trial_keywords: string[]; opentargets_indexed?: boolean; verified?: string }

// Candidate ORPHAcodes to verify (grouped by expected mechanism). Rejected ones are reported, not written.
const CANDIDATES: Candidate[] = [
  // channelopathies / DEE
  { slug: "dravet", orpha: 33069, gene: "SCN1A", cluster: "channel" },
  { slug: "kcnq2-dee", orpha: 439218, gene: "KCNQ2", cluster: "channel" },
  // SCN2A / SCN8A DEE: Orphanet maps OMIM 613721 / 614558 only to broader groups ("Moved to" / "Referred to"), so there is
  // no gene-specific ORPHAcode to verify — left out rather than guessed.
  { slug: "kcnt1-emfs", orpha: 293181, gene: "KCNT1", cluster: "channel", extra_terms: ["migrating focal seizures"] },
  // synaptic
  { slug: "stxbp1-dee", orpha: 599373, gene: "STXBP1", cluster: "synaptic" },
  { slug: "syngap1-dee", orpha: 544254, gene: "SYNGAP1", cluster: "synaptic" },
  // transcription / chromatin
  { slug: "rett", orpha: 778, gene: "MECP2", cluster: "chromatin" },
  { slug: "foxg1", orpha: 561854, gene: "FOXG1", cluster: "chromatin" },
  { slug: "angelman", orpha: 72, gene: "UBE3A", cluster: "chromatin" },
  { slug: "cdkl5", orpha: 505652, gene: "CDKL5", cluster: "chromatin" },
  // lysosomal / NCL
  { slug: "cln2", orpha: 228349, gene: "TPP1", cluster: "lysosomal" },
  { slug: "cln3", orpha: 228346, gene: "CLN3", cluster: "lysosomal" },
  { slug: "cln8", orpha: 228354, gene: "CLN8", cluster: "lysosomal" },
  { slug: "pompe", orpha: 365, gene: "GAA", cluster: "lysosomal", extra_terms: ["Pompe disease"] },
  { slug: "fabry", orpha: 324, gene: "GLA", cluster: "lysosomal" },
  { slug: "gaucher", orpha: 355, gene: "GBA1", cluster: "lysosomal" },
  { slug: "npc", orpha: 646, gene: "NPC1", cluster: "lysosomal" },
  { slug: "mps1", orpha: 579, gene: "IDUA", cluster: "lysosomal", extra_terms: ["MPS I", "Hurler"] },
  { slug: "krabbe", orpha: 487, gene: "GALC", cluster: "lysosomal" },
  { slug: "mld", orpha: 512, gene: "ARSA", cluster: "lysosomal" },
  // neuromuscular
  { slug: "sma", orpha: 70, gene: "SMN1", cluster: "neuromuscular", extra_terms: ["spinal muscular atrophy"] },
  { slug: "duchenne", orpha: 98896, gene: "DMD", cluster: "neuromuscular" },
];

// deno-lint-ignore no-explicit-any
type Any = any;
const UA = { "user-agent": "nexmed-resolve-seed/1.0 (+https://github.com/perdomoangelrangel-tech/7th-Hack-Nation-Global-AI-Hackathon-proyect)", accept: "application/json" };
async function getJSON(url: string): Promise<Any> {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (r?.ok) return r.json();
    if (r && r.status === 404) return null;
    await new Promise((res) => setTimeout(res, 800 * (i + 1)));
  }
  return null;
}
const orpha = (path: string, lang = "en") => getJSON(`https://api.orphadata.com/${path}?lang=${lang}`).then((j) => j?.data?.results ?? null);
const arr = <T>(x: T | T[] | null | undefined): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);

async function openTargetsHas(efo: string): Promise<string | null> {
  const r = await fetch("https://api.platform.opentargets.org/api/v4/graphql", {
    method: "POST", headers: { ...UA, "content-type": "application/json" }, signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({ query: "query($id:String!){disease(efoId:$id){id name}}", variables: { id: efo } }),
  }).then((x) => x.json()).catch(() => null);
  return r?.data?.disease?.name ?? null;
}

async function monarchMondo(code: number): Promise<string | null> {
  const r = await getJSON(`https://api-v3.monarchinitiative.org/v3/api/search?q=Orphanet:${code}&limit=3`);
  const hit = arr(r?.items).find((x: Any) => x?.category === "biolink:Disease" && String(x?.id).startsWith("MONDO:"));
  return hit?.id ?? null;
}
async function monarchCausalGene(mondo: string, gene: string): Promise<string | null> {
  const r = await getJSON(`https://api-v3.monarchinitiative.org/v3/api/association?object=${encodeURIComponent(mondo)}&category=biolink:CausalGeneToDiseaseAssociation&limit=20`);
  const hit = arr(r?.items).find((x: Any) => x?.subject_label === gene && String(x?.subject).startsWith("HGNC:"));
  return hit?.subject ?? null;
}
async function hgncOf(symbol: string): Promise<string | null> {
  const r = await getJSON(`https://rest.genenames.org/fetch/symbol/${encodeURIComponent(symbol)}`);
  return r?.response?.docs?.[0]?.hgnc_id ?? null;
}

async function resolve(c: Candidate): Promise<{ ok: true; seed: SeedDisease } | { ok: false; slug: string; why: string }> {
  const code = c.orpha;
  const [genes, xref, xrefEs] = await Promise.all([orpha(`rd-associated-genes/orphacodes/${code}`), orpha(`rd-cross-referencing/orphacodes/${code}`), orpha(`rd-cross-referencing/orphacodes/${code}`, "es")]);
  if (!xref) return { ok: false, slug: c.slug, why: `ORPHA:${code} not found in Orphadata` };
  const name: string = xref["Preferred term"];

  // MONDO: Monarch's Orphanet mapping first, then Orphanet's own MONDO xrefs; it must exist in Open Targets.
  const xrefMondos = arr(xref.ExternalReference).filter((r: Any) => r?.Source === "MONDO").map((r: Any) => `MONDO:${String(r.Reference).padStart(7, "0")}`);
  const mm = await monarchMondo(code);
  let mondo = "", otName: string | null = null;
  for (const m of [...new Set([...(mm ? [mm] : []), ...xrefMondos])]) { otName = await openTargetsHas(m.replace(":", "_")); if (otName) { mondo = m; break; } }
  // Verified by Monarch but not indexed by Open Targets: keep it, flag it (the Open Targets step will find nothing).
  if (!mondo && mm && xrefMondos.includes(mm)) mondo = mm;
  if (!mondo) return { ok: false, slug: c.slug, why: `ORPHA:${code} (${name}): no verified MONDO (Monarch ${mm}, Orphanet ${JSON.stringify(xrefMondos)})` };

  // Gene: disease-causing in Orphadata, else causal in Monarch (OMIM / ClinGen); HGNC id cross-checked with genenames.org.
  const hgncRest = await hgncOf(c.gene);
  const assoc = arr(genes?.DisorderGeneAssociation).find((a: Any) => a?.Gene?.Symbol === c.gene);
  let hgnc: string | null = null, basis = "";
  if (assoc && /disease-causing/i.test(assoc.DisorderGeneAssociationType ?? "")) {
    const n = arr(assoc.Gene?.ExternalReference).find((r: Any) => r?.Source === "HGNC")?.Reference;
    hgnc = n ? `HGNC:${n}` : null; basis = `Orphadata: "${assoc.DisorderGeneAssociationType}"`;
  } else if (assoc) {
    return { ok: false, slug: c.slug, why: `ORPHA:${code} lists ${c.gene} only as "${assoc.DisorderGeneAssociationType}"` };
  } else {
    hgnc = await monarchCausalGene(mondo, c.gene); basis = `Monarch causal gene for ${mondo} (Orphadata lists no gene for this ORPHAcode)`;
  }
  if (!hgnc) return { ok: false, slug: c.slug, why: `ORPHA:${code} (${name}): ${c.gene} not causal in Orphadata nor Monarch (${mondo})` };
  if (hgncRest && hgncRest !== hgnc) return { ok: false, slug: c.slug, why: `HGNC mismatch for ${c.gene}: ${hgnc} vs genenames ${hgncRest}` };

  const synonyms: string[] = arr(xref.Synonym).map((s: Any) => (typeof s === "string" ? s : s?.label)).filter(Boolean);
  const nameEs: string = xrefEs?.["Preferred term"] ?? name;
  const terms = [...new Set([name, ...synonyms, ...(c.extra_terms ?? [])])].slice(0, 5);
  const keywords = [...new Set([c.gene.toLowerCase(), ...terms.map((t) => t.toLowerCase()).filter((t) => t.length <= 60)])].slice(0, 5);
  return {
    ok: true,
    seed: {
      slug: c.slug, orpha: `ORPHA:${code}`, mondo, efo: mondo.replace(":", "_"), name, name_es: nameEs,
      genes: [c.gene], hgnc: { [c.gene]: hgnc }, search_terms: terms, trial_keywords: keywords,
      ...(otName ? {} : { opentargets_indexed: false }),
      verified: `ORPHA:${code} preferred term from Orphadata; ${c.gene} ${hgnc} via ${basis}, HGNC cross-checked with genenames.org; ${mondo} via ${mm === mondo ? "Monarch Orphanet mapping" : "Orphanet MONDO xref"}, ${otName ? `Open Targets name "${otName}"` : "not indexed by Open Targets"}; checked ${new Date().toISOString().slice(0, 10)}`,
    },
  };
}

// Display labels for the graph and the voice (not identifiers). English + Spanish.
const SHORT: Record<string, [string, string]> = {
  "kcnt1-emfs": ["KCNT1 epilepsy (EIMFS)", "Epilepsia KCNT1 (EIMFS)"], "syngap1-dee": ["SYNGAP1-DEE", "SYNGAP1-DEE"],
  cln8: ["CLN8 disease", "Enfermedad CLN8"], pompe: ["Pompe disease", "Enfermedad de Pompe"], fabry: ["Fabry disease", "Enfermedad de Fabry"],
  gaucher: ["Gaucher disease", "Enfermedad de Gaucher"], npc: ["Niemann-Pick C", "Niemann-Pick C"], mps1: ["MPS I", "MPS I"],
  krabbe: ["Krabbe disease", "Enfermedad de Krabbe"], mld: ["Metachromatic leukodystrophy", "Leucodistrofia metacromática"],
  sma: ["Spinal muscular atrophy", "Atrofia muscular espinal"], duchenne: ["Duchenne muscular dystrophy", "Distrofia muscular de Duchenne"],
};

/** OMIM (exact Orphanet mapping) + the ClinVar trait name (MedGen "Disease or Syndrome" title for that MIM). */
async function enrich(d: SeedDisease & { omim?: string; clinvar_disease?: string; short_name?: string; short_name_es?: string }) {
  if (!d.omim) {
    const xref = await orpha(`rd-cross-referencing/orphacodes/${d.orpha.replace("ORPHA:", "")}`);
    const exact = arr(xref?.ExternalReference).filter((r: Any) => r?.Source === "OMIM" && String(r?.DisorderMappingRelation ?? "").startsWith("E (Exact"));
    if (exact.length) d.omim = `OMIM:${exact[0].Reference}`;
  }
  if (d.omim && !d.clinvar_disease) {
    const mim = d.omim.replace("OMIM:", "");
    const ids = (await getJSON(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=medgen&term=${mim}%5Bmim%5D&retmode=json`))?.esearchresult?.idlist ?? [];
    if (ids.length) {
      const sum = (await getJSON(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=medgen&id=${ids.join(",")}&retmode=json`))?.result ?? {};
      // Oldest "Disease or Syndrome" concept for the MIM (lowest uid) = the main OMIM entry ClinVar uses as trait name.
      const hit = [...ids].sort((x: string, y: string) => Number(x) - Number(y)).map((i: string) => sum[i])
        .find((x: Any) => /disease or syndrome/i.test(String(x?.semantictype?.value ?? x?.semantictype ?? "")));
      if (hit?.title) d.clinvar_disease = hit.title;
    }
  }
  if (!d.short_name && SHORT[d.slug]) [d.short_name, d.short_name_es] = SHORT[d.slug];
}

async function main() {
  const dry = process.argv.includes("--dry");
  const results = [];
  for (const c of CANDIDATES) { const r = await resolve(c); results.push(r); console.log(r.ok ? `✓ ${r.seed.orpha.padEnd(13)} ${r.seed.mondo} ${r.seed.hgnc[c.gene].padEnd(11)} ${r.seed.name}` : `✗ ${r.slug}: ${r.why}`); }
  const ok = results.filter((r): r is { ok: true; seed: SeedDisease } => r.ok).map((r) => r.seed);
  console.log(`\n${ok.length}/${CANDIDATES.length} verified`);
  if (dry) return;
  // Keep existing hand-curated entries (their ids were verified when they were added); add the newly verified ones.
  const path = "supabase/seed/diseases.json";
  const existing = JSON.parse(readFileSync(path, "utf8")) as SeedDisease[];
  const byOrpha = new Map(existing.map((d) => [d.orpha, d]));
  for (const s of ok) if (!byOrpha.has(s.orpha)) byOrpha.set(s.orpha, s);
  for (const d of byOrpha.values()) await enrich(d);
  writeFileSync(path, JSON.stringify([...byOrpha.values()], null, 2) + "\n");
  console.log(`✔ ${path}: ${byOrpha.size} diseases`);
}

main().catch((e) => { console.error(e); process.exit(1); });
