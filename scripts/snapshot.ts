/**
 * Export the live Supabase graph to data/atlas.json (same format, analytics included) so the app still shows
 * the full slice offline / without network. Public key only (read-only by RLS).
 *
 *   npx tsx scripts/snapshot.ts [--out=data/atlas.json] [--check]   (--check: fetch + analyze, print counts, write nothing)
 */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../src/lib/supabase/config";
import { fetchSnapshot } from "../src/lib/supabase/snapshot";
import { withAnalytics } from "../src/lib/atlas/analyze";

const MAX_BYTES = 8 * 1024 * 1024;
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "true"]; }));
const out = args.out ?? "data/atlas.json";

async function main() {
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { snapshot, stats } = await fetchSnapshot(db);
  const t = Date.now();
  const snap = withAnalytics(snapshot);
  const json = JSON.stringify(snap);
  const count = (type: string) => snap.entities.filter((e) => e.type === type).length;
  console.log(`✔ fetched in ${stats.ms} ms (${stats.requests} requests), analyzed in ${Date.now() - t} ms`, stats.rows);
  console.log(`  diseases ${count("disease")} · genes ${count("gene")} · phenotypes ${count("phenotype")} · pathways ${count("pathway")} · investigators ${count("investigator")} · trials ${count("trial")} · papers ${count("study")}`);
  console.log(`  edges ${snap.edges.length} (inferred ${snap.edges.filter((e) => e.kind === "inferred").length}, extracted ${stats.extracted_edges}) · evidence ${snap.edges.reduce((s, e) => s + e.evidence.length, 0)} · dropped without evidence ${stats.dropped_edges_without_evidence} · proposals ${stats.proposals}`);
  for (const c of snap.analytics!.clusters) console.log(`  ${c.id} · ${c.label} · ${c.diseases.length} diseases — ${c.label_basis}`);
  console.log(`  size ${(json.length / 1024 / 1024).toFixed(2)} MB`);
  if (args.check) return;
  if (json.length > MAX_BYTES) throw new Error(`snapshot is ${(json.length / 1024 / 1024).toFixed(1)} MB (> 8 MB): trim before writing`);
  writeFileSync(out, json);
  console.log(`✔ wrote ${out}`);
}

main().catch((e) => { console.error("✗ snapshot failed:", (e as Error).message); process.exit(1); });
