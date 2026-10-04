/**
 * Pharma view (UX_WAVE4 S2 · "Clusters for your mechanism"): one row per mechanism cluster, ranked by
 * unmet need. Counts come from graph edges only; each row cites the edges it counted.
 *   unmet need = share of the cluster's diseases with no approved treatment, then fewer active trials first.
 */
import { ACTIVE_STATUSES, cite, inOf, nameOf, tr, type Cite, type GraphIndex, type Locale } from "./graph";

export interface ClusterRow {
  id: string; label: string; color: string; rank: number;
  diseases: { id: string; name: string; approved: boolean }[];
  variant_effect: { loss_of_function: number; other: number; unknown: number; text: string };
  active_trials: number; reusable_assets: number; patient_groups: number;
  approved_diseases: number; unmet_share: number;
  key_people: { id: string; name: string; diseases: number }[];
  cite: Cite;
}
export interface ClusterTable { rows: ClusterRow[]; method: string; columns: string[] }

const REUSABLE = new Set(["natural_history", "registry", "biomarker_study", "observational_cohort"]);

export function clusterTable(g: GraphIndex, l: Locale = "en"): ClusterTable {
  const A = g.snap.analytics;
  const rows: ClusterRow[] = (A?.clusters ?? []).map((c) => {
    const ds = c.diseases.filter((d) => g.byId.get(d)?.type === "disease");
    const edges: string[] = [];
    let trials = 0, assets = 0, groups = 0, approved = 0, lof = 0, other = 0, unknown = 0;
    const dRows = ds.map((d) => {
      const studies = inOf(g, d).filter((e) => e.relation === "studies" && g.byId.get(e.from)?.type === "trial" && ACTIVE_STATUSES.has(String(g.byId.get(e.from)?.props.status)));
      const tr_ = studies.filter((e) => e.props.asset_kind === "interventional_trial");
      const as = studies.filter((e) => REUSABLE.has(String(e.props.asset_kind)));
      const gr = inOf(g, d).filter((e) => e.relation === "supports" && g.byId.get(e.from)?.props.kind !== "umbrella");
      const ap = inOf(g, d).filter((e) => e.relation === "treats" && e.props.approved);
      trials += tr_.length; assets += as.length; groups += gr.length; if (ap.length) approved++;
      edges.push(...tr_.map((e) => e.id), ...as.map((e) => e.id), ...gr.map((e) => e.id), ...ap.map((e) => e.id));
      const v = A?.variant_effect[d];
      if (!v) unknown++; else if (v.lof_fraction >= 0.5) { lof++; edges.push(v.edge); } else { other++; edges.push(v.edge); }
      return { id: d, name: nameOf(g.byId.get(d), l), approved: ap.length > 0 };
    });
    const people = (A?.bridges ?? []).filter((b) => b.kind === "investigator")
      .map((b) => ({ b, n: b.diseases.filter((d) => ds.includes(d)).length })).filter((x) => x.n >= 2)
      .sort((a, b) => b.n - a.n || a.b.name.localeCompare(b.b.name)).slice(0, 3);
    for (const p of people) edges.push(...p.b.edges.slice(0, 4));
    return {
      id: c.id, label: c.label, color: c.color, rank: 0, diseases: dRows,
      variant_effect: { loss_of_function: lof, other, unknown,
        text: tr(l, `${lof} loss-of-function likely · ${other} other/mixed${unknown ? ` · ${unknown} unknown` : ""}`, `${lof} pérdida de función probable · ${other} otro/mixto${unknown ? ` · ${unknown} desconocido` : ""}`) },
      active_trials: trials, reusable_assets: assets, patient_groups: groups,
      approved_diseases: approved, unmet_share: ds.length ? (ds.length - approved) / ds.length : 0,
      key_people: people.map((p) => ({ id: p.b.entity, name: p.b.name, diseases: p.n })),
      cite: cite(g, edges),
    };
  });
  rows.sort((a, b) => b.unmet_share - a.unmet_share || a.active_trials - b.active_trials || b.diseases.length - a.diseases.length);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return {
    rows,
    columns: l === "es"
      ? ["Cluster", "Enfermedades", "Efecto de variante", "Ensayos activos", "Activos reutilizables", "Grupos de pacientes", "¿Tratamiento aprobado?", "Personas clave"]
      : ["Cluster", "Diseases", "Variant effect", "Active trials", "Reusable assets", "Patient groups", "Approved treatment?", "Key people"],
    method: tr(l,
      "Ranked by unmet need: share of diseases with no approved treatment (Open Targets), then fewer active interventional trials (ClinicalTrials.gov). Counts are graph edges; variant effect from ClinVar counts.",
      "Ordenado por necesidad no cubierta: proporción de enfermedades sin tratamiento aprobado (Open Targets), luego menos ensayos intervencionales activos (ClinicalTrials.gov). Los conteos son aristas del grafo; el efecto de variante viene de conteos de ClinVar."),
  };
}

/** CSV for "Export CSV" (no claims beyond the counted columns). */
export function clusterCsv(t: ClusterTable): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [["Rank", ...t.columns].map(esc).join(",")];
  for (const r of t.rows) lines.push([r.rank, r.label, r.diseases.map((d) => d.name).join("; "), r.variant_effect.text, r.active_trials, r.reusable_assets, r.patient_groups, `${r.approved_diseases}/${r.diseases.length}`, r.key_people.map((p) => p.name).join("; ")].map(esc).join(","));
  return lines.join("\n");
}
