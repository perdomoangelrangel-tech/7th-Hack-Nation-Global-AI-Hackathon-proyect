/**
 * Recompute analytics for the bundled snapshot (data/atlas.json). Thin wrapper over src/lib/atlas/analyze.ts,
 * the same pure function the Supabase loader runs in-process.
 *
 *   npx tsx scripts/analyze.ts [path=data/atlas.json]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { withAnalytics } from "../src/lib/atlas/analyze";
import type { AtlasSnapshot } from "../src/lib/atlas/types";

const path = process.argv[2] ?? "data/atlas.json";
const input = JSON.parse(readFileSync(path, "utf8")) as AtlasSnapshot;
const snap = withAnalytics({ ...input, generated_at: new Date().toISOString() });
writeFileSync(path, JSON.stringify(snap));

const A = snap.analytics!;
const name = (id: string) => snap.entities.find((e) => e.id === id)?.name ?? id;
console.log(`✔ analytics: ${A.clusters.length} clusters, ${Object.keys(A.similarity).length} inferred connections, ${A.bridges.length} bridges (${A.bridges.filter((b) => b.cross_cluster).length} cross-cluster), ${A.gaps.length} gaps, ${A.counterexamples.length} counterexamples`);
for (const c of A.clusters) console.log(`  ${c.id} · ${c.label} · ${c.diseases.map(name).join(" | ")}\n      ${c.label_basis}`);
for (const c of A.counterexamples) console.log(`  ⚠ ${c.kind ?? "counterexample"}: ${name(c.a)} ↔ ${name(c.b)}`);
