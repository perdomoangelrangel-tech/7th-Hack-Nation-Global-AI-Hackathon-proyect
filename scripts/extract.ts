/**
 * Extracción con OpenAI ("Built with OpenAI · Extract"): lee abstracts de PubMed ya citados en el grafo y
 * extrae ACTIVOS reutilizables (modelos animales/celulares, biomarcadores, medidas de resultado, registros)
 * y afirmaciones de MECANISMO (efecto de variante). Regla de integridad:
 *   cada extracción trae una cita literal y se verifica de forma determinista que la cita aparece en el
 *   abstract. Si no aparece, se descarta. Las aristas resultantes son kind="extracted", nunca "observed".
 *
 *   npm run extract            (requiere OPENAI_API_KEY; luego `npm run analyze`)
 *   npm run extract -- --per-disease=8
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true }); // misma clave que usa Next (.env.local)
import OpenAI from "openai";
import { FileGraph, sleep } from "./ingest/graph";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "true"]; }));
const PER_DISEASE = Number(args["per-disease"] ?? 6);

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["assets", "mechanisms"],
  properties: {
    assets: { type: "array", items: { type: "object", additionalProperties: false, required: ["kind", "name", "quote"], properties: {
      kind: { type: "string", enum: ["animal_model", "cell_model", "biomarker", "outcome_measure", "registry", "natural_history", "gene_therapy_construct", "other_tool"] },
      name: { type: "string", description: "Short name of the asset, e.g. 'Stxbp1 haploinsufficient mouse'" },
      quote: { type: "string", description: "EXACT substring copied from the abstract that supports it" },
    } } },
    mechanisms: { type: "array", items: { type: "object", additionalProperties: false, required: ["gene", "effect", "quote"], properties: {
      gene: { type: "string" },
      effect: { type: "string", enum: ["loss_of_function", "haploinsufficiency", "gain_of_function", "dominant_negative", "other"] },
      quote: { type: "string", description: "EXACT substring copied from the abstract" },
    } } },
  },
};

const SYSTEM = `You extract facts from ONE biomedical abstract for a rare-disease knowledge graph.
Only extract what the abstract states explicitly. Every item must include a quote that is an EXACT, verbatim substring of the abstract (copy it character by character, 8-40 words).
Assets = reusable research resources (animal or cell models, biomarkers, outcome measures, registries, natural history cohorts, therapy constructs).
Mechanisms = the stated functional effect of disease variants in a gene. If the abstract does not state it, return empty arrays.`;

const norm = (s: string) => s.replace(/\s+/g, " ").replace(/[‐-―]/g, "-").trim().toLowerCase();

async function abstracts(pmids: string[]) {
  const key = process.env.NCBI_API_KEY ? `&api_key=${process.env.NCBI_API_KEY}` : "";
  const xml = await fetch(`${BASE}/efetch.fcgi?db=pubmed&id=${pmids.join(",")}&retmode=xml${key}`).then((r) => r.text());
  const out = new Map<string, string>();
  for (const art of xml.split("<PubmedArticle>").slice(1)) {
    const pmid = art.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1];
    const text = [...art.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map((m) => m[1].replace(/<[^>]+>/g, "")).join(" ");
    if (pmid && text) out.set(pmid, decode(text));
  }
  return out;
}
const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&apos;/g, "'");

async function main() {
  if (!process.env.OPENAI_API_KEY) { console.error("Falta OPENAI_API_KEY en .env.local / .env"); process.exit(1); }
  const client = new OpenAI();
  const g = new FileGraph("data/atlas.json");
  g.dropEdges((e) => e.kind === "extracted"); // idempotente: se recalcula todo
  const diseases = g.allEntities().filter((e) => e.type === "disease");
  let kept = 0, dropped = 0;
  for (const d of diseases) {
    const papers = g.allEdges().filter((e) => e.relation === "studies" && e.to === d.id && e.from.startsWith("study:PMID:"))
      .sort((a, b) => b.confidence - a.confidence).slice(0, PER_DISEASE);
    const pmids = papers.map((e) => e.from.replace("study:PMID:", ""));
    if (!pmids.length) continue;
    const abs = await abstracts(pmids); await sleep(400);
    console.log(`▶ ${d.name}: ${abs.size} abstracts`);
    for (const [pmid, text] of abs) {
      const r = await client.responses.create({
        model: MODEL, instructions: SYSTEM, input: text,
        ...(/^(gpt-5|gpt-6|o\d)/.test(MODEL) ? { reasoning: { effort: "low" as const } } : {}),
        text: { format: { type: "json_schema", name: "extraction", schema: SCHEMA, strict: true } },
      }).catch((e) => { console.warn(`  ✗ PMID ${pmid}: ${(e as Error).message}`); return null; });
      if (!r) continue;
      const x = JSON.parse(r.output_text) as { assets: { kind: string; name: string; quote: string }[]; mechanisms: { gene: string; effect: string; quote: string }[] };
      const ev = (quote: string) => [{ source: "pubmed" as const, externalId: `PMID:${pmid}`, url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, quote }];
      for (const a of x.assets) {
        if (!norm(text).includes(norm(a.quote))) { dropped++; continue; } // la cita no está en el abstract: fuera
        await g.upsertEdge({
          from: { type: "trial", canonicalId: `ASSET:${pmid}:${a.kind}:${a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`, name: a.name, props: { asset_kind: a.kind, status: "PUBLISHED", source_pmid: `PMID:${pmid}`, extracted_by: MODEL } },
          to: { type: "disease", canonicalId: d.canonical_id, name: d.name },
          relation: "studies", kind: "extracted", confidence: 0.45, confidenceBasis: "llm_extraction_quote_verified",
          props: { asset_kind: a.kind, extracted_by: MODEL }, evidence: ev(a.quote),
        });
        kept++;
      }
      for (const m of x.mechanisms) {
        if (!norm(text).includes(norm(m.quote))) { dropped++; continue; }
        const gene = g.allEntities().find((e) => e.type === "gene" && e.name.toUpperCase() === m.gene.toUpperCase());
        if (!gene) { dropped++; continue; }
        await g.upsertEdge({
          from: { type: "gene", canonicalId: gene.canonical_id, name: gene.name },
          to: { type: "disease", canonicalId: d.canonical_id, name: d.name },
          relation: "causes", kind: "extracted", confidence: 0.5, confidenceBasis: "llm_extraction_quote_verified",
          props: { extracted_effect: m.effect, extracted_by: MODEL }, evidence: ev(m.quote),
        });
        kept++;
      }
    }
  }
  await g.markSynced("openai_extraction");
  await g.save();
  console.log(`\n✔ ${kept} extracciones con cita verificada · ${dropped} descartadas (cita no encontrada en el abstract o gen desconocido)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
