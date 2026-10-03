/**
 * Helpers de escritura al grafo. Idempotentes: correr dos veces no duplica.
 * Solo este archivo escribe en entities/edges/evidence; las fuentes lo usan.
 */
import { createClient } from "@supabase/supabase-js";

export type EntityType =
  | "disease" | "gene" | "phenotype" | "variant" | "trial" | "study" | "treatment" | "organization";

export type Relation =
  | "causes" | "has_phenotype" | "has_variant" | "studies" | "treats" | "supports" | "researches" | "is_a";

export type SourceId =
  | "orphanet" | "hpo" | "monarch" | "clinvar" | "ctgov" | "opentargets" | "pubmed" | "patient_orgs";

export interface EvidenceInput {
  source: SourceId;
  externalId: string;
  url: string;
  quote?: string;
  publishedOn?: string; // YYYY-MM-DD
}

export interface EdgeInput {
  from: { type: EntityType; canonicalId: string; name: string; props?: Record<string, unknown> };
  to:   { type: EntityType; canonicalId: string; name: string; props?: Record<string, unknown> };
  relation: Relation;
  confidence?: number;
  confidenceBasis?: string;
  props?: Record<string, unknown>;
  evidence: EvidenceInput[]; // >= 1, si no, la arista queda pending y no se muestra
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  return createClient(url, key, { auth: { persistSession: false } });
}

export class Graph {
  private db = admin();
  private cache = new Map<string, string>();
  stats = { entities: 0, edges: 0, evidence: 0, skipped: 0 };

  async upsertEntity(e: EdgeInput["from"]): Promise<string> {
    const key = `${e.type}:${e.canonicalId}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const { data, error } = await this.db
      .from("entities")
      .upsert(
        { type: e.type, canonical_id: e.canonicalId, name: e.name, props: e.props ?? {}, updated_at: new Date().toISOString() },
        { onConflict: "type,canonical_id" },
      )
      .select("id")
      .single();
    if (error) throw error;
    this.cache.set(key, data.id);
    this.stats.entities++;
    return data.id;
  }

  async addAlias(entityId: string, alias: string, lang = "en") {
    await this.db.from("entity_aliases").upsert({ entity_id: entityId, alias, lang }, { onConflict: "entity_id,alias,lang" });
  }

  async upsertEdge(input: EdgeInput): Promise<string | null> {
    if (!input.evidence.length) { this.stats.skipped++; return null; }
    const fromId = await this.upsertEntity(input.from);
    const toId = await this.upsertEntity(input.to);
    const { data: edge, error } = await this.db
      .from("edges")
      .upsert(
        {
          from_id: fromId, to_id: toId, relation: input.relation,
          confidence: input.confidence ?? 0.5,
          confidence_basis: input.confidenceBasis ?? "source_default",
          props: input.props ?? {}, updated_at: new Date().toISOString(),
        },
        { onConflict: "from_id,to_id,relation" },
      )
      .select("id")
      .single();
    if (error) throw error;
    this.stats.edges++;
    const rows = input.evidence.map((ev) => ({
      edge_id: edge.id, source_id: ev.source, external_id: ev.externalId, url: ev.url,
      quote: ev.quote ?? null, published_on: ev.publishedOn ?? null, retrieved_at: new Date().toISOString(),
    }));
    const { error: evErr } = await this.db.from("evidence").upsert(rows, { onConflict: "edge_id,source_id,external_id" });
    if (evErr) throw evErr;
    this.stats.evidence += rows.length;
    return edge.id;
  }

  async markSynced(source: SourceId) {
    await this.db.from("sources").update({ last_synced_at: new Date().toISOString() }).eq("id", source);
  }
}

/** fetch con reintentos y pausa (para respetar 3 req/s de NCBI). */
export async function getJSON<T>(url: string, init?: RequestInit, retries = 3): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url, { ...init, headers: { accept: "application/json", ...(init?.headers ?? {}) } });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 429 || res.status >= 500) { await sleep(500 * (i + 1)); continue; }
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  throw new Error(`gave up on ${url}`);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const today = () => new Date().toISOString().slice(0, 10);
