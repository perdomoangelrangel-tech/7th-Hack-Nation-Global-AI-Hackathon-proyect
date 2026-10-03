// Patient organisations and research foundations (curated seed, supabase/seed/organizations.json).
// kind 'research' -> `researches` edge; everything else -> `supports`. Evidence url = org website.
import type { Ctx, SeedDisease } from "../types.ts";
import { ORGANIZATIONS } from "../seed.ts";
import { slug } from "../http.ts";

export function orgs(ctx: Ctx, d: SeedDisease) {
  let n = 0;
  for (const o of ORGANIZATIONS) {
    if (!o.diseases.includes(d.orpha)) continue;
    const org = {
      type: "organization" as const, canonicalId: `ORG:${slug(o.name)}`, name: o.name,
      props: { country: o.country, url: o.url, kind: o.kind },
    };
    ctx.batch.edge({
      from: org, to: { type: "disease", canonicalId: d.orpha, name: d.name },
      relation: o.kind === "research" ? "researches" : "supports",
      confidence: 0.9, confidenceBasis: "curated",
      props: { kind: o.kind },
      evidence: [{ source: "patient_orgs", externalId: slug(o.name), url: o.url, quote: `${o.name} · ${o.country} · ${o.kind}` }],
    });
    n++;
  }
  ctx.extra.organizations = n;
  return Promise.resolve();
}
