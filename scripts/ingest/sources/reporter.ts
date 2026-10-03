/**
 * NIH RePORTER: proyectos financiados por enfermedad o gen (últimos 4 años fiscales).
 * Da investigadores con identidad estable (profile_id), su institución y el monto: la capa
 * "Funding–researcher–asset" del reto y la base para encontrar investigadores compartidos entre comunidades.
 */
import { type GraphWriter, getJSON, sleep } from "../graph";
import type { SeedDisease } from "../types";

const API = "https://api.reporter.nih.gov/v2/projects/search";

interface Project {
  appl_id: number; project_num: string; project_title: string; fiscal_year: number; award_amount: number | null;
  organization?: { org_name?: string; org_city?: string; org_state?: string; org_country?: string };
  principal_investigators?: { profile_id: number; full_name: string; is_contact_pi: boolean }[];
  agency_ic_admin?: { abbreviation?: string };
}

export async function ingestReporter(g: GraphWriter, d: SeedDisease) {
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
  const res = await getJSON<{ meta: { total: number }; results: Project[] }>(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const projects = res.results ?? [];
  const total = projects.reduce((s, p) => s + (p.award_amount ?? 0), 0);
  await g.upsertEntity({ ...disease, props: { nih_projects: res.meta?.total ?? projects.length, nih_award_total_sample: total } });

  // Un proyecto con varios años aparece varias veces: nos quedamos con el más reciente por número base.
  const latest = new Map<string, Project>();
  for (const p of projects) {
    const base = p.project_num.replace(/^\d/, "").replace(/-\w+$/, "");
    if (!latest.has(base)) latest.set(base, p);
  }

  for (const p of latest.values()) {
    const org = p.organization?.org_name;
    const where = [p.organization?.org_city, p.organization?.org_state, p.organization?.org_country].filter(Boolean).join(", ");
    for (const pi of p.principal_investigators ?? []) {
      await g.upsertEdge({
        from: { type: "investigator", canonicalId: `NIH:${pi.profile_id}`, name: tidy(pi.full_name), props: { identity: "nih_profile", institution: org, location: where } },
        to: disease, relation: "researches",
        confidence: 0.8, confidenceBasis: "nih_funded_project",
        props: { role: pi.is_contact_pi ? "contact_pi" : "pi", project: p.project_num, title: p.project_title, fiscal_year: p.fiscal_year, award: p.award_amount, institute: p.agency_ic_admin?.abbreviation },
        evidence: [{ source: "nih_reporter", externalId: p.project_num, url: `https://reporter.nih.gov/project-details/${p.appl_id}`, publishedOn: `${p.fiscal_year}-10-01`, quote: `${p.project_title} · ${org ?? ""} · FY${p.fiscal_year}` }],
      });
    }
  }
  await sleep(1000); // RePORTER pide <= 1 req/s
  await g.markSynced("nih_reporter");
}

const tidy = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
