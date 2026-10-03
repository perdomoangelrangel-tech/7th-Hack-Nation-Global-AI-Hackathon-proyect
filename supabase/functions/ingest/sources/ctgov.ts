// ClinicalTrials.gov API v2: active / recruiting trials per condition (status, phase, countries,
// sites, start date). Drug / biologic / genetic interventions become investigational `treats` edges
// (matched to Open Targets ChEMBL treatments by name / synonym when possible).
import type { Ctx, EntityRef, SeedDisease } from "../types.ts";
import { getJSON, isoDate, slug, trunc } from "../http.ts";

const BASE = "https://clinicaltrials.gov/api/v2/studies";
const ACTIVE = ["RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING", "ENROLLING_BY_INVITATION"];
const FIELDS = [
  "NCTId", "BriefTitle", "OverallStatus", "Phase", "StudyType", "LeadSponsorName",
  "LocationCountry", "LocationCity", "LocationFacility", "LocationStatus",
  "StartDate", "PrimaryCompletionDate", "LastUpdatePostDate",
  "InterventionName", "InterventionType", "EnrollmentCount", "Condition", "MinimumAge", "MaximumAge",
].join(",");
// DEVICE is excluded: in these trials devices are monitoring / assistive tools, not treatments.
const TREATMENT_TYPES = new Set(["DRUG", "BIOLOGICAL", "GENETIC", "DIETARY_SUPPLEMENT", "COMBINATION_PRODUCT"]);
const NOT_A_TREATMENT = /placebo|sham|vehicle|standard of care|usual care|best supportive|no intervention|^control|saline/i;
const PHASE_NUM: Record<string, number> = { EARLY_PHASE1: 0.5, PHASE1: 1, PHASE2: 2, PHASE3: 3, PHASE4: 4 };

// deno-lint-ignore no-explicit-any
type Any = any;

export async function ctgov(ctx: Ctx, d: SeedDisease) {
  const cond = d.search_terms.map((t) => `"${t}"`).join(" OR ");
  const q = new URLSearchParams({
    "query.cond": cond, "filter.overallStatus": ACTIVE.join(","), fields: FIELDS, pageSize: "100", format: "json",
  });
  const res = await getJSON<Any>(`${BASE}?${q}`);
  ctx.sample("ctgov.studies", { totalCount: res?.totalCount, first: res?.studies?.[0] });
  const studies: Any[] = res?.studies ?? [];
  const diseaseRef: EntityRef = { type: "disease", canonicalId: d.orpha, name: d.name };

  // Treatments already in the graph (Open Targets) for name matching
  const dict = await treatmentDictionary(ctx);
  const existingTreats = await existingOtTreats(ctx, d.orpha);

  const interventions = new Map<string, { name: string; type: string; ncts: Set<string>; phase: number; statuses: Set<string>; titles: Map<string, string> }>();

  // ClinicalTrials.gov expands condition queries to related concepts (e.g. "CDKL5" also returns Dravet
  // trials), so keep only trials whose title or conditions name this disease.
  const kws = (d.trial_keywords?.length ? d.trial_keywords : d.search_terms).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const onTopic = new RegExp(`\\b(${kws.join("|")})`, "i");
  let offTopic = 0;
  const keptNcts: string[] = [];

  for (const s of studies) {
    const p = s?.protocolSection ?? {};
    const nct: string | undefined = p.identificationModule?.nctId;
    if (!nct) continue;
    const title: string = p.identificationModule?.briefTitle ?? nct;
    if (!onTopic.test([title, ...(p.conditionsModule?.conditions ?? [])].join(" | "))) { offTopic++; continue; }
    keptNcts.push(nct);
    const locations: Any[] = p.contactsLocationsModule?.locations ?? [];
    const countries = [...new Set(locations.map((l) => l?.country).filter(Boolean))] as string[];
    const phases: string[] = p.designModule?.phases ?? [];
    const status: string | undefined = p.statusModule?.overallStatus;
    const ivs: Any[] = p.armsInterventionsModule?.interventions ?? [];
    const phaseNum = Math.max(0, ...phases.map((x) => PHASE_NUM[x] ?? 0));
    ctx.batch.edge({
      from: {
        type: "trial", canonicalId: nct, name: title,
        props: {
          nct_id: nct, status, phase: phases.length ? phases.join("/") : "NA", phases,
          study_type: p.designModule?.studyType,
          sponsor: p.sponsorCollaboratorsModule?.leadSponsor?.name,
          interventions: ivs.map((i) => i?.name).filter(Boolean),
          intervention_types: [...new Set(ivs.map((i) => i?.type).filter(Boolean))],
          countries, countries_count: countries.length, sites_count: locations.length,
          sites: locations.slice(0, 25).map((l) => ({ facility: l?.facility, city: l?.city, country: l?.country, status: l?.status })),
          start_date: isoDate(p.statusModule?.startDateStruct?.date),
          primary_completion_date: isoDate(p.statusModule?.primaryCompletionDateStruct?.date),
          enrollment: p.designModule?.enrollmentInfo?.count,
          conditions: (p.conditionsModule?.conditions ?? []).slice(0, 8),
          min_age: p.eligibilityModule?.minimumAge, max_age: p.eligibilityModule?.maximumAge,
          url: `https://clinicaltrials.gov/study/${nct}`,
        },
      },
      to: diseaseRef, relation: "studies",
      confidence: phaseNum >= 3 ? 0.8 : phaseNum >= 2 ? 0.6 : phaseNum >= 1 ? 0.4 : 0.5, confidenceBasis: "clinical_phase",
      props: { status, phase: phases.join("/") || "NA" },
      evidence: [{
        source: "ctgov", externalId: nct, url: `https://clinicaltrials.gov/study/${nct}`,
        publishedOn: p.statusModule?.lastUpdatePostDateStruct?.date, quote: trunc(`${title} · ${status ?? ""}`, 300),
      }],
    });

    for (const iv of ivs) {
      const type: string = iv?.type ?? "OTHER";
      const name = cleanIntervention(iv?.name ?? "");
      if (!name || !TREATMENT_TYPES.has(type) || NOT_A_TREATMENT.test(name)) continue;
      const key = matchTreatment(name, dict) ?? `CTGOV:${slug(name).slice(0, 80)}`;
      const a = interventions.get(key) ?? { name, type, ncts: new Set(), phase: 0, statuses: new Set(), titles: new Map() };
      a.ncts.add(nct); a.phase = Math.max(a.phase, phaseNum); if (status) a.statuses.add(status); a.titles.set(nct, title);
      interventions.set(key, a);
    }
  }

  for (const [key, a] of interventions) {
    const isChembl = !key.startsWith("CTGOV:");
    const ncts = [...a.ncts].slice(0, 20);
    const statuses = [...a.statuses];
    const known = isChembl ? dict.names.get(key) : undefined;
    const treatment: EntityRef = isChembl
      ? { type: "treatment", canonicalId: key, name: known ?? a.name }
      : { type: "treatment", canonicalId: key, name: trunc(a.name, 120)!, props: { intervention_type: a.type, source_name: a.name } };
    const trialProps = { nct_ids: ncts, trial_status: statuses[0], trial_statuses: statuses, trial_phase: a.phase };
    const ot = isChembl ? existingTreats.get(key) : undefined;
    const props = ot
      ? trialProps // keep Open Targets phase / approval / confidence; only add trial info
      : { ...trialProps, origin: "clinicaltrials", phase: a.phase, status: statuses[0], investigational: true, intervention_type: a.type };
    ctx.batch.edge({
      from: treatment, to: diseaseRef, relation: "treats",
      confidence: ot ? ot.confidence : a.phase >= 3 ? 0.6 : a.phase >= 2 ? 0.45 : 0.3,
      confidenceBasis: ot ? ot.confidence_basis : "clinical_phase",
      props,
      evidence: ncts.slice(0, 5).map((nct) => ({
        source: "ctgov" as const, externalId: nct, url: `https://clinicaltrials.gov/study/${nct}`,
        quote: trunc(`${a.name} evaluated in ${nct}: ${a.titles.get(nct) ?? ""}`, 300),
      })),
    });
  }
  // Retract trial / investigational-treatment edges for this disease that are no longer active or on-topic
  // (an edge re-seen later is re-activated by ingest_upsert). Skipped when the API returned nothing.
  if (!ctx.dry && studies.length) {
    const current = new Set<string>(keptNcts);
    const { data: existing } = await ctx.db.from("edge_evidence")
      .select("edge_id, relation, from_type, from_canonical_id, edge_props")
      .eq("to_canonical_id", d.orpha).in("relation", ["studies", "treats"]).limit(1000);
    const stale = (existing ?? []).filter((r: Any) =>
      (r.relation === "studies" && r.from_type === "trial" && !current.has(r.from_canonical_id)) ||
      (r.relation === "treats" && r.edge_props?.origin === "clinicaltrials" && !interventions.has(r.from_canonical_id)),
    ).map((r: Any) => r.edge_id as string);
    if (stale.length) {
      const { error } = await ctx.db.from("edges").update({ status: "retracted", updated_at: new Date().toISOString() }).in("id", stale);
      if (error) ctx.note(`ctgov retract: ${error.message}`);
    }
    ctx.extra.retracted = stale.length;
  }
  ctx.extra.trials = studies.length - offTopic;
  ctx.extra.trials_off_topic = offTopic;
  ctx.extra.trial_interventions = interventions.size;
}

interface Dict { terms: [string, string][]; names: Map<string, string> }
const SALTS = new Set(["sodium", "potassium", "calcium", "magnesium", "hydrochloride", "sulfate", "acetate", "citrate", "recombinant", "human"]);

async function treatmentDictionary(ctx: Ctx): Promise<Dict> {
  const { data } = await ctx.db.from("entities").select("canonical_id, name, props").eq("type", "treatment").like("canonical_id", "CHEMBL%").limit(2000);
  const terms: [string, string][] = [];
  const names = new Map<string, string>();
  for (const t of data ?? []) {
    // salt forms point at their parent molecule (set by the Open Targets step)
    const id = (t.props?.parent_chembl as string | undefined) ?? t.canonical_id;
    if (id === t.canonical_id) names.set(id, t.name);
    const list = [t.name, ...((t.props?.trade_names as string[]) ?? []), ...((t.props?.synonyms as string[]) ?? [])];
    for (const n of list) {
      const norm = normalize(n);
      if (norm.length >= 5) terms.push([norm, id]);
    }
    // "fenfluramine hydrochloride" -> also "fenfluramine"
    const base = normalize(t.name).split(" ")[0];
    if (base.length >= 6 && !SALTS.has(base)) terms.push([base, id]);
  }
  terms.sort((a, b) => b[0].length - a[0].length);
  return { terms, names };
}

/** Treats edges owned by an authoritative source (Open Targets or a curated regulator approval). */
async function existingOtTreats(ctx: Ctx, orpha: string): Promise<Map<string, { confidence: number; confidence_basis: string }>> {
  const { data } = await ctx.db.from("edge_evidence").select("from_canonical_id, edge_props, confidence, confidence_basis").eq("relation", "treats").eq("to_canonical_id", orpha).limit(500);
  return new Map((data ?? []).filter((r: Any) => r.edge_props?.origin === "opentargets" || r.edge_props?.origin === "fda")
    .map((r: Any) => [r.from_canonical_id, { confidence: Number(r.confidence), confidence_basis: r.confidence_basis }]));
}

const normalize = (s: string) => s.toLowerCase().replace(/[®™]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function matchTreatment(name: string, dict: Dict): string | undefined {
  const n = ` ${normalize(name)} `;
  for (const [term, id] of dict.terms) if (n.includes(` ${term} `)) return id;
  return undefined;
}

/**
 * Intervention names are free text. Strip arm / cohort labels and "for the treatment of ..." tails, and
 * reject anything that still reads like a title or sentence (those are never treatment names).
 */
export function cleanIntervention(raw: string): string | null {
  let n = raw.replace(/\s+/g, " ").trim();
  n = n.split(/\s+for the treatment of\s+/i)[0];
  n = n.replace(/\s*[-\u2013:,(]\s*(fixed[- ]dose|dose[- ]escalation|low[- ]dose|high[- ]dose|single[- ]dose|multiple[- ]dose|open[- ]label|cohort|arm|part\s+\w+)\b.*$/i, "").trim();
  if (!n || n.length > 60 || /\.$/.test(n)) return null;
  if (/\b(trial|study|randomi[sz]ed|placebo|double[- ]blind|cohort|questionnaire|assessment|monitoring|survey|interview)\b/i.test(n)) return null;
  return n;
}
