import { describe, expect, it } from "vitest";
import { demoDraft } from "./demo";
import { toolsForTurn, onlyAllowed } from "./turn";
import { detectIntents } from "./detect";
import { PROFILES, type Audience } from "./profiles";
import { verify, NO_EVIDENCE_EN, NO_EVIDENCE_ES, DISCLAIMER_EN, DISCLAIMER_ES } from "../verifier";
import { allEvidenceIds, testMap } from "./fixtures";

const run = (aud: Audience, locale: "en" | "es", q: string, map = testMap()) => {
  const { evidence } = toolsForTurn(map, PROFILES[aud].tools, detectIntents(q));
  const allowed = new Set(evidence.map((e) => e.id));
  return verify(onlyAllowed(demoDraft(map, aud, locale, q), allowed), allowed, locale);
};

describe("demoDraft", () => {
  it.each(["family", "clinical", "research"] as Audience[])("%s: every claim cites evidence from the map", (aud) => {
    const map = testMap();
    const ids = allEvidenceIds(map);
    const d = demoDraft(map, aud, "en", "Tell me about it");
    expect(d.claims.length).toBeGreaterThan(0);
    for (const c of d.claims) {
      expect(c.evidence_ids.length).toBeGreaterThan(0);
      for (const id of c.evidence_ids) expect(ids.has(id)).toBe(true);
    }
  });

  it.each(["family", "clinical", "research"] as Audience[])("%s: verified answer keeps all default claims", (aud) => {
    const v = run(aud, "en", "Tell me about it");
    expect(v.verified).toBe(true);
    expect(v.claims.length).toBeGreaterThan(0);
    expect(v.spoken.endsWith(DISCLAIMER_EN)).toBe(true);
  });

  it("a question about a cure is answered with 'no evidence' (claim dropped by the verifier)", () => {
    const v = run("family", "en", "Is there a cure for Dravet?");
    expect(v.dropped.map((d) => d.text)).toContain("A cure for Dravet syndrome.");
    const es = run("family", "es", "¿Hay cura para el síndrome de Dravet?");
    expect(es.dropped.map((d) => d.text)).toContain("Una cura para el síndrome de Dravet.");
    expect(v.spoken).toContain(NO_EVIDENCE_EN);
    expect(v.spoken).not.toContain("A cure for");
  });

  it("asking for something the graph lacks drops it instead of inventing", () => {
    const v = run("family", "en", "Are there clinical trials?", testMap({ trials: [] }));
    expect(v.dropped.some((d) => d.text.includes("Clinical trials"))).toBe(true);
  });

  it("speaks Spanish when asked in Spanish", () => {
    const v = run("family", "es", "¿Qué tratamientos hay?");
    expect(v.spoken).toContain("aprobados");
    expect(v.spoken.endsWith(DISCLAIMER_ES)).toBe(true);
    expect(v.spoken).not.toContain(NO_EVIDENCE_ES);
  });

  it("clinical answers carry codes; research answers name gaps", () => {
    expect(run("clinical", "en", "genes?").claims[0].text).toMatch(/TEST:\d+/);
    const r = run("research", "en", "What are the gaps?");
    expect(r.claims.some((c) => /single source|low confidence/.test(c.text))).toBe(true);
  });

  it("returns nothing without a map", () => {
    expect(demoDraft(null, "family", "en", "x")).toEqual({ spoken: "", claims: [], next_steps: [] });
  });
});

describe("onlyAllowed", () => {
  it("removes drafter slips but keeps intentionally unsourced claims for the verifier", () => {
    const out = onlyAllowed({ spoken: "", claims: [{ text: "a", evidence_ids: ["x"] }, { text: "b", evidence_ids: [] }, { text: "c", evidence_ids: ["ok"] }], next_steps: [] }, new Set(["ok"]));
    expect(out.claims.map((c) => c.text)).toEqual(["b", "c"]);
  });
});
