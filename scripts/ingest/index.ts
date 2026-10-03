/**
 * Ingesta completa. Uso:
 *   npm run ingest                         -> todas las fuentes, todas las enfermedades del seed -> data/atlas.json
 *   npm run ingest -- --only=orphanet      -> una fuente (orphanet|ctgov|pubmed|clinvar|opentargets|reporter|pathways|hpo|orgs)
 *   npm run ingest -- --orpha=ORPHA:33069  -> una enfermedad
 *   npm run ingest -- --target=supabase    -> escribe en Supabase en vez del snapshot local
 *   npm run ingest -- --fresh              -> reconstruye el snapshot desde cero
 * Después: `npm run analyze` calcula clusters, similitud, puentes y huecos.
 * Para escalar: sustituir supabase/seed/diseases.json por la salida de Orphadata rd-classification.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true }); // misma clave que usa Next (.env.local)
import { readFileSync } from "node:fs";
import { FileGraph, SupabaseGraph, type GraphWriter } from "./graph";
import type { SeedDisease, SeedOrganization } from "./types";
import { ingestOrphanet } from "./sources/orphanet";
import { ingestClinicalTrials } from "./sources/clinicaltrials";
import { ingestPubMed } from "./sources/pubmed";
import { ingestClinVar } from "./sources/clinvar";
import { ingestOpenTargetsDrugs, ingestPathways } from "./sources/opentargets";
import { ingestReporter } from "./sources/reporter";
import { ingestHPO } from "./sources/hpo";
import { ingestOrganizations } from "./sources/organizations";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "true"]; }));
const diseases: SeedDisease[] = JSON.parse(readFileSync("supabase/seed/diseases.json", "utf8"));
const orgs: SeedOrganization[] = JSON.parse(readFileSync("supabase/seed/organizations.json", "utf8"));
const selected = args.orpha ? diseases.filter((d) => d.orpha === args.orpha) : diseases;
const only = args.only as string | undefined;
const run = (name: string) => !only || only === name;
const failures: string[] = [];

async function main() {
  const g: GraphWriter = args.target === "supabase" ? new SupabaseGraph() : new FileGraph("data/atlas.json", args.fresh === "true");
  const t0 = Date.now();
  for (const d of selected) {
    console.log(`\n▶ ${d.name} (${d.orpha})`);
    if (run("orphanet"))    await step(`orphanet ${d.orpha}`,    () => ingestOrphanet(g, d));
    if (run("ctgov"))       await step(`ctgov ${d.orpha}`,       () => ingestClinicalTrials(g, d));
    if (run("pubmed"))      await step(`pubmed ${d.orpha}`,      () => ingestPubMed(g, d));
    if (run("clinvar"))     await step(`clinvar ${d.orpha}`,     () => ingestClinVar(g, d));
    if (run("opentargets")) await step(`opentargets ${d.orpha}`, () => ingestOpenTargetsDrugs(g, d));
    if (run("reporter"))    await step(`reporter ${d.orpha}`,    () => ingestReporter(g, d));
  }
  if (run("pathways")) {
    // Vías para los genes con asociación causal (Orphanet), no para los "candidate".
    const causal = g instanceof FileGraph
      ? [...new Set(g.allEdges().filter((e) => e.relation === "causes" && e.confidence >= 0.9).map((e) => e.from.replace("gene:SYMBOL:", "")))]
      : [...new Set(selected.flatMap((d) => d.genes))];
    await step(`reactome pathways (${causal.length} genes)`, () => ingestPathways(g, causal));
  }
  if (run("hpo"))  await step("hpo", () => ingestHPO(g));
  if (run("orgs")) await step("organizations", () => ingestOrganizations(g, orgs, diseases));
  await g.save();
  console.log(`\n✔ listo en ${((Date.now() - t0) / 1000).toFixed(1)}s`, g.stats);
  if (failures.length) { console.error(`\n✗ ${failures.length} paso(s) fallaron:\n  - ${failures.join("\n  - ")}`); process.exitCode = 1; }
}

async function step(name: string, fn: () => Promise<void>) {
  const t = Date.now();
  try { await fn(); console.log(`  ✓ ${name} (${((Date.now() - t) / 1000).toFixed(1)}s)`); }
  catch (e) { console.error(`  ✗ ${name}:`, (e as Error).message); failures.push(`${name}: ${(e as Error).message}`); }
}

main().catch((e) => { console.error(e); process.exit(1); });
