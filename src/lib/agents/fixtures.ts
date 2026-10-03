/** Synthetic test fixtures (unit tests only; never rendered). IDs are obviously fake. */
import type { DiseaseMap, DiseaseSummary, LineKey, Station } from "../atlas-data";
import { computeGaps } from "./evidence";

let n = 0;
export function station(name: string, extra: Partial<Station> = {}, evidenceCount = 1): Station {
  n += 1;
  return {
    id: `ent-${n}`, name, canonical_id: `TEST:${n}`, props: {}, relation: null, confidence: 0.9, edge_props: {}, weak: false,
    evidence: Array.from({ length: evidenceCount }, (_, i) => ({ id: `ev-${n}-${i}`, source: "orphanet", external_id: `TEST:${n}/${i}`, url: `https://example.test/${n}`, published_on: "2025-01-01", retrieved_at: "2026-10-03T00:00:00Z" })),
    ...extra,
  };
}

export const testDiseases: DiseaseSummary[] = [
  { id: "d1", orpha: "ORPHA:33069", name: "Dravet syndrome", name_es: "Síndrome de Dravet", short: "Dravet", aliases: ["severe myoclonic epilepsy of infancy"] },
  { id: "d2", orpha: "ORPHA:778", name: "Rett syndrome", name_es: "Síndrome de Rett", short: "Rett", aliases: [] },
  { id: "d3", orpha: "ORPHA:505652", name: "CDKL5 deficiency disorder", name_es: "Trastorno por deficiencia de CDKL5", short: "CDKL5", aliases: [] },
  { id: "d4", orpha: "ORPHA:72", name: "Angelman syndrome", name_es: "Síndrome de Angelman", short: "Angelman", aliases: [] },
  { id: "d5", orpha: "ORPHA:228349", name: "CLN2 disease (late infantile neuronal ceroid lipofuscinosis)", name_es: "Enfermedad CLN2", short: "CLN2", aliases: ["Batten disease CLN2"] },
];

export function testMap(over: Partial<Record<LineKey, Station[]>> = {}): DiseaseMap {
  const lines: Record<LineKey, Station[]> = {
    genes: [station("GENE1", { edge_props: { association_type: "Disease-causing germline mutation(s) in" } }, 2)],
    phenotypes: [station("Febrile seizure", { edge_props: { frequency: "Very frequent (99-80%)" } }), station("Ataxia", { confidence: 0.17, weak: true })],
    treatments: [station("DRUG A", { props: { approved: true }, edge_props: { phase: 4 } }, 2), station("DRUG B", { props: { approved: false }, edge_props: { phase: 2 } })],
    trials: [station("A trial of drug B", { props: { status: "RECRUITING", phases: ["PHASE2"], countries: ["Mexico", "Spain"] } }), station("An older trial", { props: { status: "COMPLETED", phases: ["PHASE3"], countries: ["United States"] } })],
    literature: [station("A review", { props: { journal: "Test Journal" } })],
    community: [station("Family Org", { props: { kind: "patient_org", country: "US", url: "https://example.test/org" } }), station("Dr Test", { props: { kind: "researcher", affiliation: "Test Lab", role: "researcher" } })],
    ...over,
  };
  const totals = Object.fromEntries(Object.entries(lines).map(([k, v]) => [k, v.length])) as Record<LineKey, number>;
  return { disease: { ...testDiseases[0], props: {} }, lines, totals, gaps: computeGaps(lines, totals), source: "snapshot", retrieved_at: "2026-10-03T00:00:00Z" };
}

export const allEvidenceIds = (m: DiseaseMap) => new Set(Object.values(m.lines).flatMap((l) => l.flatMap((s) => s.evidence.map((e) => e.id))));
