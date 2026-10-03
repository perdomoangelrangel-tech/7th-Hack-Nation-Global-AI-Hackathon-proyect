/**
 * Escritura al grafo. Idempotente: correr dos veces no duplica.
 * Dos destinos con la misma interfaz:
 *   FileGraph      -> data/atlas.json (por defecto; lo que se versiona y lo que lee la app)
 *   SupabaseGraph  -> Postgres (camino a escala, ver supabase/migrations)
 * Solo este archivo escribe entidades/aristas/evidencia; las fuentes lo usan.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AtlasSnapshot, Edge, EdgeKind, Entity, EntityType, Relation, SourceId, SourceInfo } from "../../src/lib/atlas/types";

export type { EntityType, Relation, SourceId };

export interface EvidenceInput {
  source: SourceId;
  externalId: string;
  url: string;
  quote?: string;
  publishedOn?: string; // YYYY-MM-DD
}

export interface NodeInput { type: EntityType; canonicalId: string; name: string; props?: Record<string, unknown> }

export interface EdgeInput {
  from: NodeInput;
  to: NodeInput;
  relation: Relation;
  kind?: EdgeKind;
  confidence?: number;
  confidenceBasis?: string;
  props?: Record<string, unknown>;
  evidence: EvidenceInput[]; // >= 1; sin evidencia la arista no se escribe
}

export interface GraphWriter {
  stats: { entities: number; edges: number; evidence: number; skipped: number };
  upsertEntity(e: NodeInput): Promise<string>;
  addAlias(entityId: string, alias: string, lang?: string): Promise<void>;
  upsertEdge(input: EdgeInput): Promise<string | null>;
  markSynced(source: SourceId): Promise<void>;
  listEntities(type: EntityType): Promise<{ id: string; canonical_id: string; name: string; props: Record<string, unknown> }[]>;
  save(): Promise<void>;
}

export const SOURCES: Record<SourceId, Omit<SourceInfo, "last_synced_at">> = {
  orphanet:          { id: "orphanet", name: "Orphanet / Orphadata", license: "CC BY 4.0", url: "https://api.orphadata.com" },
  hpo:               { id: "hpo", name: "Human Phenotype Ontology", license: "HPO license", url: "https://ontology.jax.org/api/hp" },
  monarch:           { id: "monarch", name: "Monarch Initiative", license: "CC BY 4.0", url: "https://api-v3.monarchinitiative.org" },
  clinvar:           { id: "clinvar", name: "ClinVar (NCBI)", license: "Public domain", url: "https://www.ncbi.nlm.nih.gov/clinvar" },
  ctgov:             { id: "ctgov", name: "ClinicalTrials.gov", license: "Public domain", url: "https://clinicaltrials.gov/api/v2" },
  opentargets:       { id: "opentargets", name: "Open Targets Platform", license: "CC0", url: "https://platform.opentargets.org" },
  reactome:          { id: "reactome", name: "Reactome (vía Open Targets)", license: "CC BY 4.0", url: "https://reactome.org" },
  pubmed:            { id: "pubmed", name: "PubMed (NCBI E-utilities)", license: "Public domain", url: "https://pubmed.ncbi.nlm.nih.gov" },
  nih_reporter:      { id: "nih_reporter", name: "NIH RePORTER", license: "Public domain", url: "https://reporter.nih.gov" },
  patient_orgs:      { id: "patient_orgs", name: "Organizaciones de pacientes (curado, sitio oficial)", license: "Public data", url: "supabase/seed/organizations.json" },
  atlas_analysis:    { id: "atlas_analysis", name: "Análisis del atlas (inferido)", license: "MIT", url: "scripts/analyze.ts" },
  openai_extraction: { id: "openai_extraction", name: "Extracción con OpenAI sobre abstracts citados", license: "Derivado de PubMed", url: "scripts/extract.ts" },
};

const now = () => new Date().toISOString();
export const entityKey = (type: EntityType, canonicalId: string) => `${type}:${canonicalId}`;
export const shortHash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 12);

/* ------------------------------------------------------------------ */
/* Snapshot local                                                      */
/* ------------------------------------------------------------------ */
export class FileGraph implements GraphWriter {
  stats = { entities: 0, edges: 0, evidence: 0, skipped: 0 };
  private entities = new Map<string, Entity>();
  private edges = new Map<string, Edge>();
  private snapshot: AtlasSnapshot;

  constructor(private path = "data/atlas.json", fresh = false) {
    this.snapshot = !fresh && existsSync(path)
      ? (JSON.parse(readFileSync(path, "utf8")) as AtlasSnapshot)
      : { version: 1, generated_at: now(), sources: {}, entities: [], edges: [], analytics: null };
    for (const e of this.snapshot.entities) this.entities.set(e.id, e);
    for (const e of this.snapshot.edges) this.edges.set(e.id, e);
  }

  async upsertEntity(n: NodeInput) {
    const id = entityKey(n.type, n.canonicalId);
    const hit = this.entities.get(id);
    if (hit) {
      hit.props = { ...hit.props, ...stripUndefined(n.props ?? {}) };
      if (n.name && n.name !== n.canonicalId) hit.name = n.name;
    } else {
      this.entities.set(id, { id, type: n.type, canonical_id: n.canonicalId, name: n.name, props: stripUndefined(n.props ?? {}), aliases: [] });
      this.stats.entities++;
    }
    return id;
  }

  async addAlias(entityId: string, alias: string, lang = "en") {
    const e = this.entities.get(entityId); if (!e || !alias) return;
    if (!e.aliases.some((a) => a.alias.toLowerCase() === alias.toLowerCase() && a.lang === lang)) e.aliases.push({ alias, lang });
  }

  async upsertEdge(input: EdgeInput) {
    if (!input.evidence.length) { this.stats.skipped++; return null; }
    const from = await this.upsertEntity(input.from);
    const to = await this.upsertEntity(input.to);
    // Una arista extraída o inferida nunca se fusiona con la observada del mismo par: su tipo forma parte del id.
    const kind = input.kind ?? "observed";
    const id = `edge:${shortHash(`${from}|${input.relation}|${to}${kind === "observed" ? "" : `|${kind}`}`)}`;
    const evidence = input.evidence.map((ev) => ({
      id: `ev:${shortHash(`${id}|${ev.source}|${ev.externalId}`)}`,
      source: ev.source, external_id: ev.externalId, url: ev.url,
      quote: ev.quote ?? null, published_on: ev.publishedOn ?? null, retrieved_at: now(),
    }));
    const hit = this.edges.get(id);
    if (hit) {
      hit.confidence = input.confidence ?? hit.confidence;
      hit.props = { ...hit.props, ...stripUndefined(input.props ?? {}) };
      for (const ev of evidence) {
        const i = hit.evidence.findIndex((x) => x.id === ev.id);
        if (i >= 0) hit.evidence[i] = ev; else hit.evidence.push(ev);
      }
    } else {
      this.edges.set(id, {
        id, from, to, relation: input.relation, kind: input.kind ?? "observed",
        confidence: input.confidence ?? 0.5, confidence_basis: input.confidenceBasis ?? "source_default",
        props: stripUndefined(input.props ?? {}), evidence,
      });
      this.stats.edges++;
    }
    this.stats.evidence += evidence.length;
    return id;
  }

  async markSynced(source: SourceId) {
    this.snapshot.sources[source] = { ...SOURCES[source], last_synced_at: now() };
  }

  async listEntities(type: EntityType) {
    return [...this.entities.values()].filter((e) => e.type === type);
  }

  /** Quita las aristas inferidas para recalcularlas (lo usa analyze.ts). */
  dropEdges(pred: (e: Edge) => boolean) { for (const [k, e] of this.edges) if (pred(e)) this.edges.delete(k); }
  /** Inserta una arista ya construida (aristas inferidas por el análisis, con su propia evidencia). */
  putEdge(e: Edge) { if (e.evidence.length) this.edges.set(e.id, e); }
  allEntities() { return [...this.entities.values()]; }
  allEdges() { return [...this.edges.values()]; }
  get data() { return this.snapshot; }

  async save() {
    this.snapshot.generated_at = now();
    this.snapshot.entities = [...this.entities.values()].sort((a, b) => a.id.localeCompare(b.id));
    this.snapshot.edges = [...this.edges.values()].filter((e) => e.evidence.length > 0).sort((a, b) => a.id.localeCompare(b.id));
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.snapshot));
  }
}

/* ------------------------------------------------------------------ */
/* Supabase (camino a escala)                                          */
/* ------------------------------------------------------------------ */
export class SupabaseGraph implements GraphWriter {
  stats = { entities: 0, edges: 0, evidence: 0, skipped: 0 };
  private db: SupabaseClient;
  private cache = new Map<string, string>();

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
    this.db = createClient(url, key, { auth: { persistSession: false } });
  }

  async upsertEntity(e: NodeInput) {
    const key = entityKey(e.type, e.canonicalId);
    const hit = this.cache.get(key);
    if (hit) return hit;
    const { data, error } = await this.db.from("entities")
      .upsert({ type: e.type, canonical_id: e.canonicalId, name: e.name, props: e.props ?? {}, updated_at: now() }, { onConflict: "type,canonical_id" })
      .select("id").single();
    if (error) throw error;
    this.cache.set(key, data.id);
    this.stats.entities++;
    return data.id as string;
  }

  async addAlias(entityId: string, alias: string, lang = "en") {
    await this.db.from("entity_aliases").upsert({ entity_id: entityId, alias, lang }, { onConflict: "entity_id,alias,lang" });
  }

  async upsertEdge(input: EdgeInput) {
    if (!input.evidence.length) { this.stats.skipped++; return null; }
    const fromId = await this.upsertEntity(input.from);
    const toId = await this.upsertEntity(input.to);
    const { data: edge, error } = await this.db.from("edges")
      .upsert({
        from_id: fromId, to_id: toId, relation: input.relation,
        confidence: input.confidence ?? 0.5, confidence_basis: input.confidenceBasis ?? "source_default",
        kind: input.kind ?? "observed", props: input.props ?? {}, updated_at: now(), // columna kind: migración 0003
      }, { onConflict: "from_id,to_id,relation" })
      .select("id").single();
    if (error) throw error;
    this.stats.edges++;
    const rows = input.evidence.map((ev) => ({
      edge_id: edge.id, source_id: ev.source, external_id: ev.externalId, url: ev.url,
      quote: ev.quote ?? null, published_on: ev.publishedOn ?? null, retrieved_at: now(),
    }));
    const { error: evErr } = await this.db.from("evidence").upsert(rows, { onConflict: "edge_id,source_id,external_id" });
    if (evErr) throw evErr;
    this.stats.evidence += rows.length;
    return edge.id as string;
  }

  async markSynced(source: SourceId) {
    await this.db.from("sources").update({ last_synced_at: now() }).eq("id", source);
  }

  async listEntities(type: EntityType) {
    const { data } = await this.db.from("entities").select("id, canonical_id, name, props").eq("type", type);
    return data ?? [];
  }

  async save() { /* cada upsert ya se escribió */ }
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */
/** fetch con reintentos y pausa (para respetar 3 req/s de NCBI). */
export async function getJSON<T>(url: string, init?: RequestInit, retries = 3): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    // Algunas APIs (Open Targets detrás de un WAF) responden 403 a peticiones sin user-agent.
    const res = await fetch(url, { ...init, headers: { accept: "application/json", "user-agent": USER_AGENT, ...(init?.headers ?? {}) } });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 429 || res.status >= 500) { await sleep(800 * (i + 1)); continue; }
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  throw new Error(`gave up on ${url}`);
}

/** GraphQL que falla en voz alta: si la API cambia su esquema, la ingesta lo dice en vez de devolver cero filas. */
export async function graphql<T>(endpoint: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await getJSON<{ data?: T; errors?: { message: string }[] }>(endpoint, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, variables }),
  });
  if (res.errors?.length) throw new Error(`GraphQL: ${res.errors.map((e) => e.message).join("; ")}`);
  return res.data as T;
}

export const USER_AGENT = "rare-atlas-ingest/1.0 (+https://github.com/perdomoangelrangel-tech/7th-Hack-Nation-Global-AI-Hackathon-proyect)";
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const today = () => new Date().toISOString().slice(0, 10);

function stripUndefined(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}
