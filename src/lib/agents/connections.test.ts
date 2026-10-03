import { describe, expect, it } from "vitest";
import { buildExplainMessages, buildNeighbor, connectionClaims, explainDraft, pairEvidenceIds, rankNeighbors, scorePair, treatmentSentence, trialLabel, trialStatusText, type DiseaseRef, type LinkItem } from "./connections";
import { approvalOf, externalIdShort, sourceLabel } from "./evidence";
import { detectIntents } from "./detect";
import { verify } from "../verifier";

const ev = (id: string, side: string) => ({ id, source: "orphanet", external_id: `TEST/${id}`, url: `https://example.test/${id}`, published_on: null, retrieved_at: "2026-10-03T00:00:00Z", side });
const here: DiseaseRef = { orpha: "ORPHA:1", name: "Alpha syndrome", name_es: "Síndrome Alpha", short: "Alpha" };
const there: DiseaseRef = { orpha: "ORPHA:2", name: "Beta syndrome", name_es: "Síndrome Beta", short: "Beta" };
const umbrella = [{ code: "ORG:umbrella", name: "Umbrella Org", url: "https://example.test/u" }];

const item = (kind: LinkItem["kind"], name: string, extra: Partial<LinkItem> = {}): LinkItem => ({
  kind, name, code: `TEST:${name}`, props: {}, here: {}, there: {}, confidence: 0.5,
  evidence_here: [ev(`h-${name}`, "a")], evidence_there: [ev(`t-${name}`, "b")], ...extra,
});

const drug = item("treatment", "Drugamine", { here: { phase: 3, approved_for_indication: false, nct_ids: ["NCT00000001"] }, there: { phase: 4, approved_for_indication: true } });
const trial = item("trial", "Shared study", { code: "NCT00000002", props: { status: "RECRUITING" } });
const person = item("researcher", "Dr Test", { code: null, evidence_here: [{ ...ev("link:pubmed:1", "a"), source: "pubmed" }], evidence_there: [{ ...ev("link:pubmed:2", "b"), source: "pubmed", url: "https://pubmed.ncbi.nlm.nih.gov/2/" }] });
const phens = ["Seizure", "Ataxia", "Autistic behavior", "Drooling"].map((n) => item("phenotype", n));
const org = item("organization", "Umbrella Org", { code: "ORG:umbrella" });

describe("scorePair", () => {
  it("follows the published formula", () => {
    const s = scorePair({ phenotype: 4, treatment: 3, researcher: 2 }, 52, 46);
    expect(s.phenotypes.union).toBe(94);
    expect(s.phenotypes.value).toBeCloseTo(0.5 * 4 / 94, 3);
    expect(s.treatments.value).toBe(0.2);
    expect(s.trials.value).toBe(0);
    expect(s.researchers.value).toBe(0.15);
    expect(s.total).toBeCloseTo(0.371, 3);
  });
  it("is zero with nothing shared", () => {
    expect(scorePair({}, 10, 10).total).toBe(0);
  });
});

describe("buildNeighbor", () => {
  const n = buildNeighbor({ disease: there, items: [drug, trial, person, org, ...phens], phenHere: 20, phenThere: 30, umbrella });
  it("does not score umbrella organizations", () => {
    expect(n.shared.organization).toHaveLength(0);
    expect(n.umbrella.map((u) => u.code)).toEqual(["ORG:umbrella"]);
    expect(n.counts.organization).toBe(0);
  });
  it("derives next steps: approved there + investigational here → ask the sponsor; shared trial; researcher call", () => {
    expect(n.steps.map((s) => s.kind)).toEqual(["ask_sponsor", "trial_eligibility", "joint_call"]);
    expect(n.steps[0]).toMatchObject({ item: "Drugamine", nct: "NCT00000001", neighborPhase: 4, herePhase: 3 });
    expect(n.steps[2].url).toBe("https://pubmed.ncbi.nlm.nih.gov/2/");
    expect(n.steps[2].evidence_ids).toEqual([]);
    expect(n.validate).toEqual(["mechanism", "transfer"]);
  });
  it("marks an honest gap when only umbrella organizations are shared, and ranks it last", () => {
    const gap = buildNeighbor({ disease: { ...there, orpha: "ORPHA:3", name: "Gamma" }, items: [org], phenHere: 20, phenThere: 10, umbrella });
    expect(gap.gap).toBe(true);
    expect(gap.steps.map((s) => s.kind)).toEqual(["investigate"]);
    expect(rankNeighbors([gap, n])[0].disease.orpha).toBe("ORPHA:2");
  });
  it("never exposes researcher links as evidence ids", () => {
    expect(pairEvidenceIds(n).some((id) => id.startsWith("link:"))).toBe(false);
    expect(pairEvidenceIds(n)).toContain("h-Drugamine");
  });
});

describe("trial steps follow the registry status", () => {
  const early = item("trial", "Early Check: Expanded Screening in Newborns", { code: "NCT00000010", props: { status: "ACTIVE_NOT_RECRUITING" } });
  const pixi = item("trial", "Parent and Infant Inter(X)Action Intervention (PIXI)", { code: "NCT00000011", props: { status: "ENROLLING_BY_INVITATION" } });
  const wings = item("trial", "Web Intervention for Parents of Youth With Genetic Syndromes (WINGS)", { code: "NCT00000012", props: { status: "ACTIVE_NOT_RECRUITING" } });
  it("prefers the study that still enrolls and names it by its acronym", () => {
    const n = buildNeighbor({ disease: there, items: [early, pixi, wings, person, ...phens], phenHere: 20, phenThere: 30, umbrella });
    expect(n.shared.trial[0].name).toMatch(/PIXI/);
    expect(n.steps[0]).toMatchObject({ kind: "trial_eligibility", label: "PIXI", status: "ENROLLING_BY_INVITATION", nct: "NCT00000011" });
    expect(connectionClaims(here, n, "en", "family")[0].text).toContain("(enrolling by invitation)");
  });
  it("never calls an active-not-recruiting study enrolling: it becomes a results step", () => {
    const n = buildNeighbor({ disease: there, items: [early, wings], phenHere: 20, phenThere: 30, umbrella });
    expect(n.steps[0]).toMatchObject({ kind: "trial_results", status: "ACTIVE_NOT_RECRUITING" });
    expect(trialStatusText("ACTIVE_NOT_RECRUITING", "en")).toBe("active, not recruiting");
    expect(trialStatusText("ENROLLING_BY_INVITATION", "es")).toBe("inscripción por invitación");
  });
  it("derives short trial labels", () => {
    expect(trialLabel(pixi.name, pixi.code)).toBe("PIXI");
    expect(trialLabel(early.name, early.code)).toBe("Early Check");
    expect(trialLabel("A Long Randomized Placebo-Controlled Study of Something", "NCT00000013")).toBe("NCT00000013");
  });
});

describe("regulatory approvals", () => {
  it("labels FDA approvals as agency + year and keeps chips short", () => {
    expect(approvalOf({ approval: { agency: "FDA", date: "2022-03", url: "https://www.fda.gov/x" } })).toMatchObject({ label: "FDA 2022", url: "https://www.fda.gov/x" });
    expect(approvalOf({ approved_for_indication: true })).toBeNull();
    expect(sourceLabel("fda")).toBe("FDA");
    expect(externalIdShort("fda", "FDA:ztalmy-2022")).toBe("ztalmy-2022");
    expect(externalIdShort("ctgov", "NCT05249556")).toBe("NCT05249556");
  });
});

describe("claims and explain", () => {
  const n = buildNeighbor({ disease: there, items: [drug, trial, person, ...phens], phenHere: 20, phenThere: 30, umbrella });
  it("states approval per side", () => {
    expect(treatmentSentence(drug, here, there, "en")).toBe("Drugamine is approved for Beta syndrome (phase 4) and in phase 3 for Alpha syndrome (NCT00000001).");
    expect(treatmentSentence(drug, here, there, "es")).toBe("Drugamine: aprobado para el síndrome Beta (fase 4) y en fase 3 para el síndrome Alpha (NCT00000001).");
  });
  it("every claim cites only this pair's evidence and survives the verifier", () => {
    const allowed = pairEvidenceIds(n);
    const claims = connectionClaims(here, n, "en", "family");
    expect(claims.length).toBeGreaterThan(1);
    const v = verify({ spoken: "", claims, next_steps: [] }, allowed, "en");
    expect(v.verified).toBe(true);
    expect(v.claims).toHaveLength(claims.length);
  });
  it("deterministic explain of a gap says there is no evidence", () => {
    const gap = buildNeighbor({ disease: there, items: [], phenHere: 1, phenThere: 1, umbrella });
    const v = verify(explainDraft(here, gap, "en", "family"), pairEvidenceIds(gap), "en");
    expect(v.dropped).toHaveLength(1);
  });
  it("the OpenAI prompt exposes exactly the pair's evidence ids and asks for JSON", () => {
    const m = buildExplainMessages(here, n, "es", "clinical");
    expect(new Set(m.allowed)).toEqual(new Set(pairEvidenceIds(n)));
    for (const id of m.allowed) expect(m.user).toContain(id);
    expect(m.user).not.toContain("link:pubmed");
    expect(m.system).toMatch(/JSON/);
    expect(m.system).toMatch(/Spanish/);
  });
});

describe("connections intent", () => {
  it("is detected in EN and ES", () => {
    expect(detectIntents("Which diseases share our characteristics?")).toContain("connections");
    expect(detectIntents("¿Qué enfermedades son parecidas a CDKL5?")).toContain("connections");
    expect(detectIntents("¿Con quién podemos colaborar?")).toContain("connections");
    expect(detectIntents("What treatments exist?")).not.toContain("connections");
  });
});
