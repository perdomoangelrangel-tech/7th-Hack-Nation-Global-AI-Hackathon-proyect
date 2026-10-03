/**
 * Pure helpers over the atlas data contract. No I/O, no authored facts: every function only
 * reshapes what the graph returned. Shared by the map UI, /api/ask (demo drafting) and /api/tools.
 */
import type { GapItem, LineKey, Station } from "../atlas-data";

export const WEAK_CONFIDENCE = 0.4;

export const isWeak = (confidence: number | null | undefined) => confidence != null && Number(confidence) < WEAK_CONFIDENCE;

/** "Dravet syndrome" → "Dravet", "CLN2 disease (late infantile …)" → "CLN2". Proper nouns, same in EN/ES. */
export function shortName(name: string) {
  const first = name.trim().split(/[\s(,]+/)[0] ?? name;
  return first.length >= 3 ? first : name;
}

export const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
export const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter((x): x is string => !!x) : []);

/** Highest clinical phase recorded on the edge (Open Targets) or the entity. */
export function treatmentPhase(s: Station): number | null {
  const p = s.edge_props.phase ?? s.props.phase ?? s.props.max_phase;
  const n = typeof p === "number" ? p : typeof p === "string" ? Number(p) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * Approved FOR THIS DISEASE. A drug approved for something else (entity props.approved) that is only
 * being tested here is investigational: the edge decides (approved_for_indication / stage / investigational).
 */
export function isApproved(s: Station) {
  const e = s.edge_props;
  if (typeof e.approved_for_indication === "boolean") return e.approved_for_indication;
  if (typeof e.stage === "string") return e.stage.toUpperCase() === "APPROVAL";
  if (e.investigational === true) return false;
  if (typeof e.approved === "boolean" && !("phase" in e)) return e.approved;
  return (treatmentPhase(s) ?? 0) >= 4;
}

/** Regulatory approval recorded on the edge (`approval: {agency, date, url}`) → { agency: "FDA", year: "2022", url }. */
export function approvalOf(props: Record<string, unknown> | null | undefined): { agency: string; year: string | null; url: string | null; label: string } | null {
  const a = props?.approval;
  if (!a || typeof a !== "object") return null;
  const r = a as Record<string, unknown>;
  const agency = str(r.agency);
  if (!agency) return null;
  const year = str(r.date)?.match(/\d{4}/)?.[0] ?? null;
  return { agency, year, url: str(r.url), label: year ? `${agency} ${year}` : agency };
}

export const mechanismOf = (s: Station) => str(s.edge_props.mechanism) ?? str(s.props.mechanism);

const RECRUITING = new Set(["RECRUITING", "NOT_YET_RECRUITING", "ENROLLING_BY_INVITATION"]);
export const trialStatus = (s: Station) => (str(s.props.status) ?? str(s.edge_props.status) ?? "").toUpperCase().replace(/[\s,]+/g, "_");
export const isRecruiting = (s: Station) => RECRUITING.has(trialStatus(s));

/** "PHASE2","PHASE3" → "2/3"; "EARLY_PHASE1" → "1"; [] → null */
export function trialPhases(s: Station): string | null {
  const phases = [...strList(s.props.phases), ...[str(s.props.phase), str(s.edge_props.phase)].filter((x): x is string => !!x)];
  const nums = [...new Set(phases.map((p) => p.match(/(\d)/)?.[1]).filter(Boolean))] as string[];
  return nums.length ? nums.sort().join("/") : null;
}

export const countriesOf = (s: Station) => strList(s.props.countries);

/** Literature newest first (by evidence date). */
export function sortLiterature(list: Station[]) {
  const date = (s: Station) => s.evidence[0]?.published_on ?? "";
  return [...list].sort((a, b) => date(b).localeCompare(date(a)));
}

export const evidenceIds = (list: Station[], perStation = 2) => [...new Set(list.flatMap((s) => s.evidence.slice(0, perStation).map((e) => e.id)))];

/**
 * Research gaps derived from the graph itself:
 * - a line with no sourced stations (empty_line)
 * - treatments exist but none approved; trials exist but none recruiting; no researchers registered
 * - relations with low confidence (< 0.4) or a single source on genes / phenotypes / treatments
 *   (same rule as the research_gaps view; trials and papers are single-source by nature, so they are skipped)
 */
export function computeGaps(lines: Record<LineKey, Station[]>, totals: Record<LineKey, number>): GapItem[] {
  const gaps: GapItem[] = [];
  for (const line of ["genes", "phenotypes", "treatments", "trials", "literature", "community"] as LineKey[]) {
    if (!totals[line] && !lines[line].length) gaps.push({ kind: "empty_line", line, evidence_ids: [] });
  }
  if (lines.treatments.length && !lines.treatments.some(isApproved)) {
    gaps.push({ kind: "no_approved_treatment", line: "treatments", evidence_ids: evidenceIds(lines.treatments, 1).slice(0, 6) });
  }
  if (lines.trials.length && !lines.trials.some(isRecruiting)) {
    gaps.push({ kind: "no_recruiting_trial", line: "trials", evidence_ids: evidenceIds(lines.trials, 1).slice(0, 6) });
  }
  if (!lines.community.some((s) => s.props.kind === "researcher")) {
    gaps.push({ kind: "no_researchers", line: "community", evidence_ids: [] });
  }
  const weak: GapItem[] = [];
  const single: GapItem[] = [];
  for (const line of ["genes", "treatments", "phenotypes"] as LineKey[]) {
    for (const s of lines[line]) {
      const ref = { name: s.name, canonical_id: s.canonical_id };
      const ids = s.evidence.map((e) => e.id);
      if (s.weak) weak.push({ kind: "low_confidence", line, station: ref, evidence_ids: ids });
      else if (s.evidence.length <= 1 && line !== "phenotypes") single.push({ kind: "single_source", line, station: ref, evidence_ids: ids });
    }
  }
  return [...gaps, ...single.slice(0, 6), ...weak.slice(0, 6)];
}

export function fmtList(items: string[], locale: "en" | "es") {
  const and = locale === "es" ? "y" : "and";
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

/** Lowercase an HPO-style term for use mid-sentence ("Febrile seizure" → "febrile seizure"), keep acronyms. */
export function inSentence(term: string) {
  return /^[A-Z][a-z]/.test(term) ? term[0].toLowerCase() + term.slice(1) : term;
}

export function clip(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

export const SOURCE_LABEL: Record<string, string> = {
  orphanet: "Orphanet", hpo: "HPO", monarch: "Monarch", clinvar: "ClinVar", ctgov: "ClinicalTrials.gov",
  opentargets: "Open Targets", pubmed: "PubMed", patient_orgs: "Patient orgs", research_community: "Researcher registry",
  fda: "FDA", ema: "EMA", pmda: "PMDA",
};
export const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? s;
/** External id without a prefix that repeats the source label ("FDA:ztalmy-2022" under "FDA" → "ztalmy-2022"). */
export function externalIdShort(source: string, externalId: string) {
  const label = sourceLabel(source);
  return externalId.toLowerCase().startsWith(`${label.toLowerCase()}:`) ? externalId.slice(label.length + 1) : externalId;
}

/** Orphanet prevalence (string or [{type, class, geographic}]) → "1-9 / 100 000 · Prevalence at birth · Europe". */
export function prevalenceLabel(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (!Array.isArray(v)) return null;
  const known = v.filter((p) => p && typeof p === "object" && str((p as Record<string, unknown>).class) && !/unknown/i.test(String((p as Record<string, unknown>).class)));
  const p = (known[0] ?? null) as Record<string, unknown> | null;
  return p ? [str(p.class), str(p.type), str(p.geographic)].filter(Boolean).join(" · ") : null;
}

const INSTITUTION = /(Universit|Hospital|Institut|Foundation|Fundaci|Clinic|School|College|Cent(er|re)|Inc\b|Laborator|Health System|IRCCS|Hôpital)/i;

/** PubMed affiliation → short institution line. Drops e-mail addresses, street addresses and initials in parentheses. */
export function cleanAffiliation(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(";")[0].replace(/\s*(Electronic address:|E-?mail:).*$/i, "").replace(/\S+@\S+/g, "").replace(/\s*\([^)]*\)?/g, "").trim();
  const keep: string[] = [];
  for (const part of first.split(",").map((x) => x.trim()).filter(Boolean)) {
    if (/\d|^C\/|Suite|Drive|Street/i.test(part)) break;
    keep.push(part);
    if (INSTITUTION.test(part) || keep.length === 2) break;
  }
  const out = keep.join(", ").replace(/\.$/, "");
  return out ? clip(out, 90) : null;
}
