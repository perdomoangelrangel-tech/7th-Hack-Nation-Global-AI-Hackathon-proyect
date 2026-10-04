import { describe, expect, it } from "vitest";
import { applyOverlays, rowsToSnapshot, type SnapshotRows } from "./snapshot";
import type { AtlasSnapshot } from "../atlas/types";

const T = "2026-10-03T00:00:00Z";
function rows(over: Partial<SnapshotRows> = {}): SnapshotRows {
  return {
    entities: [
      { id: "u-d", type: "disease", canonical_id: "ORPHA:599373", name: "STXBP1-DEE", props: { genes_seed: ["STXBP1"] } },
      { id: "u-g", type: "gene", canonical_id: "HGNC:11444", name: "STXBP1", props: { symbol: "STXBP1" } },
      { id: "u-g2", type: "gene", canonical_id: "HGNC:1", name: "OTHER", props: { symbol: "OTHER" } },
      { id: "u-t", type: "trial", canonical_id: "NCT00000001", name: "STXBP1 natural history study", props: {} },
      { id: "u-p", type: "phenotype", canonical_id: "HP:0001250", name: "Seizure", props: {} },
      { id: "u-orphan", type: "disease", canonical_id: "ORPHA:1", name: "Leftover", props: {} },
    ],
    aliases: [{ entity_id: "u-g", alias: "MUNC18-1", lang: "en" }],
    edges: [
      { id: "e1", from_id: "u-g", to_id: "u-d", relation: "causes", confidence: "0.90", confidence_basis: "orphanet", props: {} },
      { id: "e1b", from_id: "u-g2", to_id: "u-d", relation: "causes", confidence: 0.9, confidence_basis: "monarch", props: {} },
      { id: "e2", from_id: "u-t", to_id: "u-d", relation: "studies", confidence: 0.6, confidence_basis: "ctgov", props: {}, kind: "observed" },
      { id: "e3", from_id: "u-d", to_id: "u-p", relation: "has_phenotype", confidence: 0.9, confidence_basis: "hpo", props: {} },
      { id: "e4", from_id: "u-g2", to_id: "u-orphan", relation: "causes", confidence: 0.9, confidence_basis: "x", props: {} }, // no evidence
    ],
    evidence: [
      { id: "v1", edge_id: "e1", source_id: "orphanet", external_id: "ORPHA:599373", url: "https://www.orpha.net/en/disease/detail/599373", quote: null, published_on: null, retrieved_at: T },
      { id: "v1b", edge_id: "e1b", source_id: "monarch", external_id: "MONDO:x", url: "https://monarchinitiative.org/x", quote: null, published_on: null, retrieved_at: T },
      { id: "v3", edge_id: "e3", source_id: "orphanet", external_id: "ORPHA:599373/HP:0001250", url: "https://www.orpha.net/en/disease/detail/599373", quote: null, published_on: null, retrieved_at: T },
      { id: "v2", edge_id: "e2", source_id: "ctgov", external_id: "NCT00000001", url: "https://clinicaltrials.gov/study/NCT00000001", quote: null, published_on: null, retrieved_at: T },
    ],
    sources: [{ id: "orphanet", name: "Orphanet", license: "CC BY 4.0", base_url: "https://api.orphadata.com", last_synced_at: T }],
    proposals: [{ id: "p1", kind: "collaboration", title: "Shared registry", body: "Ask KCNQ2 group", persona: "maria", disease: "disease:ORPHA:599373", entities: [], edges: ["edge:e1"], status: "draft", created_at: T }],
    extractions: [
      { id: "x-old", pmid: "123", model: "gpt-old", created_at: "2026-10-02T00:00:00Z", payload: { claims: [{ relation: "causes", entity_ids: ["gene:HGNC:11444", "disease:ORPHA:599373"], quote: "old" }] } },
      { id: "x1", pmid: "123", model: "gpt-x", created_at: T, payload: { claims: [
        { subject: "STXBP1", relation: "has_phenotype", object: "Seizure", polarity: "supports", quote: "Seizures in 90%", confidence: 0.7, entity_ids: ["disease:ORPHA:599373", "phenotype:HP:0001250"] },
        { relation: "made_up", entity_ids: ["disease:ORPHA:599373", "phenotype:HP:0001250"] },   // unknown relation
        { relation: "causes", entity_ids: ["gene:HGNC:999", "disease:ORPHA:599373"] },            // unknown entity
        { relation: "similar_to", entity_ids: ["disease:ORPHA:599373", "disease:ORPHA:1"] },      // reserved for analysis
        { relation: "causes", entity_ids: ["gene:HGNC:11444"] },                                  // missing object
      ] } },
    ],
    ...over,
  };
}

describe("rowsToSnapshot()", () => {
  it("maps ids, aliases and evidence, and drops edges without evidence", () => {
    const { snapshot, dropped } = rowsToSnapshot(rows());
    const ids = snapshot.edges.map((e) => e.id);
    expect(ids).toContain("edge:e1");
    expect(ids).not.toContain("edge:e4");
    expect(dropped).toBe(1);
    const e1 = snapshot.edges.find((e) => e.id === "edge:e1")!;
    expect(e1).toMatchObject({ from: "gene:HGNC:11444", to: "disease:ORPHA:599373", kind: "observed", confidence: 0.9 });
    expect(e1.evidence[0].id).toBe("ev:v1");
    expect(snapshot.entities.find((e) => e.id === "gene:HGNC:11444")!.aliases).toEqual([{ alias: "MUNC18-1", lang: "en" }]);
    // entities without any evidenced edge (retracted leftovers) stay out
    expect(snapshot.entities.some((e) => e.id === "disease:ORPHA:1")).toBe(false);
  });

  it("turns only valid claims of the latest extraction per PMID into extracted edges with a PubMed evidence row", () => {
    const { snapshot, extracted } = rowsToSnapshot(rows());
    expect(extracted).toBe(1);
    const x = snapshot.edges.filter((e) => e.kind === "extracted");
    expect(x).toHaveLength(1);
    expect(x[0]).toMatchObject({ id: "edge:x-x1-0", from: "disease:ORPHA:599373", to: "phenotype:HP:0001250", relation: "has_phenotype", confidence: 0.7 });
    expect(x[0].props).toMatchObject({ needs_review: true, polarity: "supports", model: "gpt-x" });
    expect(x[0].evidence[0]).toMatchObject({ source: "pubmed", external_id: "PMID:123", url: "https://pubmed.ncbi.nlm.nih.gov/123/", quote: "Seizures in 90%" });
  });

  it("keeps proposals as an overlay, never as edges or evidence", () => {
    const { snapshot } = rowsToSnapshot(rows());
    expect(snapshot.proposals).toHaveLength(1);
    expect(snapshot.proposals![0]).not.toHaveProperty("contact");
    expect(snapshot.edges.some((e) => e.kind === "proposed")).toBe(false);
  });

  it("normalizes primary causal gene (seed gene) and trial asset kind", () => {
    const { snapshot } = rowsToSnapshot(rows());
    expect(snapshot.edges.find((e) => e.id === "edge:e1")!.props.primary).toBe(true);
    expect(snapshot.edges.find((e) => e.id === "edge:e1b")!.props.primary).toBe(false);
    expect(snapshot.entities.find((e) => e.id === "trial:NCT00000001")!.props.asset_kind).toBe("natural_history");
    expect(snapshot.edges.find((e) => e.id === "edge:e2")!.props.asset_kind).toBe("natural_history");
  });

  it("overlays live extractions on the bundled file, mapping gene:HGNC ids to the file's gene:SYMBOL entities", () => {
    const file: AtlasSnapshot = {
      version: 1, generated_at: T, sources: {}, analytics: null,
      entities: [
        { id: "gene:SYMBOL:STXBP1", type: "gene", canonical_id: "SYMBOL:STXBP1", name: "STXBP1", props: { hgnc_id: "HGNC:11444" }, aliases: [] },
        { id: "disease:ORPHA:599373", type: "disease", canonical_id: "ORPHA:599373", name: "STXBP1-DEE", props: {}, aliases: [] },
      ],
      edges: [],
    };
    const { snapshot, extracted } = applyOverlays(file, {
      proposals: [],
      extractions: [{ id: "x9", pmid: "1", model: "gpt-4o-mini", created_at: T, payload: { claims: [
        { relation: "causes", entity_ids: ["gene:HGNC:11444", "disease:ORPHA:599373"], quote: "q", confidence: 0.8 },
        { relation: "causes", entity_ids: ["gene:HGNC:999", "disease:ORPHA:599373"] }, // gene not in this snapshot
      ] } }],
    });
    expect(extracted).toBe(1);
    expect(snapshot.edges[0]).toMatchObject({ from: "gene:SYMBOL:STXBP1", to: "disease:ORPHA:599373", kind: "extracted" });
    expect(snapshot.sources.openai_extraction).toBeDefined();
    // idempotent: applying again replaces, never duplicates
    expect(applyOverlays(snapshot, { proposals: [], extractions: [] }).snapshot.edges).toHaveLength(0);
  });

  it("works on the pre-0011 schema (no proposals / extractions tables)", () => {
    const { snapshot, extracted } = rowsToSnapshot(rows({ proposals: null, extractions: null }));
    expect(snapshot.proposals).toEqual([]);
    expect(extracted).toBe(0);
  });
});
