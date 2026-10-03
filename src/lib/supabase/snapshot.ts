/**
 * Reads the live evidence graph from Supabase into the AtlasSnapshot model (src/lib/atlas/types.ts).
 * Shared by the server loader (src/lib/atlas/source.ts) and `npm run snapshot` (scripts/snapshot.ts), so it must
 * not import "server-only". Uses only the public key: the graph is public-read by RLS.
 *
 * Plan: count each table (HEAD requests), then fetch every page in parallel (PostgREST caps a response at
 * 1,000 rows and anon has a 3 s statement timeout, so many small ordered pages beat one huge RPC).
 * Works on the pre-0011 schema too (no `kind` column, no proposals/extractions tables).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AtlasSnapshot, Edge, EdgeKind, Entity, EntityType, Evidence, Proposal, Relation, SourceId, SourceInfo } from "../atlas/types";

const PAGE = 1000;
const TIMEOUT_MS = 12_000;
const RELATIONS = new Set<Relation>(["causes", "has_phenotype", "has_variant", "studies", "treats", "supports", "researches", "participates_in", "is_a", "similar_to"]);
const KINDS = new Set<EdgeKind>(["observed", "inferred", "extracted", "proposed"]);

type Row = Record<string, unknown>;
interface EntityRow { id: string; type: EntityType; canonical_id: string; name: string; props: Record<string, unknown> | null }
interface EdgeRow { id: string; from_id: string; to_id: string; relation: Relation; confidence: number | string; confidence_basis: string; props: Record<string, unknown> | null; kind?: string }
interface EvidenceRow { id: string; edge_id: string; source_id: SourceId; external_id: string; url: string; quote: string | null; published_on: string | null; retrieved_at: string }
interface ExtractionRow { id: string; pmid: string; model: string; payload: { claims?: ExtractedClaim[] } & Row; created_at: string }
interface ExtractedClaim { subject?: string; relation?: string; object?: string; polarity?: string; quote?: string; confidence?: number; entity_ids?: (string | null)[] }

export interface SnapshotRows {
  entities: EntityRow[]; aliases: { entity_id: string; alias: string; lang: string }[] | null; edges: EdgeRow[]; evidence: EvidenceRow[];
  sources: { id: SourceId; name: string; license: string; base_url: string; last_synced_at: string | null }[] | null;
  proposals: (Proposal & Row)[] | null; extractions: ExtractionRow[] | null;
}

export interface FetchStats { ms: number; requests: number; rows: Record<string, number>; dropped_edges_without_evidence: number; extracted_edges: number; proposals: number }

/**
 * Every row of a table/view, read in parallel pages. `order` must be a UNIQUE key (composite allowed) or pages
 * can skip / repeat rows. Returns null when the relation does not exist (pre-0011 schema).
 */
async function readAll<T>(db: SupabaseClient, table: string, columns: string, order: string[], stats: { requests: number }, filter?: (q: any) => any): Promise<T[] | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let head = db.from(table).select(order[0], { count: "exact", head: true });
  if (filter) head = filter(head);
  const { count, error } = await head.abortSignal(signal);
  stats.requests++;
  if (error) {
    if (/does not exist|schema cache|42P01|PGRST20[05]/i.test(`${error.code} ${error.message}`)) return null;
    throw new Error(`${table}: ${error.message}`);
  }
  const pages = Math.ceil((count ?? 0) / PAGE);
  const results = await Promise.all(Array.from({ length: pages }, async (_, i) => {
    let q = db.from(table).select(columns);
    for (const col of order) q = q.order(col, { ascending: true });
    q = q.range(i * PAGE, i * PAGE + PAGE - 1);
    if (filter) q = filter(q);
    const { data, error: e } = await q.abortSignal(signal);
    stats.requests++;
    if (e) throw new Error(`${table} page ${i}: ${e.message}`);
    return (data ?? []) as T[];
  }));
  return results.flat();
}

/** Reads the live graph. Throws on network / permission errors (the caller falls back to the bundled file). */
export async function fetchSnapshot(db: SupabaseClient): Promise<{ snapshot: AtlasSnapshot; stats: FetchStats }> {
  const t0 = Date.now();
  const st = { requests: 0 };
  const active = (q: any) => q.eq("status", "active"); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [entityRows, aliasRows, edgeRows, evidenceRows, sourceRows, proposalRows, extractionRows] = await Promise.all([
    readAll<EntityRow>(db, "entities", "id,type,canonical_id,name,props", ["id"], st),
    readAll<{ entity_id: string; alias: string; lang: string }>(db, "entity_aliases", "entity_id,alias,lang", ["entity_id", "alias", "lang"], st),
    readAll<EdgeRow>(db, "edges", "*", ["id"], st, active),
    readAll<EvidenceRow>(db, "evidence", "id,edge_id,source_id,external_id,url,quote,published_on,retrieved_at", ["id"], st),
    readAll<{ id: SourceId; name: string; license: string; base_url: string; last_synced_at: string | null }>(db, "sources", "id,name,license,base_url,last_synced_at", ["id"], st),
    readAll<Proposal & Row>(db, "proposals_public", "id,kind,title,body,persona,disease,entities,edges,status,created_at", ["created_at", "id"], st),
    readAll<ExtractionRow>(db, "extractions", "id,pmid,model,payload,created_at", ["created_at", "id"], st),
  ]);
  if (!entityRows || !edgeRows || !evidenceRows) throw new Error("graph tables missing");
  const { snapshot, dropped, extracted } = rowsToSnapshot({ entities: entityRows, aliases: aliasRows, edges: edgeRows, evidence: evidenceRows, sources: sourceRows, proposals: proposalRows, extractions: extractionRows });
  return {
    snapshot,
    stats: {
      ms: Date.now() - t0, requests: st.requests,
      rows: { entities: entityRows.length, aliases: aliasRows?.length ?? 0, edges: edgeRows.length, evidence: evidenceRows.length, proposals: snapshot.proposals?.length ?? 0, extractions: extractionRows?.length ?? 0 },
      dropped_edges_without_evidence: dropped, extracted_edges: extracted, proposals: snapshot.proposals?.length ?? 0,
    },
  };
}

/** Pure mapping from table rows to the AtlasSnapshot contract (unit-tested in snapshot.test.ts). */
export function rowsToSnapshot(rows: SnapshotRows): { snapshot: AtlasSnapshot; dropped: number; extracted: number } {
  const { entities: entityRows, aliases: aliasRows, edges: edgeRows, evidence: evidenceRows, sources: sourceRows, proposals: proposalRows, extractions: extractionRows } = rows;

  /* Entities -------------------------------------------------------- */
  const idOf = new Map<string, string>(); // uuid -> `${type}:${canonical_id}`
  const ents = new Map<string, Entity>();
  for (const r of entityRows) {
    const id = `${r.type}:${r.canonical_id}`;
    idOf.set(r.id, id);
    ents.set(id, { id, type: r.type, canonical_id: r.canonical_id, name: r.name, props: r.props ?? {}, aliases: [] });
  }
  for (const a of aliasRows ?? []) {
    const e = ents.get(idOf.get(a.entity_id) ?? "");
    if (e) e.aliases.push({ alias: a.alias, lang: a.lang });
  }

  /* Edges + evidence ------------------------------------------------- */
  const evByEdge = new Map<string, Evidence[]>();
  for (const v of evidenceRows) {
    const list = evByEdge.get(v.edge_id) ?? [];
    list.push({ id: `ev:${v.id}`, source: v.source_id, external_id: v.external_id, url: v.url, quote: v.quote, published_on: v.published_on, retrieved_at: v.retrieved_at });
    evByEdge.set(v.edge_id, list);
  }
  const edges: Edge[] = [];
  let dropped = 0;
  for (const r of edgeRows) {
    const from = idOf.get(r.from_id), to = idOf.get(r.to_id);
    const evidence = (evByEdge.get(r.id) ?? []).sort((a, b) => (b.published_on ?? "").localeCompare(a.published_on ?? "") || a.id.localeCompare(b.id));
    if (!from || !to || !evidence.length) { dropped++; continue; }
    const kind = KINDS.has(r.kind as EdgeKind) ? (r.kind as EdgeKind) : "observed";
    edges.push({ id: `edge:${r.id}`, from, to, relation: r.relation, kind, confidence: Number(r.confidence), confidence_basis: r.confidence_basis, props: r.props ?? {}, evidence });
  }

  /* Saved OpenAI extractions -> kind "extracted" (latest extraction per PMID; needs expert review) */
  const latest = new Map<string, ExtractionRow>();
  for (const x of extractionRows ?? []) if (!latest.has(x.pmid) || latest.get(x.pmid)!.created_at < x.created_at) latest.set(x.pmid, x);
  let extracted = 0;
  for (const x of [...latest.values()].sort((a, b) => a.pmid.localeCompare(b.pmid))) {
    (x.payload?.claims ?? []).forEach((c, i) => {
      const [s, o] = (c.entity_ids ?? []).filter((v): v is string => typeof v === "string");
      const relation = c.relation as Relation;
      if (!s || !o || s === o || !ents.has(s) || !ents.has(o) || !RELATIONS.has(relation) || relation === "similar_to") return;
      const id = `edge:x-${x.id}-${i}`;
      edges.push({
        id, from: s, to: o, relation, kind: "extracted",
        confidence: Math.max(0, Math.min(1, Number(c.confidence ?? 0.5))), confidence_basis: `openai_extraction:${x.model}`,
        props: { needs_review: true, extraction_id: x.id, model: x.model, polarity: c.polarity === "contradicts" ? "contradicts" : "supports", subject: c.subject, object: c.object, claim_index: i },
        evidence: [{ id: `ev:x-${x.id}-${i}`, source: "pubmed", external_id: `PMID:${x.pmid}`, url: `https://pubmed.ncbi.nlm.nih.gov/${x.pmid}/`, quote: c.quote ? String(c.quote).slice(0, 500) : null, published_on: null, retrieved_at: x.created_at }],
      });
      extracted++;
    });
  }

  /* Only entities that take part in at least one edge (retracted leftovers stay out) */
  const used = new Set(edges.flatMap((e) => [e.from, e.to]));
  const entities = [...ents.values()].filter((e) => used.has(e.id));
  normalize(entities, edges);

  const sources: AtlasSnapshot["sources"] = {};
  for (const s of sourceRows ?? []) sources[s.id] = { id: s.id, name: s.name, license: s.license, url: s.base_url, last_synced_at: s.last_synced_at } satisfies SourceInfo;
  const generated_at = evidenceRows.map((v) => v.retrieved_at).sort().at(-1) ?? new Date(0).toISOString();

  const proposals: Proposal[] = (proposalRows ?? []).map((p) => ({
    id: String(p.id), kind: p.kind, title: p.title, body: p.body, persona: p.persona ?? null, disease: p.disease ?? null,
    entities: p.entities ?? [], edges: p.edges ?? [], status: p.status, created_at: p.created_at,
  }));

  return { snapshot: { version: 1, generated_at, sources, entities, edges, analytics: null, proposals }, dropped, extracted };
}

/** Fills props the explorer relies on that the Edge Function does not always write (parity with data/atlas.json). */
function normalize(entities: Entity[], edges: Edge[]) {
  const byId = new Map(entities.map((e) => [e.id, e]));
  // Trials: asset kind (natural history / registry / biomarker / cohort / interventional), on the node and the studies edge.
  for (const e of entities.filter((x) => x.type === "trial" && !x.props.asset_kind)) e.props.asset_kind = classifyStudy(e.name, e.props.study_type as string | undefined);
  for (const e of edges.filter((x) => x.relation === "studies" && !x.props.asset_kind)) {
    const t = byId.get(e.from);
    if (t?.type === "trial") e.props = { ...e.props, asset_kind: t.props.asset_kind };
  }
  // Causal genes: mark `primary` when no edge of the disease carries the flag (seed gene, else strongest association).
  const causes = new Map<string, Edge[]>();
  for (const e of edges.filter((x) => x.relation === "causes")) causes.set(e.to, [...(causes.get(e.to) ?? []), e]);
  for (const [d, list] of causes) {
    if (list.some((e) => e.props.primary !== undefined)) continue;
    const seed = new Set(((byId.get(d)?.props.genes_seed as string[] | undefined) ?? []).map((s) => s.toUpperCase()));
    const bySeed = list.filter((e) => seed.has(String(byId.get(e.from)?.props.symbol ?? byId.get(e.from)?.name ?? "").toUpperCase()));
    const max = Math.max(...list.map((e) => e.confidence));
    const primary = bySeed.length ? bySeed : list.filter((e) => e.confidence === max);
    for (const e of list) e.props = { ...e.props, primary: primary.includes(e) };
  }
}

export function classifyStudy(title: string, studyType?: string) {
  if (/natural history|disease progression|trial readiness/i.test(title)) return "natural_history";
  if (/registry|registries|data ?base|biobank/i.test(title)) return "registry";
  if (/biomarker|outcome measure|endpoint|eeg|clinical outcome assessment/i.test(title)) return "biomarker_study";
  if (studyType === "OBSERVATIONAL") return "observational_cohort";
  return "interventional_trial";
}
