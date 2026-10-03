// Curated regulatory approvals (supabase/seed/approvals.json), each tied to an official agency URL.
// Runs at the end of every ingest call so later Open Targets / ClinicalTrials.gov upserts never revert it.
import type { Ctx, SeedDisease } from "../types.ts";
import { APPROVALS } from "../seed.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

export async function approvals(ctx: Ctx, d: SeedDisease) {
  let n = 0;
  for (const a of APPROVALS.filter((x) => x.orpha === d.orpha)) {
    const { data: existing } = await ctx.db.from("edge_evidence").select("edge_props")
      .eq("relation", "treats").eq("from_canonical_id", a.treatment_id).eq("to_canonical_id", d.orpha).limit(1);
    const origin = (existing?.[0] as Any)?.edge_props?.origin;
    const treatment = {
      type: "treatment" as const, canonicalId: a.treatment_id, name: a.treatment_name,
      props: { chembl_id: a.treatment_id.startsWith("CHEMBL") ? a.treatment_id : undefined, approved: true, intervention_type: "DRUG" },
    };
    if (a.trade_name) ctx.batch.alias(treatment, a.trade_name, "en");
    ctx.batch.alias(treatment, a.treatment_name, "en");
    ctx.batch.edge({
      from: treatment, to: { type: "disease", canonicalId: d.orpha, name: d.name }, relation: "treats",
      confidence: 0.95, confidenceBasis: "regulatory_approval",
      props: {
        // keep 'opentargets' when Open Targets already has the edge; otherwise the curated source owns it
        origin: origin === "opentargets" ? undefined : "fda",
        approved_for_indication: true, approved: true, investigational: false, phase: 4, stage: "APPROVAL", status: "APPROVED",
        intervention_type: "DRUG",
        approval: { agency: a.agency, date: a.date, url: a.url, indication: a.indication, trade_name: a.trade_name },
      },
      evidence: [{ source: "fda", externalId: a.external_id, url: a.url, quote: a.quote, publishedOn: a.published_on ?? null }],
    });
    n++;
  }
  ctx.extra.approvals = n;
}
