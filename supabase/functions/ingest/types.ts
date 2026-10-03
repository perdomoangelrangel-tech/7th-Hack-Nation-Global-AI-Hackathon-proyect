import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { Batch } from "./graph.ts";

export interface SeedDisease {
  slug: string;            // dravet | rett | ... (cron job names)
  orpha: string;           // ORPHA:33069
  mondo: string;           // MONDO:0011122
  efo: string;             // MONDO_0011122 (Open Targets format)
  name: string;
  name_es: string;
  genes: string[];         // HGNC symbols
  hgnc?: Record<string, string>; // symbol -> HGNC:id
  search_terms: string[];
  trial_keywords?: string[];     // a trial must mention one of these in its title or conditions
  omim?: string;                 // OMIM:607208 (exact Orphanet mapping)
  clinvar_disease?: string;      // ClinVar / MedGen trait name, scopes the per-disease variant counts
  short_name?: string;           // label for the graph and the voice ("STXBP1-DEE")
  short_name_es?: string;
  opentargets_indexed?: boolean; // false when Open Targets does not index the MONDO id
}

export interface SeedOrganization {
  name: string;
  country: string;
  url: string;
  kind: "patient_org" | "research" | "clinic" | "pharma" | "umbrella";
  diseases: string[];
  registry?: string;       // patient registry URL when the organization publishes one
}

/** Curated regulatory approval tied to an official agency URL (supabase/seed/approvals.json). */
export interface SeedApproval {
  orpha: string;
  treatment_id: string;      // CHEMBL id (verified) of the treatment entity
  treatment_name: string;
  trade_name?: string;
  agency: string;            // FDA
  date: string;              // YYYY-MM
  published_on?: string;     // only when the official page shows it
  indication: string;
  external_id: string;
  url: string;
  quote: string;
  verified?: string;         // how/when the URL and ids were checked
}

export type EntityType =
  | "disease" | "gene" | "phenotype" | "variant" | "trial" | "study" | "treatment" | "organization"
  | "pathway" | "investigator";                       // migration 0011
export type Relation =
  | "causes" | "has_phenotype" | "has_variant" | "studies" | "treats" | "supports" | "researches" | "is_a"
  | "participates_in";                                // migration 0011
export type SourceId =
  | "orphanet" | "hpo" | "monarch" | "clinvar" | "ctgov" | "opentargets" | "pubmed" | "patient_orgs" | "fda"
  | "reactome" | "nih_reporter";                      // migration 0011

export interface EntityRef {
  type: EntityType;
  canonicalId: string;
  name: string;
  props?: Record<string, unknown>;
}

export interface EvidenceInput {
  source: SourceId;
  externalId: string;
  url: string;
  quote?: string | null;
  publishedOn?: string | null;
}

export interface EdgeInput {
  from: EntityRef;
  to: EntityRef;
  relation: Relation;
  confidence?: number;
  confidenceBasis?: string;
  props?: Record<string, unknown>;
  evidence: EvidenceInput[];
}

export interface Ctx {
  db: SupabaseClient;
  batch: Batch;
  dry: boolean;
  deadline: number;               // epoch ms; steps must stop before it
  sample: (name: string, data: unknown) => void;
  note: (msg: string) => void;    // warnings returned in the response
  extra: Record<string, number>;  // extra counters (e.g. community rows)
  params: Record<string, unknown>; // raw request body (debug options for dry runs)
}
