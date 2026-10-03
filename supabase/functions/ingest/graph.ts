// Batched, idempotent graph writer. Collects entities / edges / evidence / aliases in memory
// and flushes them through the SQL function public.ingest_upsert() (service role only).
// Props are merged server-side (existing || new); null/undefined values are dropped so they never wipe data.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { EdgeInput, EntityRef, EntityType } from "./types.ts";
import { isoDate } from "./http.ts";

type Json = Record<string, unknown>;

function clean(o: Json | undefined): Json {
  const out: Json = {};
  for (const [k, v] of Object.entries(o ?? {})) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out;
}

const round2 = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 100) / 100;

export interface FlushCounts { entities: number; edges: number; evidence: number; aliases: number }

export class Batch {
  private entities = new Map<string, { type: EntityType; canonical_id: string; name: string; props: Json }>();
  private edges = new Map<string, Json & { evidence: Json[] }>();
  private aliases = new Map<string, { type: EntityType; canonical_id: string; alias: string; lang: string }>();
  skipped = 0;

  entity(e: EntityRef) {
    const k = `${e.type}|${e.canonicalId}`;
    const prev = this.entities.get(k);
    this.entities.set(k, {
      type: e.type,
      canonical_id: e.canonicalId,
      name: (e.name || prev?.name || e.canonicalId).slice(0, 500),
      props: { ...(prev?.props ?? {}), ...clean(e.props) },
    });
  }

  alias(ref: { type: EntityType; canonicalId: string }, alias: string | undefined | null, lang = "en") {
    const a = (alias ?? "").trim().slice(0, 300);
    if (!a) return;
    this.aliases.set(`${ref.type}|${ref.canonicalId}|${a.toLowerCase()}|${lang}`, { type: ref.type, canonical_id: ref.canonicalId, alias: a, lang });
  }

  edge(input: EdgeInput) {
    const evidence = input.evidence.filter((ev) => ev && ev.url && ev.externalId);
    if (!evidence.length) { this.skipped++; return; }   // no evidence => the edge is not written at all
    this.entity(input.from);
    this.entity(input.to);
    const k = `${input.from.type}|${input.from.canonicalId}|${input.to.type}|${input.to.canonicalId}|${input.relation}`;
    const prev = this.edges.get(k);
    const ev = new Map<string, Json>((prev?.evidence ?? []).map((x) => [`${x.source_id}|${x.external_id}`, x]));
    for (const e of evidence) {
      ev.set(`${e.source}|${e.externalId}`, {
        source_id: e.source,
        external_id: e.externalId,
        url: e.url,
        quote: e.quote ? String(e.quote).slice(0, 500) : null,
        published_on: isoDate(e.publishedOn ?? undefined) ?? null,
      });
    }
    this.edges.set(k, {
      from_type: input.from.type, from_cid: input.from.canonicalId,
      to_type: input.to.type, to_cid: input.to.canonicalId,
      relation: input.relation,
      confidence: round2(input.confidence ?? (prev?.confidence as number | undefined) ?? 0.5),
      confidence_basis: input.confidenceBasis ?? (prev?.confidence_basis as string | undefined) ?? "source_default",
      props: { ...((prev?.props as Json) ?? {}), ...clean(input.props) },
      evidence: [...ev.values()],
    });
  }

  get pending() { return { entities: this.entities.size, edges: this.edges.size, aliases: this.aliases.size }; }

  /** Preview of what would be written (dry runs). */
  preview(n = 5) {
    return {
      entities: [...this.entities.values()].slice(0, n),
      edges: [...this.edges.values()].slice(0, n),
      counts: this.pending,
    };
  }

  async flush(db: SupabaseClient): Promise<FlushCounts> {
    const total: FlushCounts = { entities: 0, edges: 0, evidence: 0, aliases: 0 };
    const add = (r: Partial<FlushCounts> | null) => {
      if (!r) return;
      total.entities += r.entities ?? 0; total.edges += r.edges ?? 0;
      total.evidence += r.evidence ?? 0; total.aliases += r.aliases ?? 0;
    };
    const call = async (p_entities: unknown[], p_edges: unknown[], p_aliases: unknown[]) => {
      const { data, error } = await db.rpc("ingest_upsert", { p_entities, p_edges, p_aliases });
      if (error) throw new Error(`ingest_upsert: ${error.message} ${error.details ?? ""}`);
      add(data as FlushCounts);
    };
    const chunks = <T>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

    for (const c of chunks([...this.entities.values()], 400)) await call(c, [], []);
    for (const c of chunks([...this.edges.values()], 250)) await call([], c, []);
    for (const c of chunks([...this.aliases.values()], 500)) await call([], [], c);

    this.entities.clear(); this.edges.clear(); this.aliases.clear();
    return total;
  }
}
