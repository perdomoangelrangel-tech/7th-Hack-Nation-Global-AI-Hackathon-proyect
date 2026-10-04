import { describe, expect, it } from "vitest";
import { lookupTerm, splitGlossary } from "./glossary";
import { KIND_BADGE, MODE_COPY, NODE_ICON, STEP_COPY, STEP_ICON } from "../../lib/icons";

describe("patient glossary", () => {
  it("finds terms and aliases in any case", () => {
    expect(lookupTerm("Phenotype")?.definition).toBe("a symptom or physical trait");
    expect(lookupTerm("loss-of-function")?.term).toBe("loss of function");
    expect(lookupTerm("Registries")?.term).toBe("registry");
    expect(lookupTerm("banana")).toBeUndefined();
  });

  it("wraps the first occurrence of each term, longest match first, whole words only", () => {
    const parts = splitGlossary("A natural history study and a registry; another registry. Pathwayish is not a pathway.");
    const hits = parts.filter((p) => typeof p !== "string") as { match: string; entry: { term: string } }[];
    expect(hits.map((h) => h.entry.term)).toEqual(["natural history study", "registry", "pathway"]);
    expect(parts.map((p) => (typeof p === "string" ? p : p.match)).join("")).toBe("A natural history study and a registry; another registry. Pathwayish is not a pathway.");
  });
});

describe("icon map", () => {
  it("covers every entity type, mode, step and kind with the exact copy", () => {
    for (const t of ["disease", "gene", "variant", "phenotype", "pathway", "trial", "study", "treatment", "organization", "investigator"] as const) expect(NODE_ICON[t]).toBeDefined();
    expect(MODE_COPY.devon.title).toBe("Patient or caregiver");
    expect(STEP_ICON).toHaveLength(4);
    expect(STEP_COPY[3]).toBe("What should we do together next?");
    expect(KIND_BADGE.proposed).toBe("Community draft · not evidence");
  });
});
