import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { communitiesFor, findDisease, neighborsFor, resolveName } from "./graph";

// Runs on the bundled data/atlas.json: assert properties, not snapshot-specific ids.
describe("agent tools (bundled graph)", () => {
  it("resolves names, synonyms and genes strictly", () => {
    expect(findDisease("ORPHA:33069")?.name).toBe("Dravet syndrome");
    expect(findDisease("SMEI")?.name).toBe("Dravet syndrome");
    expect(findDisease("STXBP1")?.id).toBe("disease:ORPHA:599373");
    expect(findDisease("Zorblax-Kettering syndrome")).toBeNull();
    expect(findDisease("")).toBeNull();
  });
  it("neighbors are inferred and cited", async () => {
    const r = await neighborsFor("STXBP1") as { data: { neighbors: { kind: string; evidence_ids: string[] }[] }; evidence: unknown[] };
    expect(r.data.neighbors.length).toBeGreaterThan(0);
    for (const n of r.data.neighbors) { expect(n.kind).toBe("inferred"); expect(n.evidence_ids.length).toBeGreaterThan(0); }
  });
  it("lists the diagnosis' own patient groups before umbrella organizations", async () => {
    const r = await communitiesFor("Dravet") as { data: { patient_organizations: { kind?: string }[] } };
    const kinds = r.data.patient_organizations.map((o) => o.kind === "umbrella");
    expect(kinds.indexOf(true)).toBeGreaterThan(kinds.lastIndexOf(false));
  });
  it("resolve never guesses", async () => {
    expect((await resolveName("Zorblax")).data).toMatchObject({ entity_id: null, method: "none" });
  });
});
