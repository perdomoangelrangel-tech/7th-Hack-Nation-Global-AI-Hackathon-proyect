/**
 * AI-lane HTTP contract (WORKFLOW §3.2) as plain types + one URL helper. No imports:
 * safe to copy into any client (the Lovable program, the voice agent tools).
 */
export type AiMode = "openai" | "deterministic";
export type Kind = "observed" | "inferred" | "extracted" | "gap";
export type PersonaKey = "devon" | "maria" | "osei" | "priya";

export interface EvidenceRef { id: string; source: string; external_id: string; url: string; quote: string | null; published_on: string | null; retrieved_at: string }

/** POST /api/explain */
export interface ExplainRequestBody { edgeIds: string[]; persona: PersonaKey; locale: "en" | "es"; simple?: boolean; question?: string }
export interface ExplainResponse {
  sentences: { text: string; edge_ids: string[]; evidence_ids: string[]; kind: Kind }[];
  dropped: { text: string; reason: string }[];
  mode: AiMode;
  model?: string;
  simple: boolean;
  unknown_edge_ids: string[];
  skipped_edge_ids: string[];
  spoken: string;
  disclaimer: string;
}

/** POST /api/ask */
export interface AskRequestBody { question: string; persona: PersonaKey; locale: "en" | "es"; focus?: string; simple?: boolean; /** Chat: previous turns, oldest first (last 10 used). */ history?: { role: "user" | "assistant"; text: string }[] }
export interface AskClaim { text: string; evidence_ids: string[]; evidence: EvidenceRef[]; status: string; nodes: string[]; edges: string[] }
export type SafetyFlag = "dose" | "prognosis" | "promise" | "personal_data";
export interface AskAnswer {
  question: string;
  persona: PersonaKey;
  disease: string | null;
  disease_name: string | null;
  resolved_via: { mention: string; entity_id: string; type: string; method: string; matched_synonym: string | null } | null;
  claims: AskClaim[];
  dropped: { text: string; reason: string }[];
  mode: AiMode;
  model: string | null;
  simple: boolean;
  notice: string | null;
  safety_flags: SafetyFlag[];
  spoken: string;
  verified: boolean;
  disclaimer: string;
}

/** POST /api/extract */
export type ExtractType = "gene" | "variant" | "phenotype" | "disease" | "pathway" | "investigator" | "treatment";
export type MatchKind = "exact" | "alias" | "fuzzy" | "llm" | "new";
export interface ExtractedEntity { mention: string; type: ExtractType; entity_id: string | null; canonical_id: string | null; label: string | null; match: MatchKind; confidence: number }
export interface ExtractedClaim {
  subject: string;
  /** No "treats": treatment findings are `studied_for` + qualifier and never become graph edges. */
  relation: "causes" | "has_phenotype" | "has_variant" | "studied_for" | "participates_in" | "researches";
  /** For studied_for: what kind of evidence the quote is. "none" for every other relation. */
  qualifier: "reported_response" | "clinical_trial" | "preclinical" | "proposed" | "approved_indication" | "none";
  object: string;
  polarity: "supports" | "contradicts";
  quote: string;
  confidence: number;
  entity_ids: (string | null)[];
  /** Both ends resolved to atlas entities: the loader will draw it as a dotted "extracted" edge once saved. */
  graphable: boolean;
}
export interface ExtractResult {
  source: { pmid?: string; url?: string; title?: string };
  entities: ExtractedEntity[];
  claims: ExtractedClaim[];
  dropped: { text: string; reason: "mention_not_in_text" | "quote_not_in_text" | "quote_not_about_claim" | "wrong_entity_types" | "unknown_entity" }[];
  saved: boolean;
  save_note?: string;
  extraction_id?: string;
  mode: AiMode;
  model?: string;
}

/** POST /api/reconcile */
export type MatchMethod = "canonical_id" | "exact" | "alias" | "normalized" | "fuzzy" | "llm" | "none";
export interface ReconcileCandidate { entity_id: string; canonical_id: string; label: string; type: string; score: number }
export interface ReconcileMatch { name: string; entity_id: string | null; canonical_id: string | null; label: string | null; type: string | null; method: MatchMethod; confidence: number; matched_synonym: string | null; candidates: ReconcileCandidate[] }
export interface ReconcileResponse { matches: ReconcileMatch[]; mode: AiMode; model?: string }

/** Joins an optional API origin (e.g. the Vercel URL when called from the Lovable program) with a path. */
export const apiUrl = (apiBase: string | undefined, path: string) => `${(apiBase ?? "").replace(/\/+$/, "")}${path}`;
