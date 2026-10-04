import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { setLlmClient } from "./client";
import { CLINICIAN_LINE, findTreatment, medicineSummary } from "./medicine";
import { fakeLlm, fixtureIndex, fixtureSnapshot } from "./fixtures.test-util";

function idxWithMedicine() {
  const snap = fixtureSnapshot();
  const drug = snap.entities.find((e) => e.id === "treatment:CHEMBL1")!;
  drug.props = { drug_type: "Small molecule", mechanism: "Sodium channel blocker", mechanisms: ["Sodium channel blocker"] };
  snap.edges.push({
    id: "edge:t2", from: "treatment:CHEMBL1", to: "disease:ORPHA:1", relation: "treats", kind: "observed", confidence: 0.6, confidence_basis: "test",
    props: { approved: false, phase: 2, stage: "PHASE_2", stopped_reports: [] },
    evidence: [{ id: "ev:t2", source: "ctgov", external_id: "NCT00000001", url: "https://clinicaltrials.gov/study/NCT00000001", quote: null, published_on: null, retrieved_at: "2026-10-03T00:00:00Z" }],
  });
  return fixtureIndex(snap);
}
const idx = idxWithMedicine();
afterEach(() => setLlmClient(undefined));

describe("medicine · deterministic", () => {
  it("3–5 sentences from graph facts, every one cited, fixed clinician line last", async () => {
    setLlmClient(null);
    const r = (await medicineSummary(idx, { id: "treatment:CHEMBL1", persona: "maria", locale: "en" }))!;
    expect(r.mode).toBe("deterministic");
    expect(r.sentences.length).toBeGreaterThanOrEqual(3);
    expect(r.sentences.length).toBeLessThanOrEqual(5);
    expect(r.sentences.at(-1)).toEqual({ text: CLINICIAN_LINE.en, evidence_ids: [], kind: "notice" });
    for (const s of r.sentences.slice(0, -1)) expect(s.evidence_ids.length).toBeGreaterThan(0);
    const text = r.sentences.map((s) => s.text).join(" ");
    expect(text).toMatch(/Sodium channel blocker/);
    expect(text).toMatch(/approved for Beta disease/);
    expect(text).toMatch(/studied for TS-A \(phase 2\).*not approved/);
    expect(text).not.toMatch(/\d+\s?mg/);
  });
  it("resolves bare CHEMBL ids and names; unknown → null", async () => {
    expect(findTreatment(idx, "CHEMBL1")?.id).toBe("treatment:CHEMBL1");
    expect(findTreatment(idx, "drugamab")?.id).toBe("treatment:CHEMBL1");
    expect(await medicineSummary(idx, { id: "CHEMBL999", persona: "maria", locale: "en" })).toBeNull();
  });
  it("Patient mode defaults to plain language", async () => {
    setLlmClient(null);
    const r = (await medicineSummary(idx, { id: "CHEMBL1", persona: "devon", locale: "en" }))!;
    expect(r.sentences[0].text).toBe("Drugamab is a medicine that works as a sodium channel blocker.");
  });
});

describe("medicine · openai (mocked)", () => {
  it("drops efficacy numbers, doses and advice; keeps cited facts; appends the clinician line", async () => {
    const { client, calls } = fakeLlm({ sentences: [
      { text: "Drugamab is a sodium channel blocker approved for Beta disease.", fact_ids: ["f1", "f2"] },
      { text: "It reduced seizures by 40% in trials.", fact_ids: ["f3"] },
      { text: "The usual dose is 10 mg/kg.", fact_ids: ["f2"] },
      { text: "You should ask about joining the phase 2 study for TS-A.", fact_ids: ["f3"] },
      { text: "It is in a phase 2 study for TS-A and is not approved for it.", fact_ids: ["f3"] },
    ] });
    setLlmClient(client);
    const r = (await medicineSummary(idx, { id: "treatment:CHEMBL1", persona: "osei", locale: "en" }))!;
    expect(r.mode).toBe("openai");
    expect(r.sentences.map((s) => s.text)).toEqual([
      "Drugamab is a sodium channel blocker approved for Beta disease.",
      "It is in a phase 2 study for TS-A and is not approved for it.",
      CLINICIAN_LINE.en,
    ]);
    expect(r.dropped.map((d) => d.reason).sort()).toEqual(["advice_without_fact", "efficacy_claim", "unsafe_dose"]);
    expect(calls[0].system).toMatch(/Never give doses, efficacy figures/);
  });
});
