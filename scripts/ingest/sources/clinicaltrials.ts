/**
 * ClinicalTrials.gov API v2. No solo ensayos: también los ACTIVOS reutilizables que pide el reto
 * (estudios de historia natural, registros, cohortes observacionales) y los ensayos detenidos con su
 * motivo, que son evidencia en contra y se muestran como tal.
 */
import { type GraphWriter, getJSON, sleep } from "../graph";
import type { SeedDisease } from "../types";

const BASE = "https://clinicaltrials.gov/api/v2/studies";

export type AssetKind = "natural_history" | "registry" | "biomarker_study" | "observational_cohort" | "interventional_trial";

export function classifyStudy(title: string, studyType?: string): AssetKind {
  if (/natural history|disease progression|trial readiness/i.test(title)) return "natural_history";
  if (/registry|registries|data ?base|biobank/i.test(title)) return "registry";
  if (/biomarker|outcome measure|endpoint|eeg|clinical outcome assessment/i.test(title)) return "biomarker_study";
  if (studyType === "OBSERVATIONAL") return "observational_cohort";
  return "interventional_trial";
}

type Json = any;

export async function ingestClinicalTrials(g: GraphWriter, d: SeedDisease) {
  const disease = { type: "disease" as const, canonicalId: d.orpha, name: d.name };
  const terms = [d.search_terms[0], ...d.genes].map((t) => t.toLowerCase());
  const seen = new Set<string>();
  let token: string | undefined;

  for (let page = 0; page < 3; page++) {
    const q = new URLSearchParams({ "query.cond": d.search_terms[0], pageSize: "100", format: "json" });
    if (token) q.set("pageToken", token);
    const res = await getJSON<Json>(`${BASE}?${q}`);
    for (const s of res.studies ?? []) {
      const p = s.protocolSection ?? {};
      const nct: string | undefined = p.identificationModule?.nctId;
      if (!nct || seen.has(nct)) continue; seen.add(nct);
      const title: string = p.identificationModule?.briefTitle ?? nct;
      const official: string = p.identificationModule?.officialTitle ?? "";
      const conditions: string[] = p.conditionsModule?.conditions ?? [];
      // Relevancia estricta: la condición o el título tienen que nombrar la enfermedad o su gen.
      const hay = `${title} ${official} ${conditions.join(" ")} ${(p.conditionsModule?.keywords ?? []).join(" ")}`.toLowerCase();
      if (!terms.some((t) => hay.includes(t)) && !d.search_terms.some((t) => hay.includes(t.toLowerCase()))) continue;

      const locations: Json[] = p.contactsLocationsModule?.locations ?? [];
      const countries = [...new Set(locations.map((l) => l.country).filter(Boolean))];
      const phases: string[] = p.designModule?.phases ?? [];
      const status: string = p.statusModule?.overallStatus ?? "UNKNOWN";
      const studyType: string | undefined = p.designModule?.studyType;
      const asset = classifyStudy(`${title} ${official}`, studyType);
      const stopped = ["TERMINATED", "WITHDRAWN", "SUSPENDED"].includes(status);
      const sponsor: string | undefined = p.sponsorCollaboratorsModule?.leadSponsor?.name;
      const collaborators: string[] = (p.sponsorCollaboratorsModule?.collaborators ?? []).map((c: Json) => c.name);
      const outcomes: string[] = (p.outcomesModule?.primaryOutcomes ?? []).map((o: Json) => o.measure).slice(0, 4);

      await g.upsertEdge({
        from: {
          type: "trial", canonicalId: nct, name: title,
          props: {
            status, phases, study_type: studyType, asset_kind: asset, official_title: official || undefined,
            sponsor, sponsor_class: p.sponsorCollaboratorsModule?.leadSponsor?.class, collaborators,
            interventions: (p.armsInterventionsModule?.interventions ?? []).map((i: Json) => i.name).slice(0, 6),
            countries, enrollment: p.designModule?.enrollmentInfo?.count,
            primary_outcomes: outcomes, why_stopped: p.statusModule?.whyStopped,
            start_date: p.statusModule?.startDateStruct?.date, completion_date: p.statusModule?.completionDateStruct?.date,
            conditions,
          },
        },
        to: disease, relation: "studies",
        confidence: stopped ? 0.3 : phaseConfidence(phases, studyType), confidenceBasis: stopped ? "trial_stopped" : "clinical_phase",
        props: { asset_kind: asset, stopped, why_stopped: p.statusModule?.whyStopped },
        evidence: [{
          source: "ctgov", externalId: nct, url: `https://clinicaltrials.gov/study/${nct}`,
          publishedOn: p.statusModule?.lastUpdatePostDateStruct?.date,
          quote: stopped ? `${title} · ${status}${p.statusModule?.whyStopped ? ` · ${p.statusModule.whyStopped}` : ""}` : title,
        }],
      });
    }
    token = res.nextPageToken;
    if (!token) break;
    await sleep(300);
  }
  await g.markSynced("ctgov");
}

function phaseConfidence(phases: string[], studyType?: string) {
  if (studyType === "OBSERVATIONAL") return 0.7; // observar no prueba eficacia, pero el activo existe
  if (phases.includes("PHASE3") || phases.includes("PHASE4")) return 0.8;
  if (phases.includes("PHASE2")) return 0.6;
  if (phases.includes("PHASE1")) return 0.4;
  return 0.5;
}
