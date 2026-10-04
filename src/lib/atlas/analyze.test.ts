import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyze, withAnalytics } from "./analyze";
import type { AtlasSnapshot, Edge, Entity } from "./types";

const bundled = () => JSON.parse(readFileSync(join(process.cwd(), "data", "atlas.json"), "utf8")) as AtlasSnapshot;

const ev = (id: string) => [{ id: `ev:${id}`, source: "orphanet" as const, external_id: id, url: `https://example.org/${id}`, quote: null, published_on: null, retrieved_at: "2026-10-03T00:00:00Z" }];
const ent = (type: Entity["type"], cid: string, name = cid, props: Record<string, unknown> = {}): Entity => ({ id: `${type}:${cid}`, type, canonical_id: cid, name, props, aliases: [] });
const edge = (id: string, from: string, to: string, relation: Edge["relation"], confidence = 0.9, props: Record<string, unknown> = {}): Edge =>
  ({ id: `edge:${id}`, from, to, relation, kind: "observed", confidence, confidence_basis: "test", props, evidence: ev(id) });

/** Two diseases caused by the same gene (one truncating, one missense) plus an unrelated third one. */
function fixture(): AtlasSnapshot {
  const entities = [
    ent("disease", "ORPHA:1", "Loss disease"), ent("disease", "ORPHA:2", "Gain disease"), ent("disease", "ORPHA:3", "Other disease"),
    ent("gene", "HGNC:1", "GENE1"), ent("gene", "HGNC:3", "GENE3"),
    ent("phenotype", "HP:1", "Seizure"), ent("phenotype", "HP:2", "Ataxia"), ent("phenotype", "HP:3", "Rare sign"), ent("phenotype", "HP:4", "Cardiomyopathy"),
  ];
  const edges = [
    edge("c1", "gene:HGNC:1", "disease:ORPHA:1", "causes", 0.9, { primary: true, variant_counts: { total: 100, truncating: 80, missense: 15 } }),
    edge("c2", "gene:HGNC:1", "disease:ORPHA:2", "causes", 0.9, { primary: true, variant_counts: { total: 100, truncating: 5, missense: 90 } }),
    edge("c3", "gene:HGNC:3", "disease:ORPHA:3", "causes", 0.9, { primary: true }),
    edge("p11", "disease:ORPHA:1", "phenotype:HP:1", "has_phenotype"), edge("p12", "disease:ORPHA:1", "phenotype:HP:3", "has_phenotype"),
    edge("p21", "disease:ORPHA:2", "phenotype:HP:1", "has_phenotype"), edge("p22", "disease:ORPHA:2", "phenotype:HP:2", "has_phenotype"),
    edge("p33", "disease:ORPHA:3", "phenotype:HP:4", "has_phenotype"),
  ];
  return { version: 1, generated_at: "2026-10-03T00:00:00Z", sources: {}, entities, edges, analytics: null };
}

describe("analyze()", () => {
  it("is deterministic on the bundled snapshot", { timeout: 20_000 }, () => {
    const a = withAnalytics(bundled()), b = withAnalytics(bundled());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.analytics!.clusters.length).toBeGreaterThanOrEqual(2);
  });

  it("does not mutate its input", () => {
    const s = fixture(); const before = JSON.stringify(s);
    analyze(s);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("flags same gene, different mechanism as a counterexample", () => {
    const A = analyze(fixture());
    const c = A.counterexamples.find((x) => x.kind === "same_gene_different_mechanism");
    expect(c).toBeDefined();
    expect([c!.a, c!.b].sort()).toEqual(["disease:ORPHA:1", "disease:ORPHA:2"]);
    expect(c!.gene).toBe("GENE1");
    expect(c!.edges).toEqual(["edge:c1", "edge:c2"]);
    expect(A.variant_effect["disease:ORPHA:1"].call).toMatch(/loss of function/);
    expect(A.variant_effect["disease:ORPHA:2"].call).toMatch(/missense/);
    // The shared gene still makes them similar, but the explanation records the mismatch.
    const sim = Object.values(A.similarity).find((s) => s.shared_genes.includes("GENE1"));
    expect(sim?.variant_effect_match).toBe(false);
  });

  it("only emits inferred similar_to edges that cite evidence and observed supporting edges", () => {
    const s = withAnalytics(bundled());
    const inferred = s.edges.filter((e) => e.relation === "similar_to");
    expect(inferred.length).toBeGreaterThan(0);
    const ids = new Set(s.edges.map((e) => e.id));
    for (const e of inferred) {
      expect(e.kind).toBe("inferred");
      expect(e.evidence.length).toBeGreaterThanOrEqual(2);
      expect(e.evidence[0].source).toBe("nexmed_analysis");
      for (const sid of s.analytics!.similarity[e.id].supporting_edges) expect(ids.has(sid)).toBe(true);
    }
  });

  it("adds inferred mechanism nodes (loss vs gain/altered function) that cite the variant evidence, idempotently", () => {
    const s = withAnalytics(fixture());
    const mech = s.edges.filter((e) => e.relation === "has_mechanism");
    expect(mech.map((e) => [e.from, e.to]).sort()).toEqual([
      ["disease:ORPHA:1", "mechanism:LOSS_OF_FUNCTION"],
      ["disease:ORPHA:2", "mechanism:MISSENSE_UNRESOLVED"],
    ]);
    for (const e of mech) {
      expect(e.kind).toBe("inferred");
      expect(e.evidence[0].source).toBe("nexmed_analysis");
      expect(e.evidence.some((x) => x.external_id === "c1" || x.external_id === "c2")).toBe(true);
    }
    // ORPHA:3 has no variant profile -> no mechanism claim
    expect(mech.some((e) => e.from === "disease:ORPHA:3")).toBe(false);
    // re-running on its own output does not duplicate nodes or edges
    const again = withAnalytics(s);
    expect(again.entities.filter((e) => e.type === "mechanism")).toHaveLength(2);
    expect(again.edges.filter((e) => e.relation === "has_mechanism")).toHaveLength(2);
  });

  it("names every cluster with a label basis", () => {
    for (const c of analyze(bundled()).clusters) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.label_basis).toMatch(/Reactome pathway|Orphanet classification|phenotype|Only member|No shared|No Reactome pathway/);
    }
  });
});
