/**
 * Graph snapshot format (CONTRACT, docs/WORKFLOW.md §3.1). Produced by src/lib/atlas/source.ts (live Supabase)
 * or data/atlas.json (bundled), read by the app and the agent tools. Same model as supabase/migrations.
 * Changes are additive only and announced with a CONTRACT entry in the bitácora.
 */
export type EntityType =
  | "disease" | "gene" | "phenotype" | "variant" | "trial" | "study" | "treatment"
  | "organization" | "pathway" | "investigator"
  | "mechanism";       // INFERRED variant-effect class (loss vs gain/altered function), computed by analyze()

export type Relation =
  | "causes"           // gene -> disease
  | "has_phenotype"    // disease -> phenotype
  | "has_variant"      // gene -> variant
  | "studies"          // trial|study -> disease
  | "treats"           // treatment -> disease
  | "supports"         // organization -> disease (patient group)
  | "researches"       // organization|investigator -> disease
  | "participates_in"  // gene -> pathway (Reactome)
  | "is_a"             // phenotype -> phenotype (HPO hierarchy)
  | "similar_to"       // disease <-> disease (INFERRED by the analysis, never observed)
  | "has_mechanism";   // disease -> mechanism (INFERRED from the disease's ClinVar variant profile)

export type SourceId =
  | "orphanet" | "hpo" | "monarch" | "clinvar" | "ctgov" | "opentargets" | "reactome"
  | "pubmed" | "nih_reporter" | "patient_orgs" | "fda"
  | "atlas_analysis"     // legacy id of nexmed_analysis in older snapshots
  | "nexmed_analysis" | "openai_extraction" | "community";

/**
 * observed: a source states it (solid line). inferred: Nedamex analysis computed it from observed edges (dashed).
 * extracted: OpenAI pulled it from a cited paper, needs expert review (dotted). proposed: community draft, never evidence (ghost).
 */
export type EdgeKind = "observed" | "inferred" | "extracted" | "proposed";

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
  id: string;                  // `${type}:${canonical_id}`, stable across runs
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
  evidence: Evidence[];        // >= 1 for observed / inferred / extracted; an edge without evidence never enters the snapshot
}

export interface SourceInfo { id: SourceId; name: string; license: string; url: string; last_synced_at: string | null }

export interface Cluster {
  id: string;
  label: string;               // name of the shared mechanism
  label_basis: string;         // why it is called that (dominant pathway / phenotype, with counts)
  color: string;
  diseases: string[];          // Entity.id
  shared_pathways: { id: string; name: string; diseases: number }[];
  shared_phenotypes: { id: string; name: string; ic: number; diseases: number }[];
  /** Orphanet classification groups shared by >= half of the members (>= 2), e.g. "Lysosomal disease". */
  orphanet_groups?: { orpha: string; name: string; diseases: number }[];
  /** Search terms for the cluster: its label + those groups' names and Orphanet synonyms ("lysosomal storage disease"). */
  aliases?: string[];
}

export interface SimilarityExplanation {
  score: number;               // 0..1 combined
  phenotype_score: number;
  pathway_score: number;
  variant_effect_match: boolean | null;
  shared_phenotypes: { id: string; name: string; ic: number }[];
  shared_pathways: { id: string; name: string }[];
  shared_genes: string[];
  supporting_edges: string[];  // Edge.id of the observed edges behind the inference
}

export interface Bridge {
  entity: string;              // investigator | organization | sponsor (Entity.id or "sponsor:<name>")
  name: string;
  kind: "investigator" | "organization" | "sponsor";
  diseases: string[];
  clusters: string[];
  cross_cluster: boolean;
  edges: string[];             // Edge.id that connect it
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
  /** Per disease (Entity.id): the same gene can act differently in different diseases. */
  variant_effect: Record<string, { gene: string; lof_fraction: number; missense_fraction: number; n: number; call: string; basis: string; edge: string }>;
  similarity: Record<string, SimilarityExplanation>; // key = Edge.id of the similar_to edge
  bridges: Bridge[];
  gaps: Gap[];
  counterexamples: Counterexample[];
}

export interface Counterexample {
  a: string; b: string; why: string; shared_phenotypes: string[];
  /** same_symptoms_different_mechanism (older snapshots omit it) | same_gene_different_mechanism */
  kind?: "same_symptoms_different_mechanism" | "same_gene_different_mechanism";
  gene?: string;               // shared gene symbol (same_gene_different_mechanism)
  edges?: string[];            // the causes edges that carry each disease's variant effect
}

/** Community draft (Supabase `proposals_public`). Overlay data: never evidence, never mixed into edges[].evidence. */
export interface Proposal {
  id: string;
  kind: "hypothesis" | "collaboration" | "evidence";
  title: string;
  body: string;
  persona: string | null;
  disease: string | null;      // Entity.id
  entities: string[];          // Entity.id
  edges: string[];             // Edge.id
  status: "draft" | "under_review" | "accepted";
  created_at: string;
}

export interface AtlasSnapshot {
  version: 1;
  generated_at: string;
  sources: Partial<Record<SourceId, SourceInfo>>;
  entities: Entity[];
  edges: Edge[];
  analytics: Analytics | null;
  /** Community drafts (kind "proposed" overlay). Absent in the bundled file snapshot. */
  proposals?: Proposal[];
}
