import { describe, it, expect } from "vitest";
import { verify, NO_EVIDENCE_ES, DISCLAIMER_ES } from "./verifier";

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
