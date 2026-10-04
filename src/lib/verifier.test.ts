import { describe, it, expect } from "vitest";
import { verify, ensureHedged, unsafeReason, NO_EVIDENCE_ES, DISCLAIMER_ES } from "./verifier";

const ok = { spoken: "x", claims: [{ text: "SCN1A causa Dravet.", evidence_ids: ["e1"] }], next_steps: [] };

describe("verifier", () => {
  it("mantiene claims con evidencia del turno", () => {
    const v = verify(ok, ["e1"]);
    expect(v.verified).toBe(true);
    expect(v.claims).toHaveLength(1);
    expect(v.spoken).toContain("SCN1A causa Dravet.");
    expect(v.spoken).toContain(DISCLAIMER_ES);
  });
  it("elimina claims sin evidence_ids", () => {
    const v = verify({ ...ok, claims: [{ text: "Se cura con X.", evidence_ids: [] }] }, ["e1"]);
    expect(v.verified).toBe(false);
    expect(v.claims).toHaveLength(0);
    expect(v.spoken).not.toContain("Se cura con X.");
    expect(v.spoken).toContain(NO_EVIDENCE_ES);
  });
  it("elimina claims con evidencia que no devolvieron las herramientas", () => {
    const v = verify({ ...ok, claims: [{ text: "Dosis de 5 mg.", evidence_ids: ["inventada"] }] }, ["e1"]);
    expect(v.dropped[0].reason).toBe("unknown_evidence");
  });
  it("falla seguro con JSON inválido", () => {
    const v = verify({ foo: "bar" }, ["e1"]);
    expect(v.verified).toBe(false);
    expect(v.claims).toHaveLength(0);
  });
});

describe("verifier safety", () => {
  it("drops cited claims that state a dose", () => {
    const v = verify({ ...ok, claims: [{ text: "Give 0.7 mg/kg per day.", evidence_ids: ["e1"] }] }, ["e1"], "en");
    expect(v.claims).toHaveLength(0);
    expect(v.dropped[0].reason).toBe("unsafe_dose");
    expect(v.spoken).not.toMatch(/mg/);
  });
  it("drops cure promises but allows graph names that contain the word", () => {
    const v = verify({ ...ok, claims: [
      { text: "This therapy cures Rett syndrome.", evidence_ids: ["e1"] },
      { text: "KCNQ2 Cure Alliance is a patient organization.", evidence_ids: ["e1"] },
    ] }, ["e1"], "en", { allowNames: ["KCNQ2 Cure Alliance"] });
    expect(v.claims.map((c) => c.text)).toEqual(["KCNQ2 Cure Alliance is a patient organization."]);
    expect(v.dropped[0].reason).toBe("unsafe_cure");
  });
  it("always ends with the not-medical-advice disclaimer", () => {
    expect(verify(ok, ["e1"], "en").spoken).toMatch(/not a diagnosis or medical advice/);
    expect(unsafeReason("Variants in STXBP1 cause STXBP1-DEE.")).toBeNull();
  });
  it("hedges inferred and extracted claims that read as facts", () => {
    expect(ensureHedged("Dravet and KCNQ2-DEE share a mechanism.", "inferred", "en")).toMatch(/needs expert review\)\.$/);
    expect(ensureHedged("The atlas suggests a shared mechanism.", "inferred", "en")).toBe("The atlas suggests a shared mechanism.");
    expect(ensureHedged("SCN1A causes Dravet.", "observed", "en")).toBe("SCN1A causes Dravet.");
    expect(ensureHedged("El gen X causa Y.", "extracted", "es")).toMatch(/revisión de un experto\)\.$/);
  });
});
