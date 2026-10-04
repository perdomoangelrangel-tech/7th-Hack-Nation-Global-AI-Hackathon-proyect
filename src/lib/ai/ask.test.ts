import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { resolveQuestion, safetyFlags, safetyNotice } from "./ask";
import { fixtureIndex } from "./fixtures.test-util";
import { PERSONAS } from "../agents/profiles";

const idx = fixtureIndex();

describe("ask · chat resolution (question → focus → history)", () => {
  it("a disease named in the question wins over focus", () => {
    expect(resolveQuestion(idx, "What about Beta disease?", "disease:ORPHA:1")?.disease).toBe("disease:ORPHA:2");
  });
  it("falls back to the focused entity (a gene maps to its disease)", () => {
    expect(resolveQuestion(idx, "who works on this?", "gene:HGNC:1")).toMatchObject({ disease: "disease:ORPHA:1", via: { method: "focus" } });
  });
  it("follow-up turns stay on the disease of the conversation", () => {
    const history = [{ role: "user", text: "Tell me about TSA" }, { role: "assistant", text: "TS-A is caused by GENE1." }, { role: "user", text: "and trials?" }];
    expect(resolveQuestion(idx, "and are there trials?", null, history)).toMatchObject({ disease: "disease:ORPHA:1", via: { method: "history" } });
  });
  it("nothing anywhere → null (honest not-in-the-atlas)", () => {
    expect(resolveQuestion(idx, "and trials?", null, [{ role: "user", text: "hello" }])).toBeNull();
  });
});

describe("ask · safety notice", () => {
  it("flags doses and cure questions with a fixed, dose-free, cure-free notice", () => {
    const f = safetyFlags("What dose cures it? Give me the mg/kg.");
    expect(f).toEqual(expect.arrayContaining(["dose", "promise"]));
    expect(safetyNotice(f, "en")).not.toMatch(/\bcure|\d+\s?mg/i);
  });
});

describe("personas", () => {
  it("osei is labeled Researcher & clinician (id unchanged)", () => {
    expect(PERSONAS.osei).toMatchObject({ id: "osei", mode: { en: "Researcher & clinician", es: "Investigador y clínico" } });
  });
});
