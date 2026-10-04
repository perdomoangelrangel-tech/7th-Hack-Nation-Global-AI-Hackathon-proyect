import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { setLlmClient } from "./client";
import { findDiseaseInText, reconcile, reconcileOne } from "./reconcile";
import { fakeLlm, fixtureIndex } from "./fixtures.test-util";

const idx = fixtureIndex();
afterEach(() => setLlmClient(undefined));

describe("reconcile · deterministic tiers", () => {
  it("canonical id", () => {
    expect(reconcileOne(idx, "ORPHA:1")).toMatchObject({ entity_id: "disease:ORPHA:1", method: "canonical_id", confidence: 1 });
    expect(reconcileOne(idx, "hp:0001250")).toMatchObject({ entity_id: "phenotype:HP:0001250", method: "canonical_id" });
  });
  it("exact name, short name and accents/case", () => {
    expect(reconcileOne(idx, "testing SYNDROME type a")).toMatchObject({ entity_id: "disease:ORPHA:1", method: "exact" });
    expect(reconcileOne(idx, "TS-A")).toMatchObject({ entity_id: "disease:ORPHA:1", method: "exact", matched_synonym: "TS-A" });
  });
  it("alias → synonym reported", () => {
    expect(reconcileOne(idx, "TSA")).toMatchObject({ entity_id: "disease:ORPHA:1", method: "alias", matched_synonym: "TSA" });
    expect(reconcileOne(idx, "munc 1")).toMatchObject({ entity_id: "gene:HGNC:1", method: "alias" });
  });
  it("normalized: generic words and punctuation ignored", () => {
    expect(reconcileOne(idx, "Testing-A disorder")).toMatchObject({ entity_id: "disease:ORPHA:1", method: "normalized" });
  });
  it("fuzzy with candidates; type filter", () => {
    const m = reconcileOne(idx, "beta illness");
    expect(m).toMatchObject({ entity_id: "disease:ORPHA:2", method: "fuzzy" });
    expect(m.confidence).toBeLessThan(0.9);
    expect(reconcileOne(idx, "GENE1", { type: "disease" }).entity_id).toBeNull();
  });
  it("unknown names stay unmatched (never invented)", () => {
    expect(reconcileOne(idx, "Zorblax-Kettering syndrome")).toMatchObject({ entity_id: null, method: "none" });
  });
});

describe("reconcile · LLM tie-break (mocked)", () => {
  it("is not called when deterministic tiers are confident", async () => {
    const { client, calls } = fakeLlm({ choices: [] });
    setLlmClient(client);
    const r = await reconcile(idx, ["TSA", "ORPHA:2"]);
    expect(calls).toHaveLength(0);
    expect(r.mode).toBe("deterministic");
  });
  it("breaks an ambiguous fuzzy tie among the candidates only", async () => {
    const { client, calls } = fakeLlm({ choices: [{ name: "gamma lipofuscinosis", entity_id: "disease:ORPHA:4" }] });
    setLlmClient(client);
    const r = await reconcile(idx, ["gamma lipofuscinosis"]);
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toContain("disease:ORPHA:3");
    expect(r.mode).toBe("openai");
    expect(r.matches[0]).toMatchObject({ entity_id: "disease:ORPHA:4", method: "llm" });
  });
  it("ignores an id the model invents", async () => {
    setLlmClient(fakeLlm({ choices: [{ name: "gamma lipofuscinosis", entity_id: "disease:ORPHA:999999" }] }).client);
    const r = await reconcile(idx, ["gamma lipofuscinosis"]);
    expect(r.matches[0].entity_id).not.toBe("disease:ORPHA:999999");
    expect(r.matches[0].method).toBe("fuzzy");
  });
  it("deterministic fallback without key keeps the fuzzy best guess", async () => {
    setLlmClient(null);
    const r = await reconcile(idx, ["gamma lipofuscinosis"]);
    expect(r.mode).toBe("deterministic");
    expect(r.matches[0].method).toBe("fuzzy");
    expect(r.matches[0].candidates.map((c) => c.entity_id).sort()).toEqual(["disease:ORPHA:3", "disease:ORPHA:4"]);
  });
});

describe("findDiseaseInText (QA-01)", () => {
  it("resolves a gene named in a question to its primary disease", () => {
    expect(findDiseaseInText(idx, "Who else works on my mechanism? My gene is GENE1")).toMatchObject({ disease: "disease:ORPHA:1", via: { type: "gene", mention: "GENE1" } });
  });
  it("resolves a synonym and a bare distinctive word", () => {
    expect(findDiseaseInText(idx, "What is TSA?")?.disease).toBe("disease:ORPHA:1");
    expect(findDiseaseInText(idx, "tell me about beta")?.disease).toBe("disease:ORPHA:2");
  });
  it("returns null for a made-up disease and for stray generic words", () => {
    expect(findDiseaseInText(idx, "Tell me about Zorblax-Kettering syndrome")).toBeNull();
    expect(findDiseaseInText(idx, "What treatment works for the syndrome with seizures?")).toBeNull();
  });
});

describe("reconcile · fuzzy always confirmed by the model when available", () => {
  it("a single fuzzy match the model rejects becomes none", async () => {
    setLlmClient(fakeLlm({ choices: [{ name: "beta illness", entity_id: "none" }] }).client);
    const r = await reconcile(idx, ["beta illness"]);
    expect(r.matches[0]).toMatchObject({ entity_id: null, method: "none" });
  });
  it("a single fuzzy match the model confirms becomes llm", async () => {
    setLlmClient(fakeLlm({ choices: [{ name: "beta illness", entity_id: "disease:ORPHA:2" }] }).client);
    const r = await reconcile(idx, ["beta illness"]);
    expect(r.matches[0]).toMatchObject({ entity_id: "disease:ORPHA:2", method: "llm" });
  });
});
