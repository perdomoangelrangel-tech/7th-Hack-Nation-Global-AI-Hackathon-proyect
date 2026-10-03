/**
 * Connections (challenge Module 3): which diseases share evidence with this one, how strongly, and what to
 * do next. Pure functions over `disease_links` rows (live) or the snapshot. The score is transparent and
 * documented in the UI ("How we rank"); next steps and "what must be validated" are deterministic rules.
 */
import type { EvidenceRef } from "../atlas-data";
import type { AgentOutput } from "../verifier";
import type { Audience } from "./profiles";
import { clip, fmtList, str, strList } from "./evidence";

export type LinkKind = "treatment" | "trial" | "researcher" | "gene" | "phenotype" | "organization";
export const LINK_KINDS: LinkKind[] = ["treatment", "trial", "researcher", "gene", "phenotype", "organization"];

export interface LinkItem {
  kind: LinkKind;
  code: string | null;
  name: string;
  props: Record<string, unknown>;
  /** edge props on this disease's side (phase, approved_for_indication, frequency, source_ref…) */
  here: Record<string, unknown>;
  /** edge props on the neighbor's side */
  there: Record<string, unknown>;
  confidence: number | null;
  evidence_here: EvidenceRef[];
  evidence_there: EvidenceRef[];
}

export interface DiseaseRef { orpha: string; name: string; name_es: string | null; short: string }
export interface Umbrella { code: string; name: string; url: string }

export interface ScoreBreakdown {
  phenotypes: { shared: number; union: number; value: number };
  treatments: { shared: number; value: number };
  trials: { shared: number; value: number };
  researchers: { shared: number; value: number };
  total: number;
}

export type StepKind = "ask_sponsor" | "trial_eligibility" | "trial_results" | "compare_programs" | "joint_call" | "gene_review" | "phenotype_review" | "investigate";
export interface ConnStep {
  kind: StepKind; item?: string; nct?: string; url?: string; neighborPhase?: number | null; herePhase?: number | null;
  /** trials: short name ("PIXI") and registry status ("ENROLLING_BY_INVITATION"); the wording follows the status */
  label?: string; status?: string;
  evidence_ids: string[];
}
export type Validate = "mechanism" | "transfer";

export interface Neighbor {
  disease: DiseaseRef;
  score: number;
  breakdown: ScoreBreakdown;
  counts: Record<LinkKind, number>;
  shared: Record<LinkKind, LinkItem[]>;
  umbrella: Umbrella[];
  steps: ConnStep[];
  validate: Validate[];
  /** nothing shared beyond umbrella organizations: show the honest-gap card */
  gap: boolean;
}

export interface Connections {
  disease: DiseaseRef;
  neighbors: Neighbor[];
  umbrella: Umbrella[];
  source: "live" | "snapshot";
  retrieved_at: string;
}

export const WEIGHTS = { phenotypes: 0.5, treatments: 0.2, trials: 0.15, researchers: 0.15 } as const;
const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * score = 0.5·(shared phenotypes / union of both phenotype sets) + 0.2·min(1, shared treatments/2)
 *       + 0.15·min(1, shared trials/2) + 0.15·min(1, shared researchers/2). Umbrella organizations are not scored.
 */
export function scorePair(counts: Partial<Record<LinkKind, number>>, phenHere: number, phenThere: number): ScoreBreakdown {
  const sp = counts.phenotype ?? 0;
  const union = Math.max(phenHere + phenThere - sp, sp, 0);
  const p = union ? sp / union : 0;
  const t = Math.min(1, (counts.treatment ?? 0) / 2);
  const tr = Math.min(1, (counts.trial ?? 0) / 2);
  const r = Math.min(1, (counts.researcher ?? 0) / 2);
  const breakdown = {
    phenotypes: { shared: sp, union, value: round(WEIGHTS.phenotypes * p) },
    treatments: { shared: counts.treatment ?? 0, value: round(WEIGHTS.treatments * t) },
    trials: { shared: counts.trial ?? 0, value: round(WEIGHTS.trials * tr) },
    researchers: { shared: counts.researcher ?? 0, value: round(WEIGHTS.researchers * r) },
  };
  return { ...breakdown, total: round(breakdown.phenotypes.value + breakdown.treatments.value + breakdown.trials.value + breakdown.researchers.value) };
}

export const sideApproved = (s: Record<string, unknown>) => s.approved_for_indication === true || str(s.stage)?.toUpperCase() === "APPROVAL";
export const sidePhase = (s: Record<string, unknown>): number | null => {
  const n = typeof s.phase === "number" ? s.phase : typeof s.phase === "string" ? Number(s.phase) : NaN;
  return Number.isFinite(n) ? n : null;
};
const ids = (list: EvidenceRef[]) => list.map((e) => e.id).filter((id) => !id.startsWith("link:"));
const itemIds = (it: LinkItem) => [...ids(it.evidence_here), ...ids(it.evidence_there)];
const ctgov = (nct: string) => `https://clinicaltrials.gov/study/${nct}`;

/** Registry statuses that still take participants, best first. ACTIVE_NOT_RECRUITING / COMPLETED are never "enrolling". */
export const OPEN_TRIAL_STATUSES = ["RECRUITING", "ENROLLING_BY_INVITATION", "NOT_YET_RECRUITING"] as const;
export const linkTrialStatus = (it: LinkItem) => (str(it.props.status) ?? str(it.here.status) ?? str(it.there.status) ?? "").toUpperCase().replace(/[\s,]+/g, "_");
const openRank = (it: LinkItem) => {
  const i = (OPEN_TRIAL_STATUSES as readonly string[]).indexOf(linkTrialStatus(it));
  return i < 0 ? OPEN_TRIAL_STATUSES.length : i;
};
export const isOpenTrial = (it: LinkItem) => openRank(it) < OPEN_TRIAL_STATUSES.length;

/** "Parent and Infant Inter(X)Action Intervention (PIXI)" → "PIXI"; "Early Check: Expanded Screening…" → "Early Check"; else the NCT id. */
export function trialLabel(name: string, code: string | null) {
  const acro = name.match(/\(([A-Z][A-Za-z0-9-]{1,14})\)\s*$/)?.[1];
  if (acro) return acro;
  const head = name.split(":")[0].trim();
  if (head !== name.trim() && head.length <= 24) return head;
  return code ?? clip(name, 40);
}

const STATUS_TEXT: Record<string, { en: string; es: string }> = {
  RECRUITING: { en: "recruiting", es: "reclutando" },
  ENROLLING_BY_INVITATION: { en: "enrolling by invitation", es: "inscripción por invitación" },
  NOT_YET_RECRUITING: { en: "not yet recruiting", es: "aún no recluta" },
  ACTIVE_NOT_RECRUITING: { en: "active, not recruiting", es: "activo, sin reclutar" },
  COMPLETED: { en: "completed", es: "completado" },
  TERMINATED: { en: "terminated", es: "terminado" },
  WITHDRAWN: { en: "withdrawn", es: "retirado" },
  SUSPENDED: { en: "suspended", es: "suspendido" },
  UNKNOWN: { en: "status unknown", es: "estado desconocido" },
};
/** Registry status in words ("ENROLLING_BY_INVITATION" → "enrolling by invitation"). */
export function trialStatusText(status: string | null | undefined, l: "en" | "es") {
  const k = (status ?? "").toUpperCase().replace(/[\s,]+/g, "_");
  return STATUS_TEXT[k]?.[l] ?? (k ? k.replace(/_/g, " ").toLowerCase() : STATUS_TEXT.UNKNOWN[l]);
}

/** Deterministic next steps, strongest first (max 3). */
export function nextSteps(shared: Record<LinkKind, LinkItem[]>, gap: boolean): ConnStep[] {
  if (gap) return [{ kind: "investigate", evidence_ids: [] }];
  const steps: ConnStep[] = [];
  const approvedThere = shared.treatment.find((t) => sideApproved(t.there) && !sideApproved(t.here));
  if (approvedThere) {
    const nct = strList(approvedThere.here.nct_ids)[0];
    steps.push({ kind: "ask_sponsor", item: approvedThere.name, nct, url: nct ? ctgov(nct) : approvedThere.evidence_here[0]?.url, neighborPhase: sidePhase(approvedThere.there), herePhase: sidePhase(approvedThere.here), evidence_ids: itemIds(approvedThere) });
  }
  // Trials: the open one first (recruiting > by invitation > not yet); a closed study only earns a "results" step.
  const trial = [...shared.trial].sort((a, b) => openRank(a) - openRank(b))[0];
  if (trial?.code) {
    steps.push({
      kind: isOpenTrial(trial) ? "trial_eligibility" : "trial_results", item: trial.name, nct: trial.code, url: ctgov(trial.code),
      label: trialLabel(trial.name, trial.code), status: linkTrialStatus(trial) || undefined, evidence_ids: itemIds(trial),
    });
  }
  if (!approvedThere && shared.treatment[0]) steps.push({ kind: "compare_programs", item: shared.treatment[0].name, evidence_ids: itemIds(shared.treatment[0]) });
  const person = shared.researcher[0];
  if (person) steps.push({ kind: "joint_call", item: person.name, url: person.evidence_there[0]?.url ?? person.evidence_here[0]?.url, evidence_ids: [] });
  if (shared.gene[0]) steps.push({ kind: "gene_review", item: shared.gene[0].name, evidence_ids: itemIds(shared.gene[0]) });
  if (!steps.length && shared.phenotype.length) steps.push({ kind: "phenotype_review", evidence_ids: shared.phenotype.slice(0, 3).flatMap(itemIds) });
  return steps.slice(0, 3);
}

const emptyGroups = (): Record<LinkKind, LinkItem[]> => ({ treatment: [], trial: [], researcher: [], gene: [], phenotype: [], organization: [] });

export function buildNeighbor(input: {
  disease: DiseaseRef; items: LinkItem[]; counts?: Partial<Record<LinkKind, number>>;
  phenHere: number; phenThere: number; umbrella: Umbrella[];
}): Neighbor {
  const umbrellaCodes = new Set(input.umbrella.map((u) => u.code));
  const shared = emptyGroups();
  const umbrella: Umbrella[] = [];
  for (const it of input.items) {
    if (it.kind === "organization" && it.code && umbrellaCodes.has(it.code)) {
      const u = input.umbrella.find((x) => x.code === it.code);
      if (u && !umbrella.some((x) => x.code === u.code)) umbrella.push(u);
      continue;
    }
    shared[it.kind].push(it);
  }
  for (const k of LINK_KINDS) shared[k].sort((a, b) => (k === "trial" ? openRank(a) - openRank(b) : 0) || (b.confidence ?? 0) - (a.confidence ?? 0) || a.name.localeCompare(b.name));
  const counts = Object.fromEntries(LINK_KINDS.map((k) => [k, Math.max(input.counts?.[k] ?? 0, shared[k].length)])) as Record<LinkKind, number>;
  if (input.counts?.organization != null) counts.organization = shared.organization.length; // umbrella orgs are not "shared evidence"
  const breakdown = scorePair(counts, input.phenHere, input.phenThere);
  const gap = LINK_KINDS.every((k) => counts[k] === 0);
  const steps = nextSteps(shared, gap);
  const validate: Validate[] = gap ? [] : ["mechanism", ...(steps.some((s) => s.kind === "ask_sponsor") ? (["transfer"] as Validate[]) : [])];
  return { disease: input.disease, score: breakdown.total, breakdown, counts, shared, umbrella, steps, validate, gap };
}

export function rankNeighbors(list: Neighbor[]): Neighbor[] {
  return [...list].sort((a, b) => Number(a.gap) - Number(b.gap) || b.score - a.score || a.disease.name.localeCompare(b.disease.name));
}

/** Every graph evidence id that backs this pair (researcher links carry no evidence id and are excluded). */
export function pairEvidenceIds(n: Neighbor): string[] {
  return [...new Set(LINK_KINDS.flatMap((k) => n.shared[k].flatMap(itemIds)))];
}
export function pairEvidence(n: Neighbor): EvidenceRef[] {
  const seen = new Map<string, EvidenceRef>();
  for (const k of LINK_KINDS) for (const it of n.shared[k]) for (const e of [...it.evidence_here, ...it.evidence_there]) if (!e.id.startsWith("link:")) seen.set(e.id, e);
  return [...seen.values()];
}

// ---------------------------------------------------------------------------------------------------------
// Sentences (deterministic) — only restate shared items; every claim cites both sides' evidence ids.
// ---------------------------------------------------------------------------------------------------------
type Locale = "en" | "es";

/** "Dravet syndrome" / ES with article ("el síndrome de Dravet"). */
export function nameIn(d: DiseaseRef, l: Locale) {
  if (l !== "es" || !d.name_es) return d.name;
  const m = d.name_es.match(/^(Síndrome|Enfermedad|Trastorno)\b/);
  return m ? `${m[1] === "Enfermedad" ? "la" : "el"} ${m[1].toLowerCase()}${d.name_es.slice(m[1].length)}` : d.name_es;
}

function statusFor(side: Record<string, unknown>, d: DiseaseRef, l: Locale) {
  const ph = sidePhase(side);
  const n = nameIn(d, l);
  if (sideApproved(side)) return l === "es" ? `aprobado para ${n}${ph != null ? ` (fase ${ph})` : ""}` : `approved for ${n}${ph != null ? ` (phase ${ph})` : ""}`;
  if (ph != null) return l === "es" ? `en fase ${ph} para ${n}` : `in phase ${ph} for ${n}`;
  return l === "es" ? `en estudio para ${n}` : `studied for ${n}`;
}

export function treatmentSentence(it: LinkItem, here: DiseaseRef, there: DiseaseRef, l: Locale) {
  const nct = strList(it.here.nct_ids)[0];
  const tail = nct ? ` (${nct})` : "";
  return l === "es"
    ? `${it.name}: ${statusFor(it.there, there, l)} y ${statusFor(it.here, here, l)}${tail}.`
    : `${it.name} is ${statusFor(it.there, there, l)} and ${statusFor(it.here, here, l)}${tail}.`;
}

export function connectionClaims(here: DiseaseRef, n: Neighbor, l: Locale, audience: Audience, max = 4): AgentOutput["claims"] {
  const claims: AgentOutput["claims"] = [];
  const there = n.disease;
  for (const t of n.shared.treatment.slice(0, 2)) claims.push({ text: treatmentSentence(t, here, there, l), evidence_ids: itemIds(t) });
  for (const t of n.shared.trial.slice(0, 1)) {
    const st = linkTrialStatus(t) ? ` (${trialStatusText(linkTrialStatus(t), l)})` : "";
    claims.push({ text: l === "es"
      ? `El estudio ${t.code} («${clip(t.name, 70)}») está registrado para ${nameIn(here, l)} y para ${nameIn(there, l)}${st}.`
      : `Study ${t.code} (“${clip(t.name, 70)}”) is registered for both ${here.name} and ${there.name}${st}.`, evidence_ids: itemIds(t) });
  }
  for (const g of n.shared.gene.slice(0, 1)) claims.push({ text: l === "es" ? `Ambas se asocian al gen ${g.name}.` : `Both are associated with the ${g.name} gene.`, evidence_ids: itemIds(g) });
  if (n.shared.phenotype.length) {
    const top = n.shared.phenotype.slice(0, 3);
    const names = top.map((p) => (audience === "clinical" && p.code ? `${p.name} (${p.code})` : p.name));
    const count = n.counts.phenotype;
    claims.push({ text: l === "es"
      ? `${count === 1 ? "Comparten un síntoma" : `Comparten ${count} síntomas`} en nuestras fuentes, por ejemplo: ${fmtList(names, l)}.`
      : `They share ${count} symptom${count === 1 ? "" : "s"} in our sources, for example: ${fmtList(names, l)}.`, evidence_ids: top.flatMap(itemIds) });
  }
  return claims.slice(0, max);
}

/** Deterministic "Explain this connection" (no model key): same rules as the claims above. */
export function explainDraft(here: DiseaseRef, n: Neighbor, l: Locale, audience: Audience): AgentOutput {
  const claims = connectionClaims(here, n, l, audience, 5);
  if (n.gap) {
    claims.push({ text: l === "es" ? `Evidencia compartida entre ${nameIn(here, l)} y ${nameIn(n.disease, l)}.` : `Shared evidence between ${here.name} and ${n.disease.name}.`, evidence_ids: [] });
  }
  return { spoken: "", claims, next_steps: [] };
}

/** OpenAI "Explain": messages that expose ONLY this pair's evidence ids. */
export function buildExplainMessages(here: DiseaseRef, n: Neighbor, l: Locale, audience: Audience) {
  const evidence = pairEvidence(n).map((e) => ({ id: e.id, source: e.source, external_id: e.external_id }));
  const shared = LINK_KINDS.filter((k) => k !== "researcher").flatMap((k) => n.shared[k].map((it) => ({
    kind: k, name: it.name, code: it.code, [here.short]: it.here, [n.disease.short]: it.there, evidence_ids: itemIds(it),
  })));
  const tone = audience === "family" ? "plain words for a family, warm, no jargon" : audience === "clinical" ? "precise, for a clinician, keep codes (HP, NCT, CHEMBL)" : "technical, for a researcher; say what is missing";
  const lang = l === "es" ? "Spanish" : "English";
  const system = [
    `You explain why two rare diseases are connected in an evidence graph. Write in ${lang}; ${tone}.`,
    "RULES: You know nothing on your own. Every claim must cite evidence_ids taken ONLY from the EVIDENCE list. No claim without evidence_ids.",
    "Do not infer shared mechanisms, causes or efficacy; only restate what the shared items say (names, phases, approvals, trial ids, symptoms).",
    "Return ONLY JSON: {\"spoken\":\"\",\"claims\":[{\"text\":\"...\",\"evidence_ids\":[\"...\"]}],\"next_steps\":[]}. At most 5 claims.",
  ].join("\n");
  const user = JSON.stringify({ disease: { name: here.name, orpha: here.orpha }, neighbor: { name: n.disease.name, orpha: n.disease.orpha }, score: n.score, shared, EVIDENCE: evidence }).slice(0, 40_000);
  return { system, user, allowed: evidence.map((e) => e.id) };
}

/** Compact tool response lines (ElevenLabs `connections` tool). */
export function neighborSummary(here: DiseaseRef, n: Neighbor) {
  if (n.gap) return `${n.disease.name} (${n.disease.orpha}) · no shared evidence beyond umbrella organizations`;
  const parts: string[] = [];
  for (const t of n.shared.treatment.slice(0, 2)) parts.push(treatmentSentence(t, here, n.disease, "en").replace(/\.$/, ""));
  if (n.counts.trial) parts.push(`${n.counts.trial} shared trial${n.counts.trial > 1 ? "s" : ""} (${n.shared.trial.slice(0, 2).map((t) => `${t.code} ${trialStatusText(linkTrialStatus(t), "en")}`).join(", ")})`);
  if (n.counts.phenotype) parts.push(`${n.counts.phenotype} shared symptom${n.counts.phenotype === 1 ? "" : "s"}`);
  if (n.counts.researcher) parts.push(`${n.counts.researcher} shared researcher${n.counts.researcher > 1 ? "s" : ""}`);
  return clip(`${n.disease.name} (${n.disease.orpha}) · score ${n.score.toFixed(2)} · ${parts.join(" · ")}`, 300);
}
