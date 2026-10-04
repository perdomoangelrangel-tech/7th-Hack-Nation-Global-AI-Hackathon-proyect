/**
 * Regulatory links and "approved" audit for every medicine in the graph — only from API responses, never guessed.
 *   - openFDA drug label  (api.fda.gov/drug/label.json)    → links.fda_label  = DailyMed page of the label's set_id
 *   - openFDA Drugs@FDA   (api.fda.gov/drug/drugsfda.json) → links.drugs_fda  = Drugs@FDA overview of the application
 *   - EMA medicines data  (official JSON export, by INN)   → links.ema_epar   = EPAR page (+ status, conditional approval)
 *   - ChEMBL id (from Open Targets)                         → links.chembl     = ChEMBL compound report card
 * Audit: every treats edge at stage APPROVAL is checked against the label (FDA "indications and usage") and the EPAR
 * (EMA "therapeutic indication"): if either names the disease, it is confirmed and gets an evidence row (source fda /
 * ema); otherwise it is flagged `regulatory_check: "not_confirmed_by_label"` (the source stage is kept, never deleted).
 *
 *   npx tsx scripts/regulatory-links.ts            → supabase/seed/regulatory.json + supabase/migrations/0015_regulatory_links.sql
 *                                                     + the same links / checks applied to data/atlas.json
 *   npx tsx scripts/regulatory-links.ts --no-file  → skip data/atlas.json (e.g. while another job writes it)
 *   npx tsx scripts/regulatory-links.ts --file-only → apply the saved regulatory.json to data/atlas.json only
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../src/lib/supabase/config";
import type { AtlasSnapshot, SourceId } from "../src/lib/atlas/types";
// "ema" is a new source id at runtime; SourceId is not widened here because other lanes keep exhaustive maps over it.
const EMA = "ema" as SourceId;

// deno-lint-ignore no-explicit-any
type Any = any;
const UA = { "user-agent": "nedamex-regulatory/1.0 (+https://github.com/perdomoangelrangel-tech/7th-Hack-Nation-Global-AI-Hackathon-proyect)" };
const EMA_JSON = "https://www.ema.europa.eu/en/documents/report/medicines-output-medicines_json-report_en.json";
const today = new Date().toISOString().slice(0, 10);

interface Drug { chembl: string; name: string; names: string[]; approvals: { orpha: string; disease: string }[]; approvedAnywhere: boolean }
interface Confirm { orpha: string; source: "fda" | "ema"; external_id: string; url: string; quote: string }
interface Reg {
  chembl: string; name: string; links: Record<string, string>;
  fda?: { set_id: string; brand?: string; application?: string; indications: string };
  ema?: { product: string; name: string; status: string; conditional: boolean; url: string; indication: string };
  confirms: Confirm[]; not_confirmed: string[]; checked_at: string;
}

async function getJSON(url: string): Promise<Any> {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30_000) }).catch(() => null);
    if (r?.ok) return r.json();
    if (r?.status === 404) return null; // openFDA: no match
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  return null;
}
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** Disease name terms (seed name, short name, search terms; ≥ 4 chars) for indication matching. */
function diseaseTerms(): Map<string, RegExp> {
  const seed = JSON.parse(readFileSync("supabase/seed/diseases.json", "utf8")) as Any[];
  const out = new Map<string, RegExp>();
  for (const d of seed) {
    const terms = [...new Set([d.name, d.short_name, ...(d.search_terms ?? [])].filter((t: string) => t && t.length >= 4))]
      .map((t: string) => t.replace(/\s*\([^)]*\)\s*/g, " ").trim()).filter((t: string) => t.length >= 4)
      .map((t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[\s-]+/g, "[\\s-]+"));
    out.set(d.orpha, new RegExp(`\\b(${terms.map(possessive).join("|")})`, "i"));
  }
  return out;
}

/** Eponyms: "Huntington[\s-]+disease" must also match "Huntington's disease" / "Wilson’s disease". */
function possessive(pattern: string) { return pattern.replace(/^([A-Z][a-z]+)(?=\[)/, "$1(?:['’]s)?"); }

const SALT = /\s+(hydrochloride|dihydrochloride|tartrate|sodium|potassium|acetate|sulfate|mesylate|dimesylate|maleate|citrate|phosphate|anhydrous|monohydrate|hydrate|bromide|succinate|fumarate)\b/gi;
/** Generic-name candidates: the salt-free form first (openFDA generic names drop the salt), then the names as given. */
function nameCandidates(names: string[]) { return [...new Set(names.flatMap((n) => [n.replace(SALT, "").trim(), n]))].filter((n) => n.length >= 4).slice(0, 4); }

async function loadDrugs(): Promise<Map<string, Drug>> {
  const drugs = new Map<string, Drug>();
  const add = (chembl: string, name: string, names: string[], approvedAnywhere: boolean) => {
    const d = drugs.get(chembl) ?? { chembl, name, names: [], approvals: [], approvedAnywhere: false };
    d.names = [...new Set([...d.names, name, ...names].filter(Boolean))];
    d.approvedAnywhere ||= approvedAnywhere;
    drugs.set(chembl, d);
    return d;
  };
  // Live graph (public key) ...
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("edge_evidence").select("from_canonical_id, from_name, from_props, to_canonical_id, to_name, edge_props")
      .eq("relation", "treats").eq("from_type", "treatment").like("from_canonical_id", "CHEMBL%").range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) {
      const p = r.from_props ?? {};
      const d = add(r.from_canonical_id, r.from_name, [...(p.synonyms ?? []), ...(p.trade_names ?? [])], p.approved === true);
      if (r.edge_props?.stage === "APPROVAL" && !d.approvals.some((a) => a.orpha === r.to_canonical_id)) d.approvals.push({ orpha: r.to_canonical_id, disease: r.to_name });
    }
    if ((data ?? []).length < 1000) break;
  }
  // ... and the bundled snapshot (same CHEMBL ids).
  const snap = JSON.parse(readFileSync("data/atlas.json", "utf8")) as AtlasSnapshot;
  const byId = new Map(snap.entities.map((e) => [e.id, e]));
  for (const e of snap.edges.filter((x) => x.relation === "treats")) {
    const t = byId.get(e.from), dis = byId.get(e.to);
    if (!t || !dis || !t.canonical_id.startsWith("CHEMBL")) continue;
    const d = add(t.canonical_id, t.name, [...((t.props.synonyms as string[]) ?? []), ...((t.props.trade_names as string[]) ?? [])], t.props.approved === true || e.props.approved === true);
    if ((e.props.stage === "APPROVAL" || e.props.approved === true) && !d.approvals.some((a) => a.orpha === dis.canonical_id)) d.approvals.push({ orpha: dis.canonical_id, disease: dis.name });
  }
  return drugs;
}

/**
 * openFDA label for a generic name. A generic has many labels (makers, OTC / Rx): take up to 5 and prefer the one whose
 * indication names a target disease (`want`), else the first. Drugs@FDA application for the same generic name.
 */
async function openFda(names: string[], want?: RegExp) {
  const text = (l: Any) => String((l?.indications_and_usage ?? [])[0] ?? "").replace(/\s+/g, " ").trim();
  for (const n of nameCandidates(names)) {
    const term = encodeURIComponent(`openfda.generic_name:"${n.toUpperCase()}"`);
    const labels: Any[] = (await getJSON(`https://api.fda.gov/drug/label.json?search=${term}&limit=5`))?.results ?? [];
    const label = (want && labels.find((l) => want.test(text(l)))) || labels.find((l) => l?.set_id);
    if (!label?.set_id) continue;
    const app = (await getJSON(`https://api.fda.gov/drug/drugsfda.json?search=${term}&limit=1`))?.results?.[0];
    return {
      set_id: label.set_id as string, brand: label.openfda?.brand_name?.[0] as string | undefined,
      application: (label.openfda?.application_number?.[0] ?? app?.application_number) as string | undefined,
      indications: text(label),
    };
  }
  return undefined;
}

async function main() {
  if (process.argv.includes("--file-only")) {
    const saved = JSON.parse(readFileSync("supabase/seed/regulatory.json", "utf8")) as Record<string, Reg>;
    applyToFile(saved);
    return;
  }
  const drugs = await loadDrugs();
  const terms = diseaseTerms();
  const emaRaw = await getJSON(EMA_JSON);
  const ema: Any[] = (emaRaw?.data ?? []).filter((r: Any) => r.category === "Human");
  const byInn = new Map<string, Any[]>();
  for (const r of ema) for (const k of [r.international_non_proprietary_name_common_name, r.active_substance]) {
    const key = String(k ?? "").toLowerCase().trim(); if (!key) continue;
    byInn.set(key, [...(byInn.get(key) ?? []), r]);
  }
  const rank = (r: Any) => (r.generic === "Yes" || r.biosimilar === "Yes" ? 2 : 0) + (r.medicine_status === "Authorised" ? 0 : 1);

  const out: Record<string, Reg> = {};
  const todo = [...drugs.values()].filter((d) => d.approvedAnywhere || d.approvals.length).sort((a, b) => a.chembl.localeCompare(b.chembl));
  let i = 0;
  for (const d of todo) {
    const reg: Reg = { chembl: d.chembl, name: d.name, links: { chembl: `https://www.ebi.ac.uk/chembl/compound_report_card/${d.chembl}/` }, confirms: [], not_confirmed: [], checked_at: today };
    const want = d.approvals.length ? new RegExp(d.approvals.map((a) => terms.get(a.orpha)?.source).filter(Boolean).join("|"), "i") : undefined;
    const fda = await openFda(d.names, want);
    if (fda) {
      reg.fda = fda;
      reg.links.fda_label = `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${fda.set_id}`;
      const appl = fda.application?.match(/\d+/)?.[0];
      if (appl) reg.links.drugs_fda = `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${appl}`;
    }
    const emaAll = [...new Set(nameCandidates(d.names).flatMap((n) => byInn.get(n.toLowerCase()) ?? []))].sort((a, b) => rank(a) - rank(b));
    const e = (want && emaAll.find((r) => want.test(String(r.therapeutic_indication ?? "")))) || emaAll[0];
    if (e?.medicine_url) {
      reg.ema = { product: e.ema_product_number, name: e.name_of_medicine, status: e.medicine_status, conditional: e.conditional_approval === "Yes", url: e.medicine_url, indication: String(e.therapeutic_indication ?? "").replace(/\s+/g, " ").trim() };
      reg.links.ema_epar = e.medicine_url;
    }
    for (const a of d.approvals) {
      const re = terms.get(a.orpha);
      const fdaHit = re && fda?.indications ? fda.indications.match(re) : null;
      const emaHit = re && reg.ema?.indication ? reg.ema.indication.match(re) : null;
      const sentence = (text: string, hit: RegExpMatchArray) => clip(text.slice(Math.max(0, (hit.index ?? 0) - 120), (hit.index ?? 0) + 220).trim(), 300);
      if (fdaHit && fda) reg.confirms.push({ orpha: a.orpha, source: "fda", external_id: `DailyMed:${fda.set_id}`, url: reg.links.fda_label, quote: `${fda.brand ?? d.name} label — ${sentence(fda.indications, fdaHit)}` });
      if (emaHit && reg.ema) reg.confirms.push({ orpha: a.orpha, source: "ema", external_id: reg.ema.product, url: reg.ema.url, quote: `${reg.ema.name} EPAR (${reg.ema.status}${reg.ema.conditional ? ", conditional" : ""}) — ${sentence(reg.ema.indication, emaHit)}` });
      if (!fdaHit && !emaHit) reg.not_confirmed.push(a.orpha);
    }
    out[d.chembl] = reg;
    if (++i % 25 === 0) console.log(`  ${i}/${todo.length}`);
    await new Promise((res) => setTimeout(res, 300)); // openFDA: ≤ 240 requests/min without a key
  }
  writeFileSync("supabase/seed/regulatory.json", JSON.stringify(out, null, 2) + "\n");

  /* Migration (live) ---------------------------------------------------- */
  const links = Object.fromEntries(Object.values(out).map((r) => [r.chembl, { links: r.links, regulatory: { fda_application: r.fda?.application ?? null, fda_brand: r.fda?.brand ?? null, ema_status: r.ema?.status ?? null, ema_conditional: r.ema?.conditional ?? null, ema_product: r.ema?.product ?? null, checked_at: today } }]));
  const confirms = Object.values(out).flatMap((r) => r.confirms.map((c) => ({ chembl: r.chembl, ...c })));
  const checks = Object.values(out).flatMap((r) => [
    ...[...new Set(r.confirms.map((c) => c.orpha))].map((orpha) => ({ chembl: r.chembl, orpha, check: `confirmed_by_${[...new Set(r.confirms.filter((c) => c.orpha === orpha).map((c) => c.source))].sort().join("_")}` })),
    ...r.not_confirmed.map((orpha) => ({ chembl: r.chembl, orpha, check: "not_confirmed_by_label" })),
  ]);
  const J = (x: unknown) => q(JSON.stringify(x));
  const sql = `-- 0015_regulatory_links.sql — GENERATED by scripts/regulatory-links.ts (${today}). Only API responses:
-- openFDA label (DailyMed), openFDA Drugs@FDA, EMA medicines JSON export (EPAR), ChEMBL id from Open Targets.
-- 1) treatment props.links / props.regulatory  2) fda / ema evidence on APPROVAL edges whose label names the disease
-- 3) regulatory_check on every APPROVAL edge (source stage kept)  4) medicines_public honours the check. No deletes.

insert into public.sources (id, name, license, base_url) values
  ('ema', 'European Medicines Agency (EPAR)', 'EMA copyright, reuse with attribution', 'https://www.ema.europa.eu')
on conflict (id) do nothing;

with x as (select key as chembl, value as v from jsonb_each(${J(links)}::jsonb))
update public.entities e set props = e.props || x.v, updated_at = now()
  from x where e.type = 'treatment' and e.canonical_id = x.chembl;

insert into public.evidence (edge_id, source_id, external_id, url, quote, published_on, retrieved_at)
select ed.id, c.source, c.external_id, c.url, left(c.quote, 500), null, now()
  from jsonb_to_recordset(${J(confirms)}::jsonb) as c(chembl text, orpha text, source text, external_id text, url text, quote text)
  join public.entities t on t.type = 'treatment' and t.canonical_id = c.chembl
  join public.entities d on d.type = 'disease' and d.canonical_id = c.orpha
  join public.edges ed on ed.from_id = t.id and ed.to_id = d.id and ed.relation = 'treats'
on conflict (edge_id, source_id, external_id) do nothing;

update public.edges ed set props = ed.props || jsonb_build_object('regulatory_check', c.check, 'regulatory_checked_at', ${q(today)}), updated_at = now()
  from jsonb_to_recordset(${J(checks)}::jsonb) as c(chembl text, orpha text, "check" text),
       public.entities t, public.entities d
 where t.type = 'treatment' and t.canonical_id = c.chembl and d.type = 'disease' and d.canonical_id = c.orpha
   and ed.from_id = t.id and ed.to_id = d.id and ed.relation = 'treats';

-- Same columns as 0014; an APPROVAL whose label / EPAR does not name the disease is not counted as approved here.
create or replace view public.medicines_public with (security_invoker = true) as
select
  t.id,
  'treatment:' || t.canonical_id as entity_id,
  t.canonical_id,
  t.name,
  t.props->>'chembl_id'                              as chembl_id,
  t.props->>'drug_type'                              as drug_type,
  t.props->>'mechanism'                              as mechanism,
  coalesce(t.props->'targets', '[]'::jsonb)          as targets,
  coalesce(t.props->'trade_names', '[]'::jsonb)      as trade_names,
  coalesce((t.props->>'approved')::boolean, false)   as approved_anywhere,
  t.props->>'max_stage'                              as max_stage,
  t.props->>'opentargets_url'                        as opentargets_url,
  coalesce(t.props->'links', '{}'::jsonb)            as links,
  bool_or(ed.props->>'stage' = 'APPROVAL' and coalesce(ed.props->>'regulatory_check', '') <> 'not_confirmed_by_label') as approved_for_listed_disease,
  jsonb_agg(distinct jsonb_build_object(
    'disease_id', 'disease:' || d.canonical_id,
    'disease',    d.name,
    'stage',      ed.props->>'stage',
    'status',     ed.props->>'status',
    'regulatory_check', ed.props->>'regulatory_check',
    'nct_ids',    coalesce(ed.props->'nct_ids', '[]'::jsonb),
    'edge_id',    ed.id,
    'sources',    (select coalesce(jsonb_agg(jsonb_build_object('source', ev.source_id, 'url', ev.url, 'external_id', ev.external_id)), '[]'::jsonb)
                   from public.evidence ev where ev.edge_id = ed.id)
  )) as indications
from public.entities t
join public.edges ed   on ed.from_id = t.id and ed.relation = 'treats'
join public.entities d on d.id = ed.to_id and d.type = 'disease'
where t.type = 'treatment'
group by t.id;
`;
  writeFileSync("supabase/migrations/0015_regulatory_links.sql", sql);

  if (!process.argv.includes("--no-file")) applyToFile(out);
  const confirmedEdges = new Set(confirms.map((c) => `${c.chembl}|${c.orpha}`)).size;
  const flagged = checks.filter((c) => c.check === "not_confirmed_by_label");
  console.log(`✔ ${todo.length} medicines checked · fda_label ${Object.values(out).filter((r) => r.links.fda_label).length} · drugs_fda ${Object.values(out).filter((r) => r.links.drugs_fda).length} · ema_epar ${Object.values(out).filter((r) => r.links.ema_epar).length}`);
  console.log(`  APPROVAL edges confirmed by a label: ${confirmedEdges} · NOT confirmed (flagged): ${flagged.length}`);
  for (const f of flagged) console.log(`    ⚠ ${out[f.chembl].name} → ${f.orpha}`);
}

/** Same links / evidence / checks on the bundled snapshot (treatments share CHEMBL ids with live). */
function applyToFile(out: Record<string, Reg>) {
  const today = new Date().toISOString().slice(0, 10);
  const snap = JSON.parse(readFileSync("data/atlas.json", "utf8")) as AtlasSnapshot;
  const byId = new Map(snap.entities.map((e) => [e.id, e]));
  if (!snap.sources[EMA]) snap.sources[EMA] = { id: EMA, name: "European Medicines Agency (EPAR)", license: "EMA copyright, reuse with attribution", url: "https://www.ema.europa.eu", last_synced_at: new Date().toISOString() };
  for (const e of snap.entities) {
    const r = out[e.canonical_id]; if (e.type !== "treatment" || !r) continue;
    e.props.links = r.links;
    e.props.regulatory = { fda_application: r.fda?.application ?? null, fda_brand: r.fda?.brand ?? null, ema_status: r.ema?.status ?? null, ema_conditional: r.ema?.conditional ?? null, ema_product: r.ema?.product ?? null, checked_at: r.checked_at ?? today };
  }
  for (const e of snap.edges.filter((x) => x.relation === "treats")) {
    const t = byId.get(e.from), d = byId.get(e.to); const r = t && out[t.canonical_id]; if (!r || !d) continue;
    const cs = r.confirms.filter((c) => c.orpha === d.canonical_id);
    for (const c of cs) if (!e.evidence.some((v) => v.source === c.source && v.external_id === c.external_id))
      e.evidence.push({ id: `ev:reg-${c.source}-${t!.canonical_id}-${d.canonical_id}`, source: c.source as SourceId, external_id: c.external_id, url: c.url, quote: c.quote, published_on: null, retrieved_at: new Date().toISOString() });
    if (cs.length) e.props.regulatory_check = `confirmed_by_${[...new Set(cs.map((c) => c.source))].sort().join("_")}`;
    else if (r.not_confirmed.includes(d.canonical_id)) { e.props.regulatory_check = "not_confirmed_by_label"; e.props.approved_for_indication = false; }
  }
  writeFileSync("data/atlas.json", JSON.stringify(snap));
  const t = snap.entities.filter((e) => e.type === "treatment" && e.props.links).length;
  console.log(`✔ data/atlas.json: links on ${t} treatments; ${snap.edges.filter((e) => e.props.regulatory_check === "not_confirmed_by_label").length} APPROVAL edges flagged, ${snap.edges.filter((e) => String(e.props.regulatory_check ?? "").startsWith("confirmed")).length} confirmed`);
}

main().catch((e) => { console.error(e); process.exit(1); });
