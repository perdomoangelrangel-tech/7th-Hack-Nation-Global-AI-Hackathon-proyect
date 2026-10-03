/**
 * Atlas data contract + server-only loaders for the /atlas map, /api/ask and /api/tools/*.
 *
 * getDiseaseMap(orpha) reads the evidence graph (Supabase, public RLS) with a hard ~4 s budget.
 * If Supabase is missing, slow or unreachable it falls back to src/data/snapshot.json, a trimmed
 * export of the same graph. Every station carries the evidence rows that back it; nothing here
 * is authored text.
 *
 * Types are imported (type-only) by client components; never import the loaders from a "use client" file.
 */
import { publicClient } from "./supabase/server";
import snapshotJson from "../data/snapshot.json";
import { cleanAffiliation, computeGaps, isRecruiting, isWeak, shortName, sortLiterature } from "./agents/evidence";
import { buildNeighbor, rankNeighbors, type Connections, type DiseaseRef, type LinkItem, type LinkKind, type Neighbor, type Umbrella } from "./agents/connections";

const recruitingFirst = (list: Station[]) => [...list].sort((a, b) => Number(isRecruiting(b)) - Number(isRecruiting(a)));

export type LineKey = "genes" | "phenotypes" | "treatments" | "trials" | "literature" | "community";
export const LINE_KEYS: LineKey[] = ["genes", "phenotypes", "treatments", "trials", "literature", "community"];

export interface EvidenceRef {
  id: string;
  source: string;
  external_id: string;
  url: string;
  published_on: string | null;
  retrieved_at: string;
  quote?: string | null;
}

export interface Station {
  /** entity id (uuid) or `rc:<uuid>` for researcher-community rows */
  id: string;
  name: string;
  canonical_id: string;
  props: Record<string, unknown>;
  relation: string | null;
  confidence: number | null;
  edge_props: Record<string, unknown>;
  evidence: EvidenceRef[];
  /** low confidence (< 0.4): drawn as a hollow dashed station */
  weak: boolean;
}

export type GapKind = "empty_line" | "no_approved_treatment" | "no_recruiting_trial" | "no_researchers" | "low_confidence" | "single_source";

export interface GapItem {
  kind: GapKind;
  line: LineKey;
  /** station the gap refers to (weak relations) */
  station?: { name: string; canonical_id: string };
  evidence_ids: string[];
}

export interface DiseaseSummary {
  id: string;
  orpha: string;
  name: string;
  name_es: string | null;
  short: string;
  aliases: string[];
}

export interface DiseaseMap {
  disease: DiseaseSummary & { props: Record<string, unknown> };
  lines: Record<LineKey, Station[]>;
  /** total rows in the graph per line (lines may be trimmed for display / snapshot) */
  totals: Record<LineKey, number>;
  gaps: GapItem[];
  source: "live" | "snapshot";
  retrieved_at: string;
}

interface SnapshotLinkItem { kind: LinkKind; code: string | null; name: string; props: Record<string, unknown>; a: Record<string, unknown>; b: Record<string, unknown>; confidence: number | null; ev_a: EvidenceRef[]; ev_b: EvidenceRef[] }
interface SnapshotConnections {
  phenotype_totals: Record<string, number>;
  umbrella: Umbrella[];
  pairs: { a: string; b: string; counts: Partial<Record<LinkKind, number>>; items: SnapshotLinkItem[] }[];
  retrieved_at: string;
}

interface Snapshot {
  generated_at: string | null;
  diseases: DiseaseSummary[];
  maps: Record<string, Omit<DiseaseMap, "source">>;
  connections?: SnapshotConnections;
}

const snapshot = snapshotJson as unknown as Snapshot;

/** Nodes the data lane retracted (no active relations). Never listed, detected or mapped. */
const RETRACTED = new Set(["ORPHA:228354"]); // CLN8 disease: wrong seed code, superseded by ORPHA:228349 (CLN2)

const TIMEOUT_MS = 4000;
const CACHE_MS = 60_000;
const DOWN_MS = 30_000;
let downUntil = 0;
const mapCache = new Map<string, { at: number; value: DiseaseMap }>();
let listCache: { at: number; value: DiseaseSummary[] } | null = null;

/** Edge row as returned by the edge_evidence view (see supabase/migrations/0001_graph.sql). */
interface EdgeRow {
  edge_id: string; relation: string; confidence: number | string; edge_props: Record<string, unknown> | null;
  from_id: string; from_type: string; from_canonical_id: string; from_name: string; from_props: Record<string, unknown> | null;
  to_id: string; to_type: string; to_canonical_id: string; to_name: string; to_props: Record<string, unknown> | null;
  evidence: (EvidenceRef & { quote: string | null })[] | null;
}

interface CommunityRow {
  id: string; name: string; affiliation: string | null; country: string | null; role: string; focus: string | null;
  orcid: string | null; open_to_contact: boolean; source: string; source_ref: string | null; created_at: string;
}

function liveAvailable() {
  return Date.now() > downUntil;
}

function markDown() {
  downUntil = Date.now() + DOWN_MS;
}

async function withBudget<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { ctrl.abort(); reject(new Error("graph timeout")); }, TIMEOUT_MS);
  });
  try {
    return await Promise.race([fn(ctrl.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const trimQuote = (q: string | null | undefined) => (q ? (q.length > 160 ? `${q.slice(0, 157)}…` : q) : null);

function toEvidence(rows: EdgeRow["evidence"]): EvidenceRef[] {
  return (rows ?? []).map((e) => ({
    id: e.id, source: e.source, external_id: e.external_id, url: e.url,
    published_on: e.published_on ?? null, retrieved_at: e.retrieved_at, quote: trimQuote(e.quote),
  }));
}

function edgeToStation(r: EdgeRow, side: "from" | "to"): Station {
  const confidence = r.confidence == null ? null : Number(r.confidence);
  return {
    id: side === "from" ? r.from_id : r.to_id,
    name: side === "from" ? r.from_name : r.to_name,
    canonical_id: side === "from" ? r.from_canonical_id : r.to_canonical_id,
    props: (side === "from" ? r.from_props : r.to_props) ?? {},
    relation: r.relation,
    confidence,
    edge_props: r.edge_props ?? {},
    evidence: toEvidence(r.evidence),
    weak: isWeak(confidence),
  };
}

function communityToStation(r: CommunityRow): Station {
  const pmid = r.source_ref?.replace(/^PMID:/i, "");
  const url = pmid && /^\d+$/.test(pmid)
    ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
    : r.orcid ? `https://orcid.org/${r.orcid.replace(/^https?:\/\/orcid\.org\//, "")}` : "";
  return {
    id: `rc:${r.id}`,
    name: r.name,
    canonical_id: r.orcid ? `ORCID:${r.orcid.replace(/^https?:\/\/orcid\.org\//, "")}` : r.source_ref ?? "",
    props: { kind: "researcher", role: r.role, affiliation: cleanAffiliation(r.affiliation), country: r.country, focus: r.focus?.replace(/^(first|senior|last) author:\s*/i, "") ?? null, open_to_contact: r.open_to_contact, source: r.source },
    relation: "researches",
    confidence: null,
    edge_props: {},
    evidence: [{
      id: `rc:${r.id}`,
      source: r.source === "pubmed_author" ? "pubmed" : "research_community",
      external_id: r.source_ref ?? (r.orcid ? `ORCID:${r.orcid}` : r.source),
      url, published_on: null, retrieved_at: r.created_at,
    }],
    weak: false,
  };
}

function diseaseSummary(row: { id: string; canonical_id: string; name: string; props: Record<string, unknown> | null }, aliases: string[]): DiseaseSummary {
  const props = row.props ?? {};
  const name_es = typeof props.name_es === "string" ? props.name_es : null;
  return { id: row.id, orpha: row.canonical_id, name: row.name, name_es, short: shortName(row.name), aliases };
}

async function loadLive(orpha: string): Promise<DiseaseMap | null> {
  const db = publicClient();
  if (!db || !liveAvailable()) return null;
  try {
    return await withBudget(async (signal) => {
      const d = await db.from("entities").select("id, canonical_id, name, props").eq("type", "disease").eq("canonical_id", orpha).abortSignal(signal).maybeSingle();
      if (d.error) throw d.error;
      if (!d.data) return null;
      const id = d.data.id as string;
      const ev = () => db.from("edge_evidence").select("*", { count: "exact" });
      const [genes, phenos, treats, trials, papers, orgs, community, aliases] = await Promise.all([
        ev().eq("to_id", id).eq("relation", "causes").order("confidence", { ascending: false }).limit(30).abortSignal(signal),
        ev().eq("from_id", id).eq("relation", "has_phenotype").order("confidence", { ascending: false }).limit(40).abortSignal(signal),
        ev().eq("to_id", id).eq("relation", "treats").order("confidence", { ascending: false }).limit(40).abortSignal(signal),
        ev().eq("to_id", id).eq("relation", "studies").eq("from_type", "trial").order("confidence", { ascending: false }).limit(80).abortSignal(signal),
        ev().eq("to_id", id).eq("relation", "studies").eq("from_type", "study").limit(60).abortSignal(signal),
        ev().eq("to_id", id).in("relation", ["supports", "researches"]).order("confidence", { ascending: false }).limit(30).abortSignal(signal),
        db.from("research_community").select("id, name, affiliation, country, role, focus, orcid, open_to_contact, source, source_ref, created_at", { count: "exact" }).eq("disease_id", id).eq("public_profile", true).order("orcid", { ascending: true, nullsFirst: false }).order("name").limit(40).abortSignal(signal),
        db.from("entity_aliases").select("alias").eq("entity_id", id).abortSignal(signal),
      ]);
      for (const r of [genes, phenos, treats, trials, papers, orgs, community, aliases]) if (r.error) throw r.error;

      const rows = (r: { data: unknown }) => (r.data ?? []) as EdgeRow[];
      const orgStations = rows(orgs).map((r) => edgeToStation(r, "from"));
      const people = ((community.data ?? []) as CommunityRow[]).map(communityToStation);
      const lines: Record<LineKey, Station[]> = {
        genes: rows(genes).map((r) => edgeToStation(r, "from")),
        phenotypes: rows(phenos).map((r) => edgeToStation(r, "to")),
        treatments: rows(treats).map((r) => edgeToStation(r, "from")),
        trials: recruitingFirst(rows(trials).map((r) => edgeToStation(r, "from"))),
        literature: sortLiterature(rows(papers).map((r) => edgeToStation(r, "from"))),
        community: [...orgStations, ...people],
      };
      const totals: Record<LineKey, number> = {
        genes: genes.count ?? lines.genes.length,
        phenotypes: phenos.count ?? lines.phenotypes.length,
        treatments: treats.count ?? lines.treatments.length,
        trials: trials.count ?? lines.trials.length,
        literature: papers.count ?? lines.literature.length,
        community: (orgs.count ?? orgStations.length) + (community.count ?? people.length),
      };
      const disease = { ...diseaseSummary(d.data, ((aliases.data ?? []) as { alias: string }[]).map((a) => a.alias)), props: (d.data.props ?? {}) as Record<string, unknown> };
      return { disease, lines, totals, gaps: computeGaps(lines, totals), source: "live" as const, retrieved_at: new Date().toISOString() };
    });
  } catch {
    markDown();
    return null;
  }
}

function fromSnapshot(orpha: string): DiseaseMap | null {
  const m = snapshot.maps?.[orpha];
  if (!m) return null;
  return { ...m, gaps: m.gaps?.length ? m.gaps : computeGaps(m.lines, m.totals), source: "snapshot" };
}

/** The full map for one disease (ORPHA code). Live graph first, snapshot second, null when unknown. */
export async function getDiseaseMap(orpha: string): Promise<DiseaseMap | null> {
  const key = orpha.trim().toUpperCase().replace(/^ORPHA\s*:?\s*/, "ORPHA:");
  if (RETRACTED.has(key)) return null;
  const hit = mapCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const live = await loadLive(key);
  const value = live && hasStations(live) ? live : fromSnapshot(key) ?? live;
  if (value?.source === "live") mapCache.set(key, { at: Date.now(), value });
  return value;
}

function hasStations(m: DiseaseMap) {
  return Object.values(m.totals).some((n) => n > 0);
}

/** Diseases available in the atlas (EN + ES names, aliases for detection). */
export async function listDiseases(): Promise<DiseaseSummary[]> {
  if (listCache && Date.now() - listCache.at < CACHE_MS) return listCache.value;
  const db = publicClient();
  let live: DiseaseSummary[] = [];
  if (db && liveAvailable()) {
    try {
      live = await withBudget(async (signal) => {
        const { data: rows, error } = await db.from("entities").select("id, canonical_id, name, props").eq("type", "disease").order("name").limit(50).abortSignal(signal);
        if (error) throw error;
        // Only diseases that already have sourced relations (a disease node alone is not a map).
        const counts = await Promise.all((rows ?? []).map((r) => db.from("edges").select("id", { count: "exact", head: true }).eq("status", "active").or(`from_id.eq.${r.id},to_id.eq.${r.id}`).abortSignal(signal)));
        const data = (rows ?? []).filter((r, i) => (counts[i].count ?? 0) > 0 && !RETRACTED.has(r.canonical_id as string));
        const ids = data.map((r) => r.id as string);
        const al = ids.length ? await db.from("entity_aliases").select("entity_id, alias").in("entity_id", ids).abortSignal(signal) : { data: [], error: null };
        if (al.error) throw al.error;
        const byId = new Map<string, string[]>();
        for (const a of (al.data ?? []) as { entity_id: string; alias: string }[]) byId.set(a.entity_id, [...(byId.get(a.entity_id) ?? []), a.alias]);
        return data.map((r) => diseaseSummary(r, byId.get(r.id) ?? []));
      });
    } catch {
      markDown();
    }
  }
  // Keep snapshot diseases too (the live graph may still be filling up).
  const seen = new Set(live.map((d) => d.orpha));
  const merged = [...live, ...snapshot.diseases.filter((d) => !seen.has(d.orpha))].filter((d) => !RETRACTED.has(d.orpha));
  if (live.length) listCache = { at: Date.now(), value: merged };
  return merged;
}

export function snapshotInfo() {
  return { generated_at: snapshot.generated_at, diseases: Object.keys(snapshot.maps ?? {}).length };
}

const SNAPSHOT_CAPS: Record<LineKey, number> = { genes: 12, phenotypes: 8, treatments: 6, trials: 6, literature: 5, community: 8 };

/** Trim a live map to the snapshot budget (used by GET /api/snapshot to refresh src/data/snapshot.json). */
export function toSnapshotMap(m: DiseaseMap): Omit<DiseaseMap, "source"> {
  const lines = Object.fromEntries(LINE_KEYS.map((k) => [k, m.lines[k].slice(0, SNAPSHOT_CAPS[k]).map((s) => ({
    ...s,
    props: k === "phenotypes" ? {} : s.props,
    evidence: s.evidence.slice(0, 2).map((e) => ({ ...e, quote: e.quote ? (e.quote.length > 120 ? e.quote.slice(0, 120) : e.quote) : null })),
  }))])) as Record<LineKey, Station[]>;
  const def = typeof m.disease.props.definition === "string" ? m.disease.props.definition.slice(0, 500) : undefined;
  return {
    disease: { ...m.disease, props: { definition: def, prevalence: m.disease.props.prevalence, mondo: m.disease.props.mondo } },
    lines, totals: m.totals, gaps: [], retrieved_at: m.retrieved_at,
  };
}

/** Live-only export of every disease map, in snapshot.json format. Null when the graph is unreachable. */
export async function exportSnapshot(): Promise<Snapshot | null> {
  const diseases = await listDiseases();
  const maps: Snapshot["maps"] = {};
  for (const d of diseases) {
    const m = await loadLive(d.orpha);
    if (m && hasStations(m)) maps[d.orpha] = toSnapshotMap(m);
  }
  if (!Object.keys(maps).length) return null;
  return { generated_at: new Date().toISOString(), diseases: diseases.filter((d) => maps[d.orpha]), maps };
}

// ---------------------------------------------------------------------------------------------------------
// Connections (Module 3): diseases that share evidence with this one. Live view `disease_links`, snapshot fallback.
// ---------------------------------------------------------------------------------------------------------

interface LinkRow {
  disease_a: string; disease_b: string; kind: LinkKind; item_code: string | null; item_name: string;
  item_props: Record<string, unknown> | null; props_a: Record<string, unknown> | null; props_b: Record<string, unknown> | null;
  confidence: number | string | null;
  evidence: { id?: string; source: string; external_id: string; url: string; retrieved_at?: string; side: "a" | "b" }[] | null;
}

const connCache = new Map<string, { at: number; value: Connections }>();
const toRef = (d: DiseaseSummary): DiseaseRef => ({ orpha: d.orpha, name: d.name, name_es: d.name_es, short: d.short });

function linkEvidence(rows: LinkRow["evidence"], side: "a" | "b", max = 3): EvidenceRef[] {
  return (rows ?? []).filter((e) => e.side === side).slice(0, max).map((e) => ({
    id: e.id ?? `link:${e.source}:${e.external_id}`, source: e.source, external_id: e.external_id, url: e.url,
    published_on: null, retrieved_at: e.retrieved_at ?? new Date().toISOString(),
  }));
}

function rowToItem(r: LinkRow): LinkItem {
  const props = { ...(r.item_props ?? {}) };
  if (r.kind === "researcher") props.affiliation = cleanAffiliation(typeof props.affiliation === "string" ? props.affiliation : null);
  return {
    kind: r.kind, code: r.item_code ?? (r.kind === "researcher" && typeof props.orcid === "string" ? `ORCID:${props.orcid}` : null),
    name: r.item_name, props, here: r.props_a ?? {}, there: r.props_b ?? {},
    confidence: r.confidence == null ? null : Number(r.confidence),
    evidence_here: linkEvidence(r.evidence, "a"), evidence_there: linkEvidence(r.evidence, "b"),
  };
}

async function loadConnectionsLive(orpha: string, diseases: DiseaseSummary[]): Promise<Connections | null> {
  const db = publicClient();
  if (!db || !liveAvailable()) return null;
  try {
    return await withBudget(async (signal) => {
      const d = await db.from("entities").select("id, canonical_id").eq("type", "disease").eq("canonical_id", orpha).abortSignal(signal).maybeSingle();
      if (d.error) throw d.error;
      if (!d.data) return null;
      const links = await db.from("disease_links").select("*").eq("disease_a", d.data.id).limit(1000).abortSignal(signal);
      if (links.error) throw links.error;
      const rows = (links.data ?? []) as LinkRow[];
      const neighborIds = [...new Set(rows.map((r) => r.disease_b))];
      const orgCodes = [...new Set(rows.filter((r) => r.kind === "organization" && r.item_code).map((r) => r.item_code as string))];
      const [ents, orgs] = await Promise.all([
        neighborIds.length ? db.from("entities").select("id, canonical_id").in("id", neighborIds).abortSignal(signal) : Promise.resolve({ data: [], error: null }),
        orgCodes.length ? db.from("entities").select("id, canonical_id, name, props").eq("type", "organization").in("canonical_id", orgCodes).abortSignal(signal) : Promise.resolve({ data: [], error: null }),
      ]);
      if (ents.error) throw ents.error;
      if (orgs.error) throw orgs.error;
      const orgRows = (orgs.data ?? []) as { id: string; canonical_id: string; name: string; props: Record<string, unknown> | null }[];
      const allIds = [d.data.id as string, ...neighborIds];
      const [phen, supports] = await Promise.all([
        Promise.all(allIds.map((id) => db.from("edges").select("id", { count: "exact", head: true }).eq("from_id", id).eq("relation", "has_phenotype").eq("status", "active").abortSignal(signal))),
        orgRows.length ? db.from("edges").select("from_id, to_id").eq("relation", "supports").eq("status", "active").in("from_id", orgRows.map((o) => o.id)).abortSignal(signal) : Promise.resolve({ data: [], error: null }),
      ]);
      if (supports.error) throw supports.error;
      const phenById = new Map(allIds.map((id, i) => [id, phen[i].count ?? 0]));
      const supportCount = new Map<string, Set<string>>();
      for (const e of (supports.data ?? []) as { from_id: string; to_id: string }[]) supportCount.set(e.from_id, (supportCount.get(e.from_id) ?? new Set()).add(e.to_id));
      const umbrella: Umbrella[] = orgRows.filter((o) => (supportCount.get(o.id)?.size ?? 0) >= 4)
        .map((o) => ({ code: o.canonical_id, name: o.name, url: typeof o.props?.url === "string" ? o.props.url : "" }));
      const orphaById = new Map(((ents.data ?? []) as { id: string; canonical_id: string }[]).map((e) => [e.id, e.canonical_id]));
      const here = diseases.find((x) => x.orpha === orpha);
      if (!here) return null;
      const neighbors: Neighbor[] = [];
      for (const other of diseases) {
        if (other.orpha === orpha) continue;
        const id = [...orphaById.entries()].find(([, o]) => o === other.orpha)?.[0];
        const items = id ? rows.filter((r) => r.disease_b === id).map(rowToItem) : [];
        neighbors.push(buildNeighbor({ disease: toRef(other), items, phenHere: phenById.get(d.data.id as string) ?? 0, phenThere: id ? phenById.get(id) ?? 0 : 0, umbrella }));
      }
      return { disease: toRef(here), neighbors: rankNeighbors(neighbors), umbrella, source: "live" as const, retrieved_at: new Date().toISOString() };
    });
  } catch {
    markDown();
    return null;
  }
}

function connectionsFromSnapshot(orpha: string, diseases: DiseaseSummary[]): Connections | null {
  const c = snapshot.connections;
  const here = diseases.find((x) => x.orpha === orpha);
  if (!c || !here) return null;
  const neighbors: Neighbor[] = [];
  for (const other of diseases) {
    if (other.orpha === orpha) continue;
    const pair = c.pairs.find((p) => (p.a === orpha && p.b === other.orpha) || (p.b === orpha && p.a === other.orpha));
    const flip = pair?.b === orpha;
    const items: LinkItem[] = (pair?.items ?? []).map((it) => ({
      kind: it.kind, code: it.code, name: it.name, props: it.props, confidence: it.confidence,
      here: flip ? it.b : it.a, there: flip ? it.a : it.b,
      evidence_here: flip ? it.ev_b : it.ev_a, evidence_there: flip ? it.ev_a : it.ev_b,
    }));
    neighbors.push(buildNeighbor({ disease: toRef(other), items, counts: pair?.counts, phenHere: c.phenotype_totals[orpha] ?? 0, phenThere: c.phenotype_totals[other.orpha] ?? 0, umbrella: c.umbrella }));
  }
  return { disease: toRef(here), neighbors: rankNeighbors(neighbors), umbrella: c.umbrella, source: "snapshot", retrieved_at: c.retrieved_at };
}

/** Ranked neighbors for one disease: shared evidence (both sides), score breakdown, next steps, honest gaps. */
export async function getConnections(orpha: string): Promise<Connections | null> {
  const key = orpha.trim().toUpperCase().replace(/^ORPHA\s*:?\s*/, "ORPHA:");
  if (RETRACTED.has(key)) return null;
  const hit = connCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const diseases = await listDiseases();
  const live = await loadConnectionsLive(key, diseases);
  const value = live ?? connectionsFromSnapshot(key, diseases);
  if (value?.source === "live") connCache.set(key, { at: Date.now(), value });
  return value;
}
