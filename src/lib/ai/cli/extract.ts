/**
 * Batch extraction over the PubMed papers already in the graph.
 *   npm run extract -- --limit 40 [--dry-run]
 * (= tsx --conditions=react-server src/lib/ai/cli/extract.ts …)
 * Needs OPENAI_API_KEY (otherwise it exits: deterministic dictionary passes are never persisted).
 * Idempotent by PMID: papers that already have a saved extraction are skipped. Sequential, ≤3 NCBI requests/s.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { atlas } from "../../atlas/store";
import { publicClient } from "../../supabase/server";
import { aiEnabled } from "../client";
import { extract } from "../extract";
import { fetchPaper, normalizePmid } from "../pubmed";

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? undefined : process.argv[i + 1]; };
const limit = Math.max(1, Math.min(500, Number(arg("limit") ?? 40) || 40));
const dryRun = process.argv.includes("--dry-run");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!aiEnabled()) { console.error("✗ OPENAI_API_KEY is not set: nothing to do (dictionary passes are not persisted)."); process.exit(1); }
  const idx = atlas();
  const pmids = new Set<string>();
  for (const e of idx.snap.entities) if (e.type === "study") { const p = normalizePmid(e.canonical_id); if (p) pmids.add(p); }
  for (const ev of idx.evidenceById.values()) if (ev.source === "pubmed") { const p = normalizePmid(ev.external_id); if (p) pmids.add(p); }

  const db = publicClient();
  const { data: done, error } = await db.from("extractions").select("pmid");
  if (error) console.warn(`⚠ cannot read extractions (${error.message}); continuing without the idempotency check`);
  const already = new Set((done ?? []).map((r: { pmid: string }) => r.pmid));
  const todo = [...pmids].filter((p) => !already.has(p)).slice(0, limit);
  console.log(`▶ ${pmids.size} PubMed papers in the graph · ${already.size} already extracted · processing ${todo.length}${dryRun ? " (dry run)" : ""}`);

  let saved = 0, claims = 0, failed = 0;
  for (const [i, pmid] of todo.entries()) {
    try {
      const paper = await fetchPaper(pmid);
      if (!paper) { console.log(`  ${i + 1}/${todo.length} PMID:${pmid} · no abstract`); continue; }
      const r = await extract(idx, { paper, save: !dryRun }, async (p, model, payload) => {
        const { data, error: e } = await db.rpc("save_extraction", { p_pmid: p, p_model: model, p_payload: payload });
        if (e) throw new Error(e.message);
        return String(data);
      });
      claims += r.claims.length; if (r.saved) saved++;
      console.log(`  ${i + 1}/${todo.length} PMID:${pmid} · ${r.entities.length} entities · ${r.claims.filter((c) => c.graphable).length}/${r.claims.length} graphable claims · ${r.saved ? "saved" : r.save_note}`);
    } catch (e) {
      failed++;
      console.log(`  ${i + 1}/${todo.length} PMID:${pmid} · error: ${(e as Error).message}`);
    }
    await sleep(400);
  }
  console.log(`✓ done · ${saved} saved · ${claims} claims · ${failed} failed`);
}

main();
