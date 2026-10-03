import { describe, expect, it } from "vitest";
import { MAX_BYTES, communitiesTool, diseaseTool, gapsTool, matchPhenotypes, trialsTool, treatmentsTool } from "./tools";
import { computeGaps, fmtList, isApproved, prevalenceLabel, shortName, trialPhases } from "./evidence";
import { station, testMap } from "./fixtures";

describe("tool responses", () => {
  it("stay under the size budget even with long lists", () => {
    const many = Array.from({ length: 60 }, (_, i) => station(`A very long trial title number ${i} `.repeat(6), { props: { status: "RECRUITING", countries: ["Mexico", "Spain", "France", "Italy", "Chile"] } }, 3));
    const r = trialsTool(testMap({ trials: many }));
    expect(JSON.stringify(r).length).toBeLessThanOrEqual(MAX_BYTES);
    expect(r.items.every((i) => i.evidence_ids.length > 0 && i.summary.length <= 220)).toBe(true);
  });
  it("filters trials by country and recruiting status", () => {
    expect(trialsTool(testMap(), { country: "mex" }).items).toHaveLength(1);
    expect(trialsTool(testMap(), { recruiting: true }).items[0].summary).toContain("RECRUITING");
  });
  it("lists approved treatments first and says when nothing is there", () => {
    expect(treatmentsTool(testMap()).items[0].summary).toContain("approved");
    expect(treatmentsTool(testMap({ treatments: [] })).note).toMatch(/no evidence/i);
  });
  it("disease, communities and gaps carry evidence ids", () => {
    expect(diseaseTool(testMap()).items[0].evidence_ids.length).toBeGreaterThan(0);
    expect(communitiesTool(testMap()).items.length).toBe(2);
    expect(gapsTool(testMap()).items.length).toBeGreaterThan(0);
  });
  it("ranks diseases by matching HPO phenotypes", () => {
    const a = testMap();
    const hpo = a.lines.phenotypes[0].canonical_id;
    const rows = matchPhenotypes([a, testMap({ phenotypes: [] })], [hpo]);
    expect(rows).toHaveLength(1);
    expect(rows[0].matched).toEqual([hpo]);
  });
});

describe("evidence helpers", () => {
  it("derives gaps from the graph only", () => {
    const m = testMap({ literature: [], treatments: [station("X", { props: { approved: false }, edge_props: { phase: 2 } })] });
    const kinds = computeGaps(m.lines, { ...m.totals, literature: 0 }).map((g) => g.kind);
    expect(kinds).toContain("empty_line");
    expect(kinds).toContain("no_approved_treatment");
    expect(kinds).toContain("single_source");
  });
  it("approval is per indication: a drug approved elsewhere but only tested here is investigational", () => {
    expect(isApproved(station("D", { props: { approved: true }, edge_props: { approved_for_indication: false, stage: "PHASE_3", phase: 3 } }))).toBe(false);
    expect(isApproved(station("E", { props: { approved: true }, edge_props: { approved_for_indication: true, stage: "APPROVAL", phase: 4 } }))).toBe(true);
    expect(isApproved(station("F", { edge_props: { phase: 4, investigational: true } }))).toBe(false);
  });
  it("reads trial phases and prevalence in both data shapes", () => {
    expect(trialPhases(station("T", { props: { phase: "PHASE2" } }))).toBe("2");
    expect(trialPhases(station("U", { props: { phases: ["PHASE2", "PHASE3"] } }))).toBe("2/3");
    expect(prevalenceLabel([{ type: "Point prevalence", class: "Unknown" }, { type: "Prevalence at birth", class: "1-9 / 100 000", geographic: "Europe" }])).toBe("1-9 / 100 000 · Prevalence at birth · Europe");
    expect(prevalenceLabel("1-9 / 1 000 000")).toBe("1-9 / 1 000 000");
  });
  it("short names and lists", () => {
    expect(shortName("CLN2 disease (late infantile neuronal ceroid lipofuscinosis)")).toBe("CLN2");
    expect(shortName("Dravet syndrome")).toBe("Dravet");
    expect(fmtList(["a", "b", "c"], "es")).toBe("a, b y c");
    expect(fmtList(["a"], "en")).toBe("a");
  });
});
