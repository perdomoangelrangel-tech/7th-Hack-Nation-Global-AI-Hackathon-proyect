/**
 * Consultas de lectura al grafo. Son las únicas que usan las herramientas del agente.
 * Toda función devuelve { data, evidence } y nunca texto libre.
 */
import { publicClient } from "./supabase/server";

export interface Evidence {
  id: string; source: string; external_id: string; url: string;
  quote: string | null; published_on: string | null; retrieved_at: string;
}
export interface EdgeRow {
  edge_id: string; relation: string; confidence: number; confidence_basis: string; edge_props: Record<string, unknown>;
  from_id: string; from_type: string; from_canonical_id: string; from_name: string; from_props: Record<string, unknown>;
  to_id: string; to_type: string; to_canonical_id: string; to_name: string; to_props: Record<string, unknown>;
  evidence: Evidence[];
}
export interface ToolResult<T> { data: T; evidence: Evidence[]; retrieved_at: string; note?: string }

const flatEvidence = (rows: EdgeRow[]) => rows.flatMap((r) => r.evidence);
const now = () => new Date().toISOString();

export async function findDisease(q: string) {
  const db = publicClient(); if (!db) return null;
  const byId = await db.from("entities").select("*").eq("type", "disease").eq("canonical_id", q).maybeSingle();
  if (byId.data) return byId.data;
  const byName = await db.from("entities").select("*").eq("type", "disease").ilike("name", `%${q}%`).limit(1).maybeSingle();
  if (byName.data) return byName.data;
  // Aliases also hold drug and phenotype synonyms, so restrict the alias match to disease entities.
  const alias = await db.from("entity_aliases").select("entity_id, entities!inner(type)")
    .eq("entities.type", "disease").ilike("alias", `%${q}%`).limit(1).maybeSingle();
  if (alias.data) return (await db.from("entities").select("*").eq("id", alias.data.entity_id).single()).data;
  return null;
}

async function edgesAround(entityId: string, relation?: string, direction: "in" | "out" | "both" = "both") {
  const db = publicClient(); if (!db) return [] as EdgeRow[];
  let q = db.from("edge_evidence").select("*");
  if (direction === "in") q = q.eq("to_id", entityId);
  else if (direction === "out") q = q.eq("from_id", entityId);
  else q = q.or(`from_id.eq.${entityId},to_id.eq.${entityId}`);
  if (relation) q = q.eq("relation", relation);
  const { data } = await q.order("confidence", { ascending: false }).limit(200);
  return (data ?? []) as EdgeRow[];
}

/** Ficha: enfermedad + genes + fenotipos + prevalencia. */
export async function diseaseProfile(q: string): Promise<ToolResult<unknown> | null> {
  const d = await findDisease(q); if (!d) return null;
  const genes = await edgesAround(d.id, "causes", "in");
  const phenotypes = await edgesAround(d.id, "has_phenotype", "out");
  const rows = [...genes, ...phenotypes];
  return {
    data: {
      disease: { id: d.id, canonical_id: d.canonical_id, name: d.name, props: d.props },
      genes: genes.map((e) => ({ symbol: e.from_name, canonical_id: e.from_canonical_id, association: e.edge_props, evidence_ids: e.evidence.map((x) => x.id) })),
      phenotypes: phenotypes.map((e) => ({ hpo: e.to_canonical_id, term: e.to_name, frequency: (e.edge_props as { frequency?: string })?.frequency ?? null, confidence: e.confidence, evidence_ids: e.evidence.map((x) => x.id) })),
    },
    evidence: flatEvidence(rows), retrieved_at: now(),
  };
}

export async function trialsFor(q: string, country?: string): Promise<ToolResult<unknown> | null> {
  const d = await findDisease(q); if (!d) return null;
  let rows = await edgesAround(d.id, "studies", "in");
  rows = rows.filter((r) => r.from_type === "trial");
  if (country) rows = rows.filter((r) => ((r.from_props as { countries?: string[] })?.countries ?? []).some((c) => c.toLowerCase().includes(country.toLowerCase())));
  return {
    data: rows.map((r) => ({ nct: r.from_canonical_id, title: r.from_name, ...r.from_props, confidence: r.confidence, evidence_ids: r.evidence.map((x) => x.id) })),
    evidence: flatEvidence(rows), retrieved_at: now(),
  };
}

/** Treatment edge props (see docs/DATA_SOURCES.md): phase (0-4), stage, status, approved_for_indication,
 *  investigational, origin ('opentargets' | 'clinicaltrials'), mechanism, intervention_type, nct_ids. */
interface TreatProps {
  phase?: number; stage?: string; status?: string; approved_for_indication?: boolean; investigational?: boolean;
  origin?: string; mechanism?: string; intervention_type?: string; nct_ids?: string[]; trial_status?: string; trial_phase?: number;
}

export async function treatmentsFor(q: string): Promise<ToolResult<unknown> | null> {
  const d = await findDisease(q); if (!d) return null;
  const rows = (await edgesAround(d.id, "treats", "in")).sort((a, b) => {
    const pa = a.edge_props as TreatProps; const pb = b.edge_props as TreatProps;
    return Number(!!pb.approved_for_indication) - Number(!!pa.approved_for_indication) || (pb.phase ?? 0) - (pa.phase ?? 0);
  });
  return {
    data: rows.map((r) => {
      const e = r.edge_props as TreatProps;
      return {
        id: r.from_canonical_id, name: r.from_name, ...r.from_props,
        phase: e.phase, stage: e.stage, status: e.status, origin: e.origin,
        approved_for_indication: e.approved_for_indication ?? false, investigational: e.investigational ?? !e.approved_for_indication,
        mechanism: e.mechanism ?? (r.from_props as { mechanism?: string })?.mechanism, intervention_type: e.intervention_type,
        nct_ids: e.nct_ids ?? [], trial_status: e.trial_status, trial_phase: e.trial_phase,
        confidence: r.confidence, evidence_ids: r.evidence.map((x) => x.id),
      };
    }),
    evidence: flatEvidence(rows), retrieved_at: now(),
    note: rows.length ? undefined : "No hay tratamientos documentados en nuestras fuentes para esta enfermedad.",
  };
}

export async function literatureFor(q: string, limit = 15): Promise<ToolResult<unknown> | null> {
  const d = await findDisease(q); if (!d) return null;
  const rows = (await edgesAround(d.id, "studies", "in")).filter((r) => r.from_type === "study")
    .sort((a, b) => (b.evidence[0]?.published_on ?? "").localeCompare(a.evidence[0]?.published_on ?? "")).slice(0, limit);
  return {
    data: rows.map((r) => ({ pmid: r.from_canonical_id, title: r.from_name, ...r.from_props, published_on: r.evidence[0]?.published_on, evidence_ids: r.evidence.map((x) => x.id) })),
    evidence: flatEvidence(rows), retrieved_at: now(),
  };
}

export async function communitiesFor(q: string): Promise<ToolResult<unknown> | null> {
  const d = await findDisease(q); if (!d) return null;
  const support = await edgesAround(d.id, "supports", "in");
  const research = await edgesAround(d.id, "researches", "in");
  const map = (r: EdgeRow) => ({ name: r.from_name, ...r.from_props, evidence_ids: r.evidence.map((x) => x.id) });
  // Researchers derived from PubMed authorship (source_ref = PMID of the paper) plus self-registered profiles.
  const db = publicClient()!;
  const { data: researchers } = await db.from("research_community")
    .select("name, affiliation, country, role, focus, orcid, source, source_ref, open_to_contact")
    .eq("disease_id", d.id).eq("public_profile", true).order("created_at", { ascending: false }).limit(30);
  return {
    data: { patient_organizations: support.map(map), research_communities: research.map(map), researchers: researchers ?? [] },
    evidence: flatEvidence([...support, ...research]), retrieved_at: now(),
  };
}

export async function gapsFor(q: string): Promise<ToolResult<unknown> | null> {
  const d = await findDisease(q); if (!d) return null;
  const db = publicClient()!;
  const { data } = await db.from("research_gaps").select("*").or(`from_id.eq.${d.id},to_id.eq.${d.id}`).limit(50);
  const treatments = await edgesAround(d.id, "treats", "in");
  // Approved for THIS disease (Open Targets max clinical stage = APPROVAL), not merely approved for something.
  const approved = treatments.filter((t) => (t.edge_props as TreatProps)?.approved_for_indication);
  return {
    data: { weak_edges: data ?? [], has_approved_treatment: approved.length > 0, approved_count: approved.length, treatment_candidates: treatments.length },
    evidence: flatEvidence(treatments), retrieved_at: now(),
  };
}

/** Diferencial por fenotipos HPO: cuenta coincidencias ponderadas por confianza. */
export async function phenotypeMatch(hpoIds: string[], limit = 10): Promise<ToolResult<unknown>> {
  const db = publicClient(); if (!db) return { data: [], evidence: [], retrieved_at: now() };
  const { data } = await db.from("edge_evidence").select("*").eq("relation", "has_phenotype").in("to_canonical_id", hpoIds);
  const rows = (data ?? []) as EdgeRow[];
  const score = new Map<string, { disease: string; canonical_id: string; score: number; matched: string[]; evidence_ids: string[] }>();
  for (const r of rows) {
    const s = score.get(r.from_id) ?? { disease: r.from_name, canonical_id: r.from_canonical_id, score: 0, matched: [], evidence_ids: [] };
    s.score += Number(r.confidence); s.matched.push(r.to_canonical_id); s.evidence_ids.push(...r.evidence.map((x) => x.id));
    score.set(r.from_id, s);
  }
  const ranked = [...score.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  return { data: ranked, evidence: flatEvidence(rows), retrieved_at: now() };
}
