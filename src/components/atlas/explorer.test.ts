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

describe("focus view keeps mechanisms", () => {
  it("adds the mechanism node of every kept disease", () => {
    const n = (id: string, type: "disease" | "gene" = "disease") => ({ id, type, name: id, cluster: null, color: null, size: 8 });
    const l = (id: string, source: string, target: string, relation: string) => ({ id, source, target, relation, kind: "inferred" as const, confidence: 0.5 });
    const v = { focus: "A", clusters: [], nodes: [n("A"), n("B"), n("Z"), n("mechanism:lof", "gene"), n("mechanism:gof", "gene")],
      links: [l("s", "A", "B", "similar_to"), l("m1", "A", "mechanism:lof", "has_mechanism"), l("m2", "B", "mechanism:gof", "has_mechanism"), l("m3", "Z", "mechanism:lof", "has_mechanism")] };
    const out = focusView(v, "A", new Set());
    expect(out.nodes.map((x) => x.id).sort()).toEqual(["A", "B", "mechanism:gof", "mechanism:lof"]);
  });
});

import { constellationLayout, routeLayout, RING, YSCALE } from "./radial";

describe("route radial layout", () => {
  const N = (id: string, type: string, extra: Record<string, unknown> = {}) => ({ id, type, name: id, cluster: null, color: null, size: 8, ...extra }) as never;
  const L = (id: string, source: string, target: string, relation: string) => ({ id, source, target, relation, kind: "observed" as const, confidence: 0.5 });
  const phen = Array.from({ length: 12 }, (_, i) => N(`p${i}`, "phenotype", { props: { ic: i / 12 } }));
  const view = {
    focus: "F", clusters: [],
    nodes: [N("F", "disease", { cluster: "c1" }), N("g", "gene"), N("m", "mechanism"), N("A", "disease", { cluster: "c2" }), N("B", "disease", { cluster: "c1" }), N("Z", "disease"), ...phen, N("t", "trial", { props: { asset_kind: "registry" } })],
    links: [L("1", "g", "F", "causes"), L("2", "F", "m", "has_mechanism"), L("3", "F", "A", "similar_to"), L("4", "B", "F", "similar_to"), L("5", "t", "F", "studies"),
      ...phen.map((p, i) => L(`ph${i}`, "F", (p as { id: string }).id, "has_phenotype"))],
  };
  const opts = { strength: { A: "strong" as const, B: "weak" as const }, expanded: new Set<never>(), layers: new Set(["mechanism", "symptoms", "studies", "people", "treatments"] as const),
    strengthLabel: { strong: "Strong lead", possible: "Possible lead", weak: "Weak lead" }, sectorLabel: { symptoms: "Symptoms", studies: "Studies & assets", people: "People", treatments: "Treatments" },
    moreLabel: (n: number) => `+${n} more`, fewerLabel: "show fewer", noneLabel: "none in our sources" };
  type P = { id: string; ring?: number; fx: number; fy: number; name: string; header?: string };
  const out = routeLayout(view as never, "F", opts as never);
  const nodes = out.view.nodes as unknown as P[];
  const at = (id: string) => nodes.find((n) => n.id === id)!;
  const r = (n: P) => Math.round(Math.hypot(n.fx, n.fy / YSCALE));
  it("puts the focus at the center and rings ≥ 140 apart", () => {
    expect(r(at("F"))).toBe(0);
    expect(r(at("g"))).toBe(RING[1]); expect(r(at("m"))).toBe(RING[1]);
    expect(r(at("A"))).toBe(RING[2]);
    expect(RING[2] - RING[1]).toBeGreaterThanOrEqual(140); expect(RING[3] - RING[2]).toBeGreaterThanOrEqual(140);
  });
  it("orders neighbours same-cluster first and labels their strength; hides unrelated diseases", () => {
    expect(at("B").name).toBe("B · Weak lead"); expect(at("A").name).toBe("A · Strong lead");
    expect(nodes.find((n) => n.id === "Z")).toBeUndefined();
  });
  it("shows the top 8 symptoms by information content with a +N more header", () => {
    const shown = nodes.filter((n) => n.id.startsWith("p"));
    expect(shown).toHaveLength(8); expect(shown.map((n) => n.id)).toContain("p11"); expect(shown.map((n) => n.id)).not.toContain("p0");
    expect(at("sector:symptoms").name).toBe("Symptoms · +4 more");
    expect(at("sector:treatments").name).toBe("Treatments · none in our sources");
  });
  it("expands a sector and respects layers", () => {
    const o2 = routeLayout(view as never, "F", { ...opts, expanded: new Set(["symptoms"]), layers: new Set(["symptoms"]) } as never);
    const n2 = o2.view.nodes as unknown as P[];
    expect(n2.filter((n) => n.id.startsWith("p"))).toHaveLength(12);
    expect(n2.find((n) => n.id === "m")).toBeUndefined();
    expect(n2.find((n) => n.id === "sector:studies")).toBeUndefined();
  });
  it("constellation places every disease in its cluster region with a labelled header", () => {
    const v = { focus: "", nodes: [N("a", "disease"), N("b", "disease"), N("c", "disease")], links: [], clusters: [{ id: "k1", label: "Lysosomal", color: "#000", diseases: ["a", "b"] }, { id: "k2", label: "Channels", color: "#111", diseases: ["c"] }] };
    const o = constellationLayout(v as never); const ns = o.view.nodes as unknown as P[];
    expect(ns.filter((n) => n.header === "region").map((n) => n.name).sort()).toEqual(["Channels", "Lysosomal"]);
    expect(ns.filter((n) => !n.header)).toHaveLength(3);
  });
});
