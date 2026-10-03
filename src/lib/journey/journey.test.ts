import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AtlasSnapshot, Edge, Entity } from "../atlas/types";
import { indexSnapshot } from "./graph";
import { buildJourney, ORDER, type JourneyV2 } from "./build";
import { noRouteForQuery } from "./noroute";

const snap = JSON.parse(readFileSync(join(process.cwd(), "data", "atlas.json"), "utf8")) as AtlasSnapshot;
const g = indexSnapshot(snap);
const STXBP1 = "disease:ORPHA:599373";
const KCNQ2 = "disease:ORPHA:439218";

/** Every cited edge must exist in the graph; every cited evidence id must belong to a cited edge. */
function allCites(j: JourneyV2) {
  return [
    ...j.connections.neighbors.map((x) => x.cite), ...j.connections.counterexamples.map((x) => x.cite),
    ...j.assets.own.map((x) => x.cite), ...j.assets.reusable.map((x) => x.cite), ...j.assets.treatments.map((x) => x.cite),
    ...j.people.collaborators.map((x) => x.cite), ...j.next.steps.map((x) => x.cite), ...j.next.later.map((x) => x.cite),
  ];
}

describe("journey v2 · Maria's STXBP1 case", () => {
  const j = buildJourney(g, STXBP1, "maria", "en")!;

  it("answers the four questions from the graph", () => {
    expect(j.connections.neighbors.length).toBeGreaterThan(0);
    expect(j.connections.neighbors[0].disease).toBe(KCNQ2);          // strongest inferred neighbor first
    expect(j.connections.neighbors[0].cite.kinds).toContain("inferred");
    expect(j.assets.own.length + j.assets.reusable.length).toBeGreaterThan(0);
    expect(j.people.collaborators.length).toBeGreaterThan(0);
    expect(j.next.steps.length).toBeGreaterThanOrEqual(2);
    expect(j.next.steps.length).toBeLessThanOrEqual(4);
    expect(j.no_route).toBeNull();
  });

  it("never returns a step without evidence edges, and each step has an owner type", () => {
    for (const s of [...j.next.steps, ...j.next.later]) {
      expect(s.cite.edges.length).toBeGreaterThan(0);
      expect(s.cite.evidence.length).toBeGreaterThan(0);
      expect(["patient_group", "researcher", "clinician", "funder"]).toContain(s.owner);
    }
  });

  it("cites only edges and evidence that exist in the graph", () => {
    for (const c of allCites(j)) {
      for (const id of c.edges) expect(g.edgeById.has(id)).toBe(true);
      const ev = new Set(c.edges.flatMap((id) => g.edgeById.get(id)!.evidence.map((x) => x.id)));
      for (const id of c.evidence) expect(ev.has(id)).toBe(true);
    }
  });

  it("shows a counterexample: similar symptoms, different mechanism", () => {
    expect(j.connections.counterexamples.some((c) => c.disease === "disease:ORPHA:505652")).toBe(true);
    expect(j.connections.counterexamples[0].why).toMatch(/different strategy/);
  });

  it("marks what differs and what needs expert review on reusable assets", () => {
    for (const a of j.assets.reusable) {
      expect(a.own).toBe(false);
      expect(a.what_differs.length).toBeGreaterThan(0);
      expect(a.needs_review.join(" ")).toMatch(/Eligibility/);
    }
    // A study that already enrolls STXBP1 and a neighbor ranks first among our own assets.
    expect(j.assets.own[0].shared_with.length).toBeGreaterThan(0);
  });

  it("ranks collaborators that bridge both communities above those that do not (same kind)", () => {
    const inv = j.people.collaborators.filter((c) => c.kind === "investigator");
    const firstNonBridge = inv.findIndex((c) => !c.bridges);
    const lastBridge = inv.map((c) => c.bridges).lastIndexOf(true);
    if (firstNonBridge !== -1) expect(lastBridge).toBeLessThan(firstNonBridge);
    expect(j.people.collaborators.some((c) => c.kind === "patient_org" && c.diseases.some((d) => d.id === KCNQ2))).toBe(true);
  });

  it("keeps 'not medical advice' on the payload", () => {
    expect(j.disclaimer).toMatch(/Not medical advice/);
  });
});

describe("journey v2 · persona order", () => {
  it("Patient mode puts community first; Researcher puts mechanism then colleagues", () => {
    const devon = buildJourney(g, STXBP1, "devon", "en")!;
    expect(devon.order[0]).toBe("people");
    expect(devon.next.steps[0].kind).toBe("community");
    expect(ORDER.osei.slice(0, 2)).toEqual(["connections", "people"]);
    const osei = buildJourney(g, STXBP1, "osei", "en")!;
    expect(osei.next.steps[0].kind).toBe("validate");
  });
  it("works for every disease in the atlas with valid citations", () => {
    for (const d of snap.entities.filter((e) => e.type === "disease")) {
      const j = buildJourney(g, d.id, "priya", "es")!;
      expect(j).not.toBeNull();
      for (const s of j.next.steps) expect(s.cite.edges.length).toBeGreaterThan(0);
    }
  });
});

/* ------------------------- honest no-route case ------------------------- */
const ev = (id: string) => [{ id: `ev:${id}`, source: "orphanet" as const, external_id: id, url: `https://example.org/${id}`, quote: null, published_on: null, retrieved_at: "2026-10-03" }];
const ent = (id: string, type: Entity["type"], name: string, props: Record<string, unknown> = {}): Entity => ({ id, type, canonical_id: id.split(":").slice(1).join(":"), name, props, aliases: [] });
const edge = (id: string, from: string, to: string, relation: Edge["relation"], props: Record<string, unknown> = {}): Edge => ({ id, from, to, relation, kind: "observed", confidence: 0.9, confidence_basis: "test", props, evidence: ev(id) });

function isolatedSnapshot(): AtlasSnapshot {
  return {
    version: 1, generated_at: "2026-10-03",
    sources: { orphanet: { id: "orphanet", name: "Orphanet", license: "CC-BY-4.0", url: "https://orpha.net", last_synced_at: null } },
    entities: [ent("disease:ORPHA:1", "disease", "Lonely disease"), ent("disease:ORPHA:2", "disease", "Other disease"), ent("phenotype:HP:1", "phenotype", "Seizure")],
    edges: [edge("edge:p1", "disease:ORPHA:1", "phenotype:HP:1", "has_phenotype")],
    analytics: null,
  };
}

describe("journey v2 · honest no-route", () => {
  const gi = indexSnapshot(isolatedSnapshot());
  const j = buildJourney(gi, "disease:ORPHA:1", "maria", "en")!;

  it("says there is no supported connection, with coverage and missing evidence", () => {
    expect(j.connections.neighbors).toHaveLength(0);
    expect(j.no_route).not.toBeNull();
    expect(j.no_route!.title).toMatch(/No supported connection/);
    expect(j.no_route!.missing_evidence.length).toBeGreaterThan(0);
    expect(j.no_route!.next_question.length).toBeGreaterThan(10);
    expect(j.coverage.counts.atlas_diseases).toBe(2);
    expect(j.coverage.sources.map((s) => s.id)).toContain("orphanet");
  });

  it("invents no steps, assets or collaborators", () => {
    expect(j.next.steps).toHaveLength(0);
    expect(j.next.none).not.toBeNull();
    expect(j.assets.none).not.toBeNull();
    expect(j.people.none).not.toBeNull();
    expect(j.summary.connections.cite.edges).toHaveLength(0);
  });

  it("answers free text outside the atlas honestly", () => {
    const n = noRouteForQuery(g, "Alexander disease", "en");
    expect(n.kind).toBe("no_route");
    expect(n.no_route.detail).toContain(`${n.coverage.counts.atlas_diseases} diseases`);
    expect(n.atlas_diseases.length).toBe(n.coverage.counts.atlas_diseases);
  });

  it("returns null for ids that are not diseases", () => {
    expect(buildJourney(gi, "phenotype:HP:1")).toBeNull();
    expect(buildJourney(gi, "disease:ORPHA:999")).toBeNull();
  });
});
