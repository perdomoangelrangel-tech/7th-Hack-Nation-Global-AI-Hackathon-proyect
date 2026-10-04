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
    expect(calls[0].system).toMatch(/Never give doses, amounts, efficacy figures/);
  });
});

const extras = {
  label_use: "1 INDICATIONS AND USAGE Drugamab is indicated for the treatment of seizures associated with Beta disease in patients 2 years of age and older. Limitations of use apply.",
  label_url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=abc", rx_status: "Prescription", routes: ["ORAL"],
  regulatory: { fda: { application_number: "NDA000001" }, ema: { status: "Authorised", url: "https://www.ema.europa.eu/en/medicines/human/EPAR/drugamab" } },
  papers: [{ pmid: "111", title: "Efficacy of Drugamab in Beta disease: a randomized trial", journal: "J Test", year: 2024, pub_type: "Randomized Controlled Trial", disease_id: "disease:ORPHA:2" }],
};

describe("medicine · 0015 fields (label use, Rx, routes, EMA, papers)", () => {
  it("adds cited label, Rx/route, EMA and papers facts; evidence objects are returned; titles stay in citations", async () => {
    setLlmClient(null);
    const r = (await medicineSummary(idx, { id: "CHEMBL1", persona: "osei", locale: "en" }, extras))!;
    const all = (await import("./medicine")).medicineFacts(idx, idx.byId.get("treatment:CHEMBL1")!, "en", extras);
    const texts = all.facts.map((f) => f.text).join("\n");
    expect(texts).toMatch(/official FDA label \(DailyMed\) describes its use as: "Drugamab is indicated for the treatment of seizures associated with Beta disease in patients 2 years of age and older\./);
    expect(texts).toMatch(/In the US it is a prescription medicine and is given by the oral route \(openFDA\)/);
    expect(texts).toMatch(/European Medicines Agency \(EMA\) lists its status as "Authorised"/);
    expect(texts).toMatch(/PubMed indexes 1 clinical paper\(s\) on this medicine in Beta disease \(randomized controlled trial\)/);
    expect(texts).not.toMatch(/Efficacy of Drugamab/); // the title lives in the citation only
    expect(all.evidence.map((e) => e.id).sort()).toEqual(["ema:CHEMBL1", "label:CHEMBL1", "pmid:111"]);
    for (const s of r.sentences.slice(0, -1)) for (const id of s.evidence_ids) expect(r.evidence.some((e) => e.id === id)).toBe(true);
    expect(r.sentences.at(-1)?.text).toBe(CLINICIAN_LINE.en);
  });
});

describe("medicine · answers on the medicine page (/api/ask focus treatment)", () => {
  it("answers about the medicine with cited claims; drops efficacy and doses", async () => {
    const { medicineAnswer, medicineFacts } = await import("./medicine");
    const t = idx.byId.get("treatment:CHEMBL1")!;
    const ids = medicineFacts(idx, t, "en", extras).facts.map((f) => `${f.id}:${f.text.slice(0, 30)}`);
    const label = ids.find((x) => x.includes("official FDA label"))!.split(":")[0];
    setLlmClient(fakeLlm({ sentences: [
      { text: "Its label says it is indicated for seizures associated with Beta disease.", fact_ids: [label] },
      { text: "In the trial it cut seizures by 50%.", fact_ids: [label] },
      { text: "Take 5 mg per day.", fact_ids: [label] },
    ] }).client);
    const a = await medicineAnswer(idx, t, { question: "What is it approved for?", persona: "devon", locale: "en" }, extras);
    expect(a.claims.map((c) => c.text)).toEqual(["Its label says it is indicated for seizures associated with Beta disease."]);
    expect(a.claims[0].evidence[0]).toMatchObject({ id: "label:CHEMBL1", source: "fda", url: extras.label_url });
    expect(a.dropped.map((d) => d.reason).sort()).toEqual(["efficacy_claim", "unsafe_dose"]);
    expect(a.closing).toBe(CLINICIAN_LINE.en);
  });
});

describe("medicine names in text", () => {
  it("salt forms resolve ('testamine' → Testamine hydrochloride) and questions name medicines", async () => {
    const { fixtureSnapshot: snapFn, fixtureIndex: idxFn } = await import("./fixtures.test-util");
    const snap = snapFn();
    snap.entities.push({ id: "treatment:CHEMBL7", type: "treatment", canonical_id: "CHEMBL7", name: "Testamine hydrochloride", props: {}, aliases: [] });
    const i2 = idxFn(snap);
    const { findTreatmentInText } = await import("./reconcile");
    expect(findTreatmentInText(i2, "How does testamine work?")?.entity_id).toBe("treatment:CHEMBL7");
    expect(findTreatmentInText(i2, "How does it work for the disease?")).toBeNull();
  });
});

describe("medicine · 'approved' means approved for THAT disease", () => {
  it("approved:true on a PHASE_3 indication (Open Targets drug-level flag) is reported as studied, not approved", async () => {
    setLlmClient(null);
    const { fixtureSnapshot: snapFn, fixtureIndex: idxFn } = await import("./fixtures.test-util");
    const snap = snapFn();
    snap.edges.push({ id: "edge:t3", from: "treatment:CHEMBL1", to: "disease:ORPHA:3", relation: "treats", kind: "observed", confidence: 0.6, confidence_basis: "test",
      props: { approved: true, stage: "PHASE_3", phase: 3 }, evidence: [{ id: "ev:t3", source: "opentargets", external_id: "x", url: "https://example.org/x", quote: null, published_on: null, retrieved_at: "2026-10-04T00:00:00Z" }] });
    snap.edges.push({ id: "edge:t4", from: "treatment:CHEMBL1", to: "disease:ORPHA:4", relation: "treats", kind: "observed", confidence: 0.9, confidence_basis: "test",
      props: { approved: true, stage: "APPROVAL", regulatory_check: "not_confirmed_by_label" }, evidence: [{ id: "ev:t4", source: "opentargets", external_id: "y", url: "https://example.org/y", quote: null, published_on: null, retrieved_at: "2026-10-04T00:00:00Z" }] });
    const { medicineFacts } = await import("./medicine");
    const text = medicineFacts(idxFn(snap), snap.entities.find((e) => e.id === "treatment:CHEMBL1")!, "en").facts.map((f) => f.text).join("\n");
    expect(text).toMatch(/approved for Beta disease\./);
    expect(text).not.toMatch(/approved for[^.]*Gamma lipofuscinosis 1/);
    expect(text).toMatch(/studied for Gamma lipofuscinosis 1 \(phase 3\).*not approved/);
    expect(text).toMatch(/approval stage for Gamma lipofuscinosis 2, but its official FDA label does not name that disease/); // label audit rejected it
  });
});
