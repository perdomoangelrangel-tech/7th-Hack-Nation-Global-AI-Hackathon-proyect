// NIH RePORTER: funded projects per disease or gene (last 4 fiscal years). Gives investigators with a stable
// identity (profile_id), their institution and award: the "funding–researcher" layer and the basis for finding
// investigators shared between communities (bridges). investigator -[researches]-> disease.
// Requires migration 0011 (entity type `investigator`, source `nih_reporter`).
import type { Ctx, SeedDisease } from "../types.ts";
import { getJSON, sleep, trunc } from "../http.ts";

const API = "https://api.reporter.nih.gov/v2/projects/search";
// deno-lint-ignore no-explicit-any
type Any = any;

const tidy = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export async function reporter(ctx: Ctx, d: SeedDisease) {
  const disease = { type: "disease" as const, canonicalId: d.orpha, name: d.name };
  const year = new Date().getFullYear();
  const text = [`"${d.search_terms[0]}"`, ...d.genes].join(" OR ");
  const body = {
    criteria: {
      advanced_text_search: { operator: "advanced", search_field: "projecttitle,terms,abstracttext", search_text: text },
      fiscal_years: [year - 3, year - 2, year - 1, year],
    },
    include_fields: ["ApplId", "ProjectNum", "ProjectTitle", "PrincipalInvestigators", "Organization", "FiscalYear", "AwardAmount", "AgencyIcAdmin"],
    sort_field: "fiscal_year", sort_order: "desc", limit: 100,
  };
  const res = await getJSON<Any>(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  ctx.sample("reporter.meta", res?.meta);
  const projects: Any[] = res?.results ?? [];
  const total = projects.reduce((s, p) => s + (p.award_amount ?? 0), 0);
  ctx.batch.entity({ ...disease, props: { nih_projects: res?.meta?.total ?? projects.length, nih_award_total_sample: total } });

  // A multi-year project appears once per year: keep the most recent per base number.
  const latest = new Map<string, Any>();
  for (const p of projects) {
    const base = String(p.project_num ?? "").replace(/^\d/, "").replace(/-\w+$/, "");
    if (base && !latest.has(base)) latest.set(base, p);
  }
  let n = 0;
  for (const p of latest.values()) {
    const org = p.organization?.org_name;
    const where = [p.organization?.org_city, p.organization?.org_state, p.organization?.org_country].filter(Boolean).join(", ");
    for (const pi of p.principal_investigators ?? []) {
      if (!pi?.profile_id || !pi?.full_name) continue;
      ctx.batch.edge({
        from: { type: "investigator", canonicalId: `NIH:${pi.profile_id}`, name: tidy(pi.full_name), props: { identity: "nih_profile", institution: org, location: where } },
        to: disease, relation: "researches",
        confidence: 0.8, confidenceBasis: "nih_funded_project",
        props: { role: pi.is_contact_pi ? "contact_pi" : "pi", project: p.project_num, title: trunc(p.project_title, 300), fiscal_year: p.fiscal_year, award: p.award_amount, institute: p.agency_ic_admin?.abbreviation },
        evidence: [{ source: "nih_reporter", externalId: p.project_num, url: `https://reporter.nih.gov/project-details/${p.appl_id}`, publishedOn: `${p.fiscal_year}-10-01`, quote: trunc(`${p.project_title} · ${org ?? ""} · FY${p.fiscal_year}`, 300) }],
      });
      n++;
    }
  }
  ctx.extra.investigator_links = n;
  await sleep(1100); // RePORTER asks for <= 1 request/s
}
