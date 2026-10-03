/** Organizaciones de pacientes y comunidades de investigadores (archivo curado). */
import { Graph, today } from "../graph";
import type { SeedDisease, SeedOrganization } from "../types";

export async function ingestOrganizations(g: Graph, orgs: SeedOrganization[], diseases: SeedDisease[]) {
  const byOrpha = new Map(diseases.map((d) => [d.orpha, d]));
  for (const o of orgs) {
    for (const code of o.diseases) {
      const d = byOrpha.get(code); if (!d) continue;
      await g.upsertEdge({
        from: { type: "organization", canonicalId: `ORG:${slug(o.name)}`, name: o.name, props: { country: o.country, url: o.url, kind: o.kind } },
        to: { type: "disease", canonicalId: d.orpha, name: d.name },
        relation: o.kind === "research" ? "researches" : "supports",
        confidence: 0.9, confidenceBasis: "curated",
        evidence: [{ source: "patient_orgs", externalId: slug(o.name), url: o.url, publishedOn: today(), quote: `${o.name} · ${o.country}` }],
      });
    }
  }
  await g.markSynced("patient_orgs");
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
