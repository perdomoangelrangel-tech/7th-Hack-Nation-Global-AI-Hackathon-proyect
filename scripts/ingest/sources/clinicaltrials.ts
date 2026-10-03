/** ClinicalTrials.gov API v2: ensayos activos por condición, con sitios y países. */
import { Graph, getJSON } from "../graph";
import type { SeedDisease } from "../types";

const BASE = "https://clinicaltrials.gov/api/v2/studies";
const FIELDS = [
  "NCTId", "BriefTitle", "OverallStatus", "Phase", "StudyType", "LeadSponsorName",
  "LocationCountry", "LocationCity", "LocationFacility", "StartDate", "LastUpdatePostDate", "InterventionName",
].join(",");

export async function ingestClinicalTrials(g: Graph, d: SeedDisease) {
  const q = new URLSearchParams({
    "query.cond": d.search_terms[0],
    "filter.overallStatus": "RECRUITING,NOT_YET_RECRUITING,ACTIVE_NOT_RECRUITING,ENROLLING_BY_INVITATION",
    fields: FIELDS, pageSize: "50", format: "json",
  });
  const res = await getJSON<any>(`${BASE}?${q}`).catch(() => null);
  const studies: any[] = res?.studies ?? [];
  const disease = { type: "disease" as const, canonicalId: d.orpha, name: d.name };

  for (const s of studies) {
    const p = s.protocolSection ?? {};
    const nct: string | undefined = p.identificationModule?.nctId;
    if (!nct) continue;
    const locations: any[] = p.contactsLocationsModule?.locations ?? [];
    const countries = [...new Set(locations.map((l) => l.country).filter(Boolean))];
    const phases: string[] = p.designModule?.phases ?? [];
    const status = p.statusModule?.overallStatus;
    await g.upsertEdge({
      from: {
        type: "trial", canonicalId: nct, name: p.identificationModule?.briefTitle ?? nct,
        props: {
          status, phases, study_type: p.designModule?.studyType,
          sponsor: p.sponsorCollaboratorsModule?.leadSponsor?.name,
          interventions: (p.armsInterventionsModule?.interventions ?? []).map((i: any) => i.name),
          countries, sites: locations.slice(0, 25).map((l) => ({ facility: l.facility, city: l.city, country: l.country })),
          start_date: p.statusModule?.startDateStruct?.date,
        },
      },
      to: disease, relation: "studies",
      confidence: phaseConfidence(phases), confidenceBasis: "clinical_phase",
      evidence: [{
        source: "ctgov", externalId: nct, url: `https://clinicaltrials.gov/study/${nct}`,
        publishedOn: p.statusModule?.lastUpdatePostDateStruct?.date,
        quote: p.identificationModule?.briefTitle,
      }],
    });
  }
  await g.markSynced("ctgov");
}

function phaseConfidence(phases: string[]) {
  if (phases.includes("PHASE3") || phases.includes("PHASE4")) return 0.8;
  if (phases.includes("PHASE2")) return 0.6;
  if (phases.includes("PHASE1")) return 0.4;
  return 0.5;
}
