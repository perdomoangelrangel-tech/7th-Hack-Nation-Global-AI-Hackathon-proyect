import { describe, expect, it } from "vitest";
import { externalUrl } from "./links";
import { parseDrafts, withDrafts } from "./proposals";
import { KIND_STYLE, kindOf } from "./colors";
import type { GraphView } from "@/lib/atlas/store";

describe("externalUrl", () => {
  it("links known identifiers to their registries", () => {
    expect(externalUrl("PMID:31234567")).toBe("https://pubmed.ncbi.nlm.nih.gov/31234567/");
    expect(externalUrl("NCT01234567")).toBe("https://clinicaltrials.gov/study/NCT01234567");
    expect(externalUrl("ORPHA:599373")).toBe("https://www.orpha.net/en/disease/detail/599373");
    expect(externalUrl("HP:0001250")).toBe("https://hpo.jax.org/browse/term/HP:0001250");
    expect(externalUrl("10.1038/s41586-020-2308-7")).toBe("https://doi.org/10.1038/s41586-020-2308-7");
    expect(externalUrl("R-HSA-112310")).toBe("https://reactome.org/content/detail/R-HSA-112310");
  });
  it("prefers the stored source URL and never invents one for unknown ids", () => {
    expect(externalUrl("PMID:1", "https://example.org/x")).toBe("https://example.org/x");
    expect(externalUrl("similarity_v1")).toBeNull();
  });
});

describe("edge kinds", () => {
  it("maps unknown kinds to observed and gives every kind a distinct line style", () => {
    expect(kindOf(undefined)).toBe("observed");
    expect(kindOf("extracted")).toBe("extracted");
    const dashes = Object.values(KIND_STYLE).map((s) => JSON.stringify(s.dash));
    expect(new Set(dashes).size).toBe(4);
    expect(KIND_STYLE.observed.dash).toBeNull();
  });
});

describe("proposals layer", () => {
  const view: GraphView = { focus: "disease:A", nodes: [{ id: "disease:A", type: "disease", name: "A", cluster: null, color: null, size: 8 }, { id: "gene:X", type: "gene", name: "X", cluster: null, color: null, size: 4 }], links: [], clusters: [] };
  it("parses arrays or {proposals} and skips malformed rows", () => {
    expect(parseDrafts({ proposals: [{ id: "1", title: "t", entities: ["gene:X", 3] }, { title: "no id" }] })).toEqual([{ id: "1", kind: "hypothesis", title: "t", body: undefined, persona: undefined, created_at: undefined, entities: ["gene:X"] }]);
    expect(parseDrafts(null)).toEqual([]);
  });
  it("adds ghost nodes linked with kind 'proposed', never evidence", () => {
    const v = withDrafts(view, parseDrafts([{ id: "p1", title: "Shared endpoint?", entities: ["gene:X", "gene:missing"] }, { id: "p2", title: "Talk", entities: [] }]));
    expect(v.nodes.filter((n) => n.draft)).toHaveLength(2);
    expect(v.links.every((l) => l.kind === "proposed")).toBe(true);
    expect(v.links.map((l) => l.target)).toEqual(["gene:X", "disease:A"]);
  });
});

import { focusView, labelSet } from "./focus";

describe("focus view (one route, not a map)", () => {
  const node = (id: string, type: "disease" | "gene" | "phenotype" = "disease") => ({ id, type, name: id, cluster: null, color: null, size: 8 });
  const link = (id: string, source: string, target: string, relation = "similar_to") => ({ id, source, target, relation, kind: "inferred" as const, confidence: 0.2 });
  const view = { focus: "A", clusters: [], nodes: [node("A"), node("B"), node("C"), node("D"), node("g", "gene"), node("p", "phenotype")],
    links: [link("e1", "A", "B"), link("e2", "B", "C"), link("e3", "C", "D"), link("e4", "g", "A", "causes"), link("e5", "p", "D", "has_phenotype")] };
  it("keeps the focus, its 1-hop neighbours and route-edge endpoints only", () => {
    const v = focusView(view, "A", new Set(["e3"]));
    expect(v.nodes.map((n) => n.id).sort()).toEqual(["A", "B", "C", "D", "g"]);
    expect(v.links.map((l) => l.id).sort()).toEqual(["e1", "e2", "e3", "e4"]);
  });
  it("labels the focus, neighbour diseases and route endpoints", () => {
    expect([...labelSet(view, "A", new Set(["e3"]))].sort()).toEqual(["A", "B", "C", "D"]);
  });
});

import { strengthOf, uncertainReasons } from "./evidence";

describe("evidence drawer labels", () => {
  const ph = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `HP:${i}`, name: `p${i}`, ic: 0.4 }));
  it("strength follows the UX_WAVE4 rule", () => {
    expect(strengthOf({ shared_phenotypes: ph(3), shared_pathways: [{ id: "R", name: "r" }], shared_genes: [] })).toBe("strong");
    expect(strengthOf({ shared_phenotypes: ph(8), shared_pathways: [], shared_genes: [] })).toBe("possible");
    expect(strengthOf({ shared_phenotypes: ph(4), shared_pathways: [], shared_genes: [] })).toBe("weak");
    expect(strengthOf({ shared_phenotypes: ph(2), shared_pathways: [], shared_genes: ["gene:X"] })).toBe("weak");
  });
  it("lists what could make an edge wrong", () => {
    expect(uncertainReasons({ kind: "inferred", confidence: 0.13, evidence: [1, 2] }, { shared_pathways: [], variant_effect_match: false })).toEqual(["u_inferred", "u_low", "u_variant", "u_no_pathway"]);
    expect(uncertainReasons({ kind: "observed", confidence: 0.9, evidence: [1] }, null)).toEqual(["u_single"]);
  });
});
