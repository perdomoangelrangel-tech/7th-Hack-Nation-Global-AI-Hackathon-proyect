/**
 * Tests sobre el snapshot real (data/atlas.json): integridad de la evidencia, búsqueda con sinónimos,
 * el recorrido de Maria y que la narración nunca deja pasar una frase sin respaldo.
 */
import { describe, expect, it } from "vitest";
import { atlas, edgeDetail, journey, search } from "./store";
import { buildFacts, narrate } from "./narrate";

const STXBP1 = "disease:ORPHA:599373";

describe("graph integrity", () => {
  it("has no edge without evidence", () => {
    expect(atlas().snap.edges.every((e) => e.evidence.length > 0)).toBe(true);
  });
  it("labels every similar_to edge as inferred, never observed", () => {
    const sim = atlas().snap.edges.filter((e) => e.relation === "similar_to");
    expect(sim.length).toBeGreaterThan(0);
    expect(sim.every((e) => e.kind === "inferred")).toBe(true);
  });
  it("gives every evidence record a source, url and retrieval date", () => {
    for (const e of atlas().snap.edges) for (const ev of e.evidence) {
      expect(ev.source).toBeTruthy(); expect(ev.url).toMatch(/^https?:\/\//); expect(ev.retrieved_at).toBeTruthy();
    }
  });
  it("keeps the lysosomal diseases apart from the epileptic encephalopathies (counterexample to name-only grouping)", () => {
    const c = atlas().snap.analytics!.disease_cluster;
    expect(c["disease:ORPHA:228349"]).toBe(c["disease:ORPHA:228346"]); // CLN2 ~ CLN3
    expect(c["disease:ORPHA:228349"]).not.toBe(c[STXBP1]);
  });
});

describe("one global search", () => {
  it("resolves a synonym to its disease", () => {
    const hit = search("SMEI")[0];
    expect(hit.disease).toBe("disease:ORPHA:33069");
    expect(hit.via_synonym).toBe(true);
  });
  it("opens the graph from a gene alias", () => {
    expect(search("Munc18-1")[0]?.disease).toBe(STXBP1);
  });
  it("finds symptoms in Spanish", () => {
    expect(search("convulsiones", "es").some((h) => h.type === "phenotype")).toBe(true);
  });
});

describe("Maria's journey (STXBP1)", () => {
  const j = journey(STXBP1, "en")!;
  it("finds a supported connection, an existing asset, a collaborator and a next step", () => {
    expect(j.shares.length).toBeGreaterThan(0);
    expect(j.assets.own.length + j.assets.reusable.length).toBeGreaterThan(0);
    expect(j.collaborators.length).toBeGreaterThan(0);
    expect(j.steps.length).toBeGreaterThan(0);
  });
  it("explains each connection with its evidence edge", () => {
    const d = edgeDetail(j.shares[0].edge, "en")!;
    expect(d.edge.kind).toBe("inferred");
    expect(d.similarity?.shared_phenotypes.length).toBeGreaterThan(0);
  });
  it("reports search coverage so 'none found' means something", () => {
    expect(j.coverage.sources.length).toBeGreaterThan(5);
  });
});

describe("narration never speaks without a source", () => {
  it("every fact carries evidence", () => {
    const { facts } = buildFacts(journey(STXBP1, "en")!, "en");
    expect(facts.length).toBeGreaterThan(5);
    expect(facts.every((f) => f.evidence_ids.length > 0)).toBe(true);
  });
  it("keeps each spoken sentence short enough for voice", () => {
    const { facts } = buildFacts(journey(STXBP1, "en")!, "en");
    expect(facts.find((f) => f.kind === "disease")!.text.length).toBeLessThan(320);
  });
  it("template narration is fully verified and cites evidence per sentence", async () => {
    const n = (await narrate(STXBP1, "maria", "en"))!;
    expect(n.mode).toBe(process.env.OPENAI_API_KEY ? "openai" : "template");
    expect(n.verified).toBe(true);
    expect(n.claims.every((c) => c.evidence.length > 0)).toBe(true);
  });
});
