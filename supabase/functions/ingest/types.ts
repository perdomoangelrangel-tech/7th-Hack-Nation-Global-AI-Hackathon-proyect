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
}

export interface SeedOrganization {
  name: string;
  country: string;
  url: string;
  kind: "patient_org" | "research" | "clinic" | "pharma";
  diseases: string[];
}

export type EntityType =
  | "disease" | "gene" | "phenotype" | "variant" | "trial" | "study" | "treatment" | "organization";
export type Relation =
  | "causes" | "has_phenotype" | "has_variant" | "studies" | "treats" | "supports" | "researches" | "is_a";
export type SourceId =
  | "orphanet" | "hpo" | "monarch" | "clinvar" | "ctgov" | "opentargets" | "pubmed" | "patient_orgs";

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
