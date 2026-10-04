/** Tiny hand-made graph for AI-lane unit tests (not real data; ids are fake on purpose). */
import type { AtlasSnapshot, Edge, Entity, Evidence } from "../atlas/types";
import type { AtlasIndex } from "./types";
import type { LlmClient } from "./client";

const ev = (id: string, source: Evidence["source"] = "orphanet", external_id = id): Evidence =>
  ({ id: `ev:${id}`, source, external_id, url: `https://example.org/${id}`, quote: null, published_on: null, retrieved_at: "2026-10-03T00:00:00Z" });
const ent = (type: Entity["type"], cid: string, name: string, aliases: string[] = [], props: Record<string, unknown> = {}): Entity =>
  ({ id: `${type}:${cid}`, type, canonical_id: cid, name, props, aliases: aliases.map((alias) => ({ alias, lang: "en" })) });
const edge = (id: string, from: string, to: string, relation: Edge["relation"], kind: Edge["kind"] = "observed", props: Record<string, unknown> = {}, evidence = [ev(id)]): Edge =>
  ({ id: `edge:${id}`, from, to, relation, kind, confidence: kind === "inferred" ? 0.31 : 0.9, confidence_basis: "test", props, evidence });

export function fixtureSnapshot(): AtlasSnapshot {
  const entities: Entity[] = [
    ent("disease", "ORPHA:1", "Testing syndrome type A", ["TSA", "Alpha encephalopathy"], { short_name: "TS-A" }),
    ent("disease", "ORPHA:2", "Beta disease", ["BD"]),
    ent("disease", "ORPHA:3", "Gamma lipofuscinosis 1"),
    ent("disease", "ORPHA:4", "Gamma lipofuscinosis 2"),
    ent("gene", "HGNC:1", "GENE1", ["Munc-1"]),
    ent("gene", "HGNC:2", "GENE2"),
    ent("phenotype", "HP:0001250", "Seizure"),
    ent("pathway", "R-HSA-1", "Synaptic vesicle cycle"),
    ent("organization", "org-1", "GENE1 Cure Alliance"),
    ent("treatment", "CHEMBL1", "Drugamab"),
    ent("study", "PMID:111", "A paper about GENE1"),
  ];
  const edges: Edge[] = [
    edge("c1", "gene:HGNC:1", "disease:ORPHA:1", "causes", "observed", { primary: true }),
    edge("c2", "gene:HGNC:2", "disease:ORPHA:2", "causes", "observed", { primary: true }),
    edge("p1", "disease:ORPHA:1", "phenotype:HP:0001250", "has_phenotype", "observed", { frequency: "Very frequent (99-80%)" }),
    edge("w1", "gene:HGNC:1", "pathway:R-HSA-1", "participates_in", "observed", {}, [ev("w1", "reactome", "R-HSA-1")]),
    edge("s1", "disease:ORPHA:1", "disease:ORPHA:2", "similar_to", "inferred", {}, [ev("s1", "nexmed_analysis", "similarity_v1")]),
    edge("o1", "organization:org-1", "disease:ORPHA:1", "supports", "observed", {}, [ev("o1", "patient_orgs")]),
    edge("t1", "treatment:CHEMBL1", "disease:ORPHA:2", "treats", "observed", { approved: true, stage: "APPROVAL", phase: 4 }, [ev("t1", "opentargets")]),
    edge("x1", "gene:HGNC:1", "disease:ORPHA:2", "causes", "extracted", { needs_review: true }, [ev("x1", "pubmed", "PMID:111")]),
    edge("g1", "gene:HGNC:2", "disease:ORPHA:3", "causes", "observed"),
    edge("g2", "gene:HGNC:2", "disease:ORPHA:4", "causes", "observed"),
    { ...edge("d1", "disease:ORPHA:1", "disease:ORPHA:2", "similar_to", "proposed"), evidence: [] },
  ];
  return {
    version: 1, generated_at: "2026-10-03T00:00:00Z", sources: {}, entities, edges,
    analytics: {
      generated_at: "2026-10-03T00:00:00Z", method: "test", phenotype_ic_reference: { total_diseases: 4, source: "test" },
      clusters: [], disease_cluster: {}, centrality: {}, variant_effect: {}, bridges: [], gaps: [], counterexamples: [],
      similarity: { "edge:s1": { score: 0.31, phenotype_score: 0.3, pathway_score: 0.2, variant_effect_match: null, shared_phenotypes: [{ id: "phenotype:HP:0001250", name: "Seizure", ic: 2 }], shared_pathways: [{ id: "pathway:R-HSA-1", name: "Synaptic vesicle cycle" }], shared_genes: [], supporting_edges: ["edge:p1"] } },
    },
  };
}

export function fixtureIndex(snap = fixtureSnapshot()): AtlasIndex {
  const byId = new Map(snap.entities.map((e) => [e.id, e]));
  const edgeById = new Map(snap.edges.map((e) => [e.id, e]));
  const out = new Map<string, Edge[]>(); const inn = new Map<string, Edge[]>(); const evidenceById = new Map<string, Evidence>();
  for (const e of snap.edges) {
    out.set(e.from, [...(out.get(e.from) ?? []), e]);
    inn.set(e.to, [...(inn.get(e.to) ?? []), e]);
    for (const x of e.evidence) evidenceById.set(x.id, x);
  }
  return { snap, byId, edgeById, out, in: inn, evidenceById };
}

/** Fake model: returns the given JSON and records the prompts it was sent. */
export function fakeLlm(reply: unknown | ((req: { system: string; input: string; name: string }) => unknown)) {
  const calls: { system: string; input: string; name: string; model: string }[] = [];
  const client: LlmClient = {
    async completeJson(req) {
      calls.push({ system: req.system, input: req.input, name: req.name, model: req.model });
      return JSON.stringify(typeof reply === "function" ? (reply as (r: typeof req) => unknown)(req) : reply);
    },
  };
  return { client, calls };
}
