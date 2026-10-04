/**
 * Batch extraction over the PubMed papers already in the graph.
 *   npm run extract -- --limit 40 [--dry-run] [--supersede-treats]
 * --supersede-treats: re-extract only the papers whose latest saved extraction still contains a "treats" claim
 * (QA-31). The loader keeps the latest extraction per PMID, so the new row replaces it; nothing is deleted.
 * (= tsx --conditions=react-server src/lib/ai/cli/extract.ts …)
 * Needs OPENAI_API_KEY (otherwise it exits: deterministic dictionary passes are never persisted).
 * Idempotent by PMID: papers that already have a saved extraction are skipped. Sequential, ≤3 NCBI requests/s.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { loadAtlas } from "../../atlas/store";
import { publicClient } from "../../supabase/server";
import { aiEnabled } from "../client";
import { extract } from "../extract";
import { fetchPaper, normalizePmid } from "../pubmed";

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? undefined : process.argv[i + 1]; };
const limit = Math.max(1, Math.min(500, Number(arg("limit") ?? 40) || 40));
const dryRun = process.argv.includes("--dry-run");
const supersedeTreats = process.argv.includes("--supersede-treats");
const PRIORITY_DISEASE = "disease:ORPHA:599373"; // STXBP1-DEE (demo route)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!aiEnabled()) { console.error("✗ OPENAI_API_KEY is not set: nothing to do (dictionary passes are not persisted)."); process.exit(1); }
  const idx = await loadAtlas(); // live graph when reachable, so ids match what the app shows
  // Papers on the demo route first (Maria: STXBP1-DEE and its mechanism cluster), then the rest of the slice.
  const cluster = idx.snap.analytics?.disease_cluster[PRIORITY_DISEASE];
  const priority = new Set([PRIORITY_DISEASE, ...Object.entries(idx.snap.analytics?.disease_cluster ?? {}).filter(([, c]) => c === cluster).map(([d]) => d)]);
  const rank = new Map<string, number>();
  for (const e of idx.snap.edges) for (const ev of e.evidence) {
    const p = ev.source === "pubmed" ? normalizePmid(ev.external_id) : null;
    if (!p) continue;
    const r = priority.has(e.to) || priority.has(e.from) ? 0 : 1;
    rank.set(p, Math.min(rank.get(p) ?? 9, r));
  }
  for (const e of idx.snap.entities) if (e.type === "study") { const p = normalizePmid(e.canonical_id); if (p && !rank.has(p)) rank.set(p, 2); }
  const pmids = [...rank.entries()].sort((a, b) => a[1] - b[1]).map(([p]) => p);

  const db = publicClient();
  const { data: done, error } = await db.from("extractions").select("pmid,created_at,payload");
  if (error) console.warn(`⚠ cannot read extractions (${error.message}); continuing without the idempotency check`);
  type Row = { pmid: string; created_at: string; payload: { claims?: { relation?: string }[] } };
  const latest = new Map<string, Row>();
  for (const r of (done ?? []) as Row[]) if (!latest.has(r.pmid) || latest.get(r.pmid)!.created_at < r.created_at) latest.set(r.pmid, r);
  const already = new Set(latest.keys());
  const withTreats = [...latest.values()].filter((r) => (r.payload?.claims ?? []).some((c) => c.relation === "treats")).map((r) => r.pmid);
  const todo = (supersedeTreats ? withTreats : pmids.filter((p) => !already.has(p))).slice(0, limit);
  if (supersedeTreats) console.log(`▶ superseding ${withTreats.length} extraction(s) that still say "treats"`);
  console.log(`▶ ${pmids.length} PubMed papers in the graph · ${already.size} already extracted · processing ${todo.length}${dryRun ? " (dry run)" : ""}`);

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
