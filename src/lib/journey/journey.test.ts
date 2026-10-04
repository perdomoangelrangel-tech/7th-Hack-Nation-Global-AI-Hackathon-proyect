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
// Expectations are derived from the snapshot, so the tests survive the data lane growing the slice.
const simEdges = snap.edges.filter((e) => e.relation === "similar_to" && (e.from === STXBP1 || e.to === STXBP1)).sort((a, b) => b.confidence - a.confidence);
const LEAD = simEdges[0].from === STXBP1 ? simEdges[0].to : simEdges[0].from;
const COUNTER = (snap.analytics?.counterexamples ?? []).find((c) => c.a === STXBP1 || c.b === STXBP1);

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
    expect(j.connections.neighbors[0].disease).toBe(LEAD);           // strongest inferred neighbor first
    expect(j.connections.neighbors.some((n) => n.disease === KCNQ2)).toBe(true);
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
    expect(COUNTER).toBeDefined();
    expect(j.connections.counterexamples.some((c) => c.disease === (COUNTER!.a === STXBP1 ? COUNTER!.b : COUNTER!.a))).toBe(true);
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
    // QA-05: Devon on Dravet sees Dravet's own patient groups first.
    const dravet = buildJourney(g, "disease:ORPHA:33069", "devon", "en")!;
    expect(dravet.people.collaborators[0].kind).toBe("patient_org");
    expect(dravet.summary.people.text).toMatch(/Dravet Syndrome/);
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
  }, 30_000); // whole-atlas sweep: generous timeout so CI load does not flake it
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

describe("co-creation prefill", async () => {
  const { prefillDraft } = await import("./prefill");
  const { ProposalInput } = await import("./proposals");
  const j = buildJourney(g, STXBP1, "maria", "en")!;
  it("prefills each kind from the journey, citing only real edges, and says it is a draft", () => {
    for (const k of ["hypothesis", "collaboration", "evidence"] as const) {
      const d = prefillDraft(k, j);
      expect(d.body).toMatch(/draft/i);
      for (const e of d.edges) expect(g.edgeById.has(e)).toBe(true);
      expect(ProposalInput.safeParse({ ...d, disease: STXBP1, persona: "maria" }).success).toBe(true);
    }
    const collab = prefillDraft("collaboration", j);
    expect(collab.title).toContain("STXBP1 Foundation");
    expect(collab.entities).toContain(LEAD);
  });
  it("rejects unknown kinds", () => {
    expect(ProposalInput.safeParse({ kind: "cure", title: "abc", body: "x" }).success).toBe(false);
  });
});

describe("matchmaking + intro draft", async () => {
  const { matchPartners } = await import("./match");
  const { draftIntro } = await import("./outreach");
  const r = matchPartners(g, STXBP1, "maria", "en")!;
  it("ranks partners with evidence-backed reasons and excludes our own patient group", () => {
    expect(r.partners.length).toBeGreaterThan(0);
    for (let i = 1; i < r.partners.length; i++) expect(r.partners[i - 1].score).toBeGreaterThanOrEqual(r.partners[i].score);
    for (const p of r.partners) {
      expect(p.reasons.length).toBeGreaterThan(0);
      for (const e of p.cite.edges) expect(g.edgeById.has(e)).toBe(true);
    }
    expect(r.partners.some((p) => p.name === "STXBP1 Foundation")).toBe(false);
    expect(r.partners.some((p) => p.name === "KCNQ2 Cure Alliance")).toBe(true);
  });
  it("drafts an intro whose every [n] reference resolves to a listed source", () => {
    const j = buildJourney(g, STXBP1, "maria", "en")!;
    const d = draftIntro(j, r.partners[0]);
    const refs = [...d.body.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
    expect(refs.length).toBeGreaterThan(0);
    for (const n of refs) expect(d.sources.some((s) => s.n === n)).toBe(true);
    expect(d.body).toMatch(/not medical advice/);
  });
  it("returns null for unknown diseases", () => expect(matchPartners(g, "disease:NOPE")).toBeNull());
});

describe("10× view", async () => {
  const { tenX } = await import("./tenx");
  const t = tenX(buildJourney(g, STXBP1, "maria", "en")!);
  it("labels every duration as an assumption with a rationale and cites the Nedamex phases it can", () => {
    for (const p of t.phases) { expect(p.typical.rationale).toMatch(/Assumption|assumption/); expect(p.nexmed.rationale.length).toBeGreaterThan(10); }
    expect(t.phases.filter((p) => p.discovery).every((p) => p.nexmed.cite && p.nexmed.cite.edges.length > 0)).toBe(true);
    expect(t.assumption_note).toMatch(/assumptions/);
  });
  it("only claims the gain on discovery; protocol never gets faster than the typical minimum without a shared study", () => {
    expect(t.discovery.ratio[0]).toBeGreaterThanOrEqual(5);
    expect(t.total.nexmed[1]).toBeLessThanOrEqual(t.total.typical[1]);
    expect(t.validate_next.length).toBeGreaterThanOrEqual(2);
  });
});

describe("wave 4 · lead strength (UX_WAVE4 §3)", async () => {
  const { leadStrength, INFORMATIVE_IC } = await import("./build");
  const sym = (n: number, ic = INFORMATIVE_IC) => Array.from({ length: n }, () => ({ ic }));
  it("Strong = shared gene or pathway + ≥3 informative symptoms", () => {
    expect(leadStrength({ pathways: [1], genes: [] }, sym(3)).level).toBe("strong");
    expect(leadStrength({ pathways: [], genes: ["X"] }, sym(3)).level).toBe("strong");
  });
  it("Possible = ≥5 informative symptoms without shared mechanism", () => {
    expect(leadStrength({ pathways: [], genes: [] }, sym(5)).level).toBe("possible");
    expect(leadStrength({ pathways: [1], genes: [] }, sym(2)).level).toBe("weak");
  });
  it("Weak otherwise; uninformative symptoms do not count", () => {
    expect(leadStrength({ pathways: [], genes: [] }, sym(9, INFORMATIVE_IC - 0.01)).level).toBe("weak");
    expect(leadStrength({ pathways: [], genes: [] }, sym(4)).label).toBe("Weak lead");
  });
  it("never shows a raw score in the route summary", () => {
    const j = buildJourney(g, STXBP1, "maria", "en")!;
    expect(j.summary.connections.text).not.toMatch(/score|0\.\d/);
    expect(j.summary.connections.text).toMatch(/(Strong|Possible|Weak) lead/);
  });
});

describe("wave 4 · mode variants", async () => {
  const { clusterTable, clusterCsv } = await import("./clusters");
  const j = buildJourney(g, STXBP1, "devon", "en")!;
  it("Patient plain view: sourced sentence, no variant percentages, real groups and recruiting studies", () => {
    expect(j.plain.what_is_it.text).toMatch(/STXBP1 gene/);
    expect(j.plain.what_is_it.text).not.toMatch(/%|truncating|missense/);
    for (const e of j.plain.what_is_it.cite.edges) expect(g.edgeById.has(e)).toBe(true);
    expect(j.plain.what_is_it.signs.every((s) => !/^abnormal/i.test(s))).toBe(true);
    expect(j.plain.people_like_you.groups.map((x) => x.name)).toContain("STXBP1 Foundation");
    expect(j.plain.research_now.studies.every((s) => ["RECRUITING", "NOT_YET_RECRUITING", "ENROLLING_BY_INVITATION"].includes(s.status))).toBe(true);
    expect(j.plain.this_week.length).toBeLessThanOrEqual(3);
  });
  it("Researcher mechanism view: causal gene with its edge and Reactome pathways", () => {
    expect(j.mechanism.gene?.symbol).toBe("STXBP1");
    expect(g.edgeById.get(j.mechanism.gene!.edge)?.relation).toBe("causes");
    expect(j.mechanism.pathways.length).toBeGreaterThan(0);
    for (const p of j.mechanism.pathways) expect(g.edgeById.get(p.edge)?.relation).toBe("participates_in");
  });
  it("Pharma cluster table is ranked by unmet need and cites what it counts", () => {
    const t = clusterTable(g, "en");
    expect(t.rows.length).toBe(snap.analytics!.clusters.length);
    for (let i = 1; i < t.rows.length; i++) expect(t.rows[i - 1].unmet_share).toBeGreaterThanOrEqual(t.rows[i].unmet_share);
    for (const r of t.rows) for (const e of r.cite.edges) expect(g.edgeById.has(e)).toBe(true);
    const csv = clusterCsv(t).split("\n");
    expect(csv).toHaveLength(t.rows.length + 1);
    expect(csv[0]).toContain("Approved treatment?");
  });
});

describe("wave 5B · community requests + analysis label", async () => {
  const { prefillRequest, requestType } = await import("./prefill");
  const { ProposalInput } = await import("./proposals");
  const { isAnalysisSource } = await import("./graph");
  it("detects request titles from the search footer", () => {
    expect(requestType("Disease request: Alexander disease")).toBe("disease");
    expect(requestType("Source suggestion: Orphanet")).toBe("source");
    expect(requestType("Missing evidence for STXBP1-DEE")).toBeNull();
  });
  it("prefills a request that cites nothing and says it is not evidence", () => {
    for (const t of ["Disease request: Alexander disease", "Source suggestion: a registry list"]) {
      const d = prefillRequest(t, "en", null);
      expect(d.kind).toBe("evidence");
      expect(d.edges).toHaveLength(0);
      expect(d.body).toMatch(/not evidence/);
      expect(ProposalInput.safeParse({ ...d, disease: null, persona: "maria" }).success).toBe(true);
    }
    expect(prefillRequest("Disease request: Alexander disease").body).toContain("Alexander disease");
  });
  it("labels Nedamex's analysis under both the new and the legacy source id", () => {
    expect(isAnalysisSource("nexmed_analysis")).toBe(true);
    expect(isAnalysisSource("atlas_analysis")).toBe(true);
    expect(isAnalysisSource("orphanet")).toBe(false);
    const j = buildJourney(g, STXBP1, "maria", "en")!;
    expect(j.coverage.sources.map((s) => s.name).join(" ")).not.toMatch(/nexmed|Nexmed/);
  });
});

describe("wave 6 · medicines bank", async () => {
  const { medicinesFromGraph, medicineBankUrl, filterMedicines } = await import("./medicines");
  const APP = "https://nedamex.lovable.app";
  it("builds the bank from treats edges with linked sources for every indication", () => {
    const r = medicinesFromGraph(g, APP, { limit: 500 });
    expect(r.total).toBeGreaterThan(0);
    for (const m of r.medicines) {
      expect(m.indications.length).toBeGreaterThan(0);
      for (const i of m.indications) { expect(g.byId.get(i.disease_id)?.type).toBe("disease"); for (const s of i.sources) expect(s.url).toMatch(/^https?:\/\//); }
    }
    expect(r.disclaimer).toMatch(/Not medical advice/);
  });
  it("filters by disease, approval and text; approved first", () => {
    const all = medicinesFromGraph(g, APP, { limit: 500 }).medicines;
    const dravet = filterMedicines(all, { d: "disease:ORPHA:33069", approved: true }, "graph").medicines;
    for (const m of dravet) { expect(m.approved_for_listed_disease).toBe(true); expect(m.indications.some((i) => i.disease_id === "disease:ORPHA:33069")).toBe(true); }
    const q = filterMedicines(all, { q: "FENFLUR" }, "graph").medicines;
    expect(q.every((m) => /fenflur/i.test(m.name))).toBe(true);
  });
  it("only links ChEMBL compounds to the bank", () => {
    expect(medicineBankUrl(APP + "/", "treatment:CHEMBL1009")).toBe(`${APP}/medicines/CHEMBL1009`);
    expect(medicineBankUrl(APP, "treatment:NOT_A_CHEMBL")).toBeNull();
    expect(medicineBankUrl(APP, null)).toBeNull();
  });
});

describe("wave 6 · community", async () => {
  const { communityFromGraph, ProfileInput, rankProfiles, BADGE } = await import("./community");
  it("lists only researchers with a public NIH RePORTER record, each project linked", () => {
    const ps = communityFromGraph(g, { d: STXBP1 });
    expect(ps.length).toBeGreaterThan(0);
    for (const p of ps) { expect(p.badge).toBe(BADGE.nih_record); expect(p.projects.every((x) => /reporter\.nih\.gov/.test(x.url ?? ""))).toBe(true); }
  });
  it("requires consent and validates ORCID and https links", () => {
    const base = { display_name: "Dr Test", role: "researcher", diseases: [STXBP1] };
    expect(ProfileInput.safeParse({ ...base, consent: false }).success).toBe(false);
    expect(ProfileInput.safeParse({ ...base, consent: true }).success).toBe(true);
    expect(ProfileInput.safeParse({ ...base, consent: true, orcid: "0000-0002-1825-0097" }).success).toBe(true);
    expect(ProfileInput.safeParse({ ...base, consent: true, orcid: "1234" }).success).toBe(false);
    expect(ProfileInput.safeParse({ ...base, consent: true, link: "http://x.org" }).success).toBe(false);
  });
  it("ranks public records before self-submitted, unverified profiles", () => {
    const nih = communityFromGraph(g, { d: STXBP1 }).slice(0, 2);
    const self = { ...nih[0], id: "profile:x", kind: "self_submitted" as const, badge: BADGE.self_submitted, verified: false, diseases: [...nih[0].diseases, ...nih[0].diseases] };
    const r = rankProfiles([self, ...nih]);
    expect(r[r.length - 1].kind).toBe("self_submitted");
  });
});
