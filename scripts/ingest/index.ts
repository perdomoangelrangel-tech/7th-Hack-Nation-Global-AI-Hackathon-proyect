/**
 * Ingesta completa. Uso:
 *   npm run ingest                      -> todas las fuentes, todas las enfermedades del seed
 *   npm run ingest -- --only=orphanet   -> una fuente
 *   npm run ingest -- --orpha=ORPHA:33069
 * Para escalar: sustituir supabase/seed/diseases.json por la salida de Orphadata rd-classification.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Graph } from "./graph";
import type { SeedDisease, SeedOrganization } from "./types";
import { ingestOrphanet } from "./sources/orphanet";
import { ingestClinicalTrials } from "./sources/clinicaltrials";
import { ingestPubMed } from "./sources/pubmed";
import { ingestClinVar } from "./sources/clinvar";
import { ingestOpenTargets } from "./sources/opentargets";
import { ingestHPO } from "./sources/hpo";
import { ingestOrganizations } from "./sources/organizations";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const diseases: SeedDisease[] = JSON.parse(readFileSync("supabase/seed/diseases.json", "utf8"));
const orgs: SeedOrganization[] = JSON.parse(readFileSync("supabase/seed/organizations.json", "utf8"));
const selected = args.orpha ? diseases.filter((d) => d.orpha === args.orpha) : diseases;
const only = args.only as string | undefined;
const run = (name: string) => !only || only === name;

async function main() {
  const g = new Graph();
  const t0 = Date.now();
  for (const d of selected) {
    console.log(`\n▶ ${d.name} (${d.orpha})`);
    if (run("orphanet"))  await step("orphanet",  () => ingestOrphanet(g, d));
    if (run("ctgov"))     await step("ctgov",     () => ingestClinicalTrials(g, d));
    if (run("pubmed"))    await step("pubmed",    () => ingestPubMed(g, d));
    if (run("clinvar"))   await step("clinvar",   () => ingestClinVar(g, d));
    if (run("opentargets")) await step("opentargets", () => ingestOpenTargets(g, d));
  }
  if (run("hpo"))  await step("hpo",  () => ingestHPO(g));
  if (run("orgs")) await step("orgs", () => ingestOrganizations(g, orgs, selected));
  console.log(`\n✔ listo en ${((Date.now() - t0) / 1000).toFixed(1)}s`, g.stats);
}

async function step(name: string, fn: () => Promise<void>) {
  const t = Date.now();
  try { await fn(); console.log(`  ✓ ${name} (${((Date.now() - t) / 1000).toFixed(1)}s)`); }
  catch (e) { console.error(`  ✗ ${name}:`, (e as Error).message); }
}

main().catch((e) => { console.error(e); process.exit(1); });
