/**
 * Apply supabase/seed/groups.json to a snapshot file (same effect as migration 0013 on the live DB):
 * disease props.orphanet_groups + group names/synonyms as English aliases. Then run `npm run analyze`.
 *
 *   npx tsx scripts/apply-groups.ts [path=data/atlas.json]
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { AtlasSnapshot } from "../src/lib/atlas/types";

interface Group { orpha: string; name: string; synonyms: string[]; mondo?: string }
const ADMIN = /potentially indicated for/i;
const BAD_SYNONYM = /\[ambiguous\]|^obsolete\b/i;
const path = process.argv[2] ?? "data/atlas.json";
const snap = JSON.parse(readFileSync(path, "utf8")) as AtlasSnapshot;
const groups = JSON.parse(readFileSync("supabase/seed/groups.json", "utf8")) as Record<string, Group[]>;
let n = 0;
for (const e of snap.entities.filter((x) => x.type === "disease")) {
  const list = (groups[e.canonical_id] ?? []).filter((g) => !ADMIN.test(g.name))
    .map(({ orpha, name, synonyms, mondo }) => ({ orpha, name, synonyms: synonyms.filter((s) => !BAD_SYNONYM.test(s)), ...(mondo ? { mondo } : {}) }));
  if (!list.length) continue;
  e.props.orphanet_groups = list;
  const have = new Set(e.aliases.map((a) => `${a.alias.toLowerCase()}|${a.lang}`));
  for (const a of list.flatMap((g) => [g.name, ...g.synonyms])) {
    const k = `${a.trim().toLowerCase()}|en`;
    if (a.trim().length >= 3 && !have.has(k)) { e.aliases.push({ alias: a.trim(), lang: "en" }); have.add(k); n++; }
  }
}
writeFileSync(path, JSON.stringify(snap));
console.log(`✔ ${path}: orphanet_groups on ${snap.entities.filter((x) => x.type === "disease" && x.props.orphanet_groups).length} diseases, +${n} aliases`);
