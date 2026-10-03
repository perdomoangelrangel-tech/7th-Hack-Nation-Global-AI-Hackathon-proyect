/**
 * Formato del snapshot del grafo (data/atlas.json). Lo escribe la ingesta + el análisis
 * y lo leen la app y las herramientas del agente. Mismo modelo que supabase/migrations.
 */
export type EntityType =
  | "disease" | "gene" | "phenotype" | "variant" | "trial" | "study" | "treatment"
  | "organization" | "pathway" | "investigator";

export type Relation =
  | "causes"           // gene -> disease
  | "has_phenotype"    // disease -> phenotype
  | "has_variant"      // gene -> variant
  | "studies"          // trial|study -> disease
  | "treats"           // treatment -> disease
  | "supports"         // organization -> disease (grupo de pacientes)
  | "researches"       // organization|investigator -> disease
  | "participates_in"  // gene -> pathway (Reactome)
  | "is_a"             // phenotype -> phenotype (jerarquía HPO)
  | "similar_to";      // disease <-> disease (INFERIDA por el análisis, nunca observada)

export type SourceId =
  | "orphanet" | "hpo" | "monarch" | "clinvar" | "ctgov" | "opentargets" | "reactome"
  | "pubmed" | "nih_reporter" | "patient_orgs" | "atlas_analysis" | "openai_extraction";

/** observed: lo afirma una fuente. inferred: lo calcula el análisis a partir de aristas observadas. extracted: lo extrajo un LLM de un texto citado. */
export type EdgeKind = "observed" | "inferred" | "extracted";

export interface Evidence {
  id: string;
  source: SourceId;
  external_id: string;
  url: string;
  quote: string | null;
  published_on: string | null;
  retrieved_at: string;
}

export interface Entity {
  id: string;                  // `${type}:${canonical_id}`, estable entre corridas
  type: EntityType;
  canonical_id: string;
  name: string;
  props: Record<string, unknown>;
  aliases: { alias: string; lang: string }[];
}

export interface Edge {
  id: string;
  from: string;                // Entity.id
  to: string;
  relation: Relation;
  kind: EdgeKind;
  confidence: number;          // 0..1
  confidence_basis: string;
  props: Record<string, unknown>;
  evidence: Evidence[];        // >= 1 siempre; una arista sin evidencia no entra al snapshot
}

export interface SourceInfo { id: SourceId; name: string; license: string; url: string; last_synced_at: string | null }

export interface Cluster {
  id: string;
  label: string;               // nombre del mecanismo compartido
  label_basis: string;         // por qué se llama así (pathways / fenotipos dominantes)
  color: string;
  diseases: string[];          // Entity.id
  shared_pathways: { id: string; name: string; diseases: number }[];
  shared_phenotypes: { id: string; name: string; ic: number; diseases: number }[];
}

export interface SimilarityExplanation {
  score: number;               // 0..1 combinado
  phenotype_score: number;
  pathway_score: number;
  variant_effect_match: boolean | null;
  shared_phenotypes: { id: string; name: string; ic: number }[];
  shared_pathways: { id: string; name: string }[];
  shared_genes: string[];
  supporting_edges: string[];  // Edge.id de las aristas observadas que sostienen la inferencia
}

export interface Bridge {
  entity: string;              // investigator | organization | sponsor (Entity.id o "sponsor:<nombre>")
  name: string;
  kind: "investigator" | "organization" | "sponsor";
  diseases: string[];
  clusters: string[];
  cross_cluster: boolean;
  edges: string[];             // Edge.id que lo conectan
}

export interface Gap {
  disease: string;
  kind: "no_approved_treatment" | "no_natural_history" | "no_registry" | "no_nih_funding" | "no_patient_group" | "few_phenotypes" | "no_active_trial";
  detail: string;
  what_would_change_it: string;
}

export interface Analytics {
  generated_at: string;
  method: string;
  phenotype_ic_reference: { total_diseases: number; source: string };
  clusters: Cluster[];
  disease_cluster: Record<string, string>;
  centrality: Record<string, number>;               // 0..100
  /** Por enfermedad (Entity.id): el mismo gen puede actuar distinto en enfermedades distintas. */
  variant_effect: Record<string, { gene: string; lof_fraction: number; missense_fraction: number; n: number; call: string; basis: string; edge: string }>;
  similarity: Record<string, SimilarityExplanation>; // clave = Edge.id de similar_to
  bridges: Bridge[];
  gaps: Gap[];
  counterexamples: { a: string; b: string; why: string; shared_phenotypes: string[] }[];
}

export interface AtlasSnapshot {
  version: 1;
  generated_at: string;
  sources: Partial<Record<SourceId, SourceInfo>>;
  entities: Entity[];
  edges: Edge[];
  analytics: Analytics | null;
}
