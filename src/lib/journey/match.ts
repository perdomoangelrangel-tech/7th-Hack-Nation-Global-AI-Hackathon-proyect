/**
 * Matchmaking: ranked partner suggestions for a disease community. Each reason carries the edges that
 * prove it; a candidate with no evidence-backed reason is never suggested. The family's own patient
 * group is excluded (it is "us"), so the list is about who to reach next.
 */
import type { Edge } from "../atlas/types";
import type { PersonaId } from "../agents/profiles";
import { ACTIVE_STATUSES, cite, inOf, nameOf, other, outOf, tr, type Cite, type GraphIndex, type Locale } from "./graph";

export type ReasonCode = "shared_mechanism" | "works_on_ours" | "network_overlap" | "active_study" | "active_funding" | "patient_community";
export interface MatchReason { code: ReasonCode; text: string; weight: number; edges: string[]; sources: { label: string; url: string }[] }
export interface Partner {
  id: string; name: string; kind: "patient_org" | "research_org" | "investigator" | "sponsor";
  institution: string | null; url: string | null; score: number; diseases: { id: string; name: string }[];
  reasons: MatchReason[]; cite: Cite;
}
export interface MatchResult { disease: string; persona: PersonaId; partners: Partner[]; method: string }

const WEIGHT: Record<ReasonCode, number> = { shared_mechanism: 40, works_on_ours: 25, patient_community: 15, active_study: 12, active_funding: 10, network_overlap: 4 };
const MIN_FY = 2024;

export function matchPartners(g: GraphIndex, d: string, persona: PersonaId = "maria", l: Locale = "en", limit = 6): MatchResult | null {
  const disease = g.byId.get(d);
  if (!disease || disease.type !== "disease") return null;
  const A = g.snap.analytics;
  const dn = nameOf(disease, l);
  const name = (id: string) => nameOf(g.byId.get(id), l);
  const sims = [...outOf(g, d), ...inOf(g, d)].filter((e) => e.relation === "similar_to").map((e) => ({ disease: other(e, d), edge: e, score: e.confidence }));
  const simOf = new Map(sims.map((s) => [s.disease, s]));
  const cluster = A ? new Set(A.clusters.find((c) => c.id === A.disease_cluster[d])?.diseases ?? []) : new Set<string>();
  const scope = new Set([d, ...sims.map((s) => s.disease)]);

  // Candidate → the edges that tie it to a disease in scope.
  const cand = new Map<string, { kind: Partner["kind"]; name: string; edges: Edge[]; institution: string | null; url: string | null }>();
  const add = (id: string, kind: Partner["kind"], nm: string, e: Edge, institution: string | null = null, url: string | null = null) => {
    const c = cand.get(id) ?? { kind, name: nm, edges: [], institution, url };
    if (!c.edges.some((x) => x.id === e.id)) c.edges.push(e);
    cand.set(id, c);
  };
  for (const dis of scope) {
    for (const e of inOf(g, dis)) {
      const from = g.byId.get(e.from); if (!from) continue;
      if (from.type === "organization" && (e.relation === "supports" || e.relation === "researches") && from.props.kind !== "umbrella")
        add(from.id, e.relation === "supports" ? "patient_org" : "research_org", from.name, e, null, (from.props.url as string | undefined) ?? null);
      if (from.type === "investigator" && e.relation === "researches")
        add(from.id, "investigator", from.name, e, (from.props.institution as string | undefined) ?? null);
      if (from.type === "trial" && e.relation === "studies" && typeof from.props.sponsor === "string")
        add(`sponsor:${from.props.sponsor}`, "sponsor", from.props.sponsor, e);
    }
  }

  const partners: Partner[] = [];
  for (const [id, c] of cand) {
    const diseases = [...new Set(c.edges.map((e) => (scope.has(e.to) ? e.to : e.from)))];
    // Our own patient group is "us", not a partner.
    if (c.kind === "patient_org" && diseases.length === 1 && diseases[0] === d) continue;
    const reasons: Omit<MatchReason, "sources">[] = [];
    const onNb = diseases.filter((x) => simOf.has(x)).sort((a, b) => simOf.get(b)!.score - simOf.get(a)!.score);
    if (onNb.length) {
      const s = simOf.get(onNb[0])!;
      const shared = A?.similarity[s.edge.id]?.shared_phenotypes.length ?? 0;
      reasons.push({ code: "shared_mechanism", weight: WEIGHT.shared_mechanism * s.score * 5,
        text: tr(l, `Works on ${name(onNb[0])}, which shares ${shared} symptoms with ${dn} (inferred, ${s.score.toFixed(2)}).`, `Trabaja en ${name(onNb[0])}, que comparte ${shared} síntomas con ${dn} (inferido, ${s.score.toFixed(2)}).`),
        edges: [s.edge.id, ...c.edges.filter((e) => e.to === onNb[0] || e.from === onNb[0]).map((e) => e.id)] });
    }
    const onOurs = c.edges.filter((e) => e.to === d);
    if (onOurs.length) reasons.push({ code: "works_on_ours", weight: WEIGHT.works_on_ours, text: tr(l, `Already connected to ${dn} (${onOurs.length} ${onOurs.length === 1 ? "record" : "records"}).`, `Ya conectado con ${dn} (${onOurs.length} ${onOurs.length === 1 ? "registro" : "registros"}).`), edges: onOurs.map((e) => e.id) });
    if (c.kind === "patient_org" && onNb.length) reasons.push({ code: "patient_community", weight: WEIGHT.patient_community, text: tr(l, `The organized patient community of ${name(onNb[0])}.`, `La comunidad organizada de pacientes de ${name(onNb[0])}.`), edges: c.edges.filter((e) => e.relation === "supports").map((e) => e.id) });
    const activeTrials = c.edges.filter((e) => g.byId.get(e.from)?.type === "trial" && ACTIVE_STATUSES.has(String(g.byId.get(e.from)?.props.status)));
    if (activeTrials.length) reasons.push({ code: "active_study", weight: WEIGHT.active_study + 2 * Math.min(activeTrials.length, 4), text: tr(l, `Sponsors ${activeTrials.length} active ${activeTrials.length === 1 ? "study" : "studies"} here (${activeTrials.slice(0, 2).map((e) => g.byId.get(e.from)!.canonical_id).join(", ")}).`, `Patrocina ${activeTrials.length} ${activeTrials.length === 1 ? "estudio activo" : "estudios activos"} aquí (${activeTrials.slice(0, 2).map((e) => g.byId.get(e.from)!.canonical_id).join(", ")}).`), edges: activeTrials.map((e) => e.id) });
    const funded = c.edges.filter((e) => Number(e.props.fiscal_year ?? 0) >= MIN_FY);
    if (funded.length) reasons.push({ code: "active_funding", weight: WEIGHT.active_funding, text: tr(l, `Funded project since ${MIN_FY}: ${String(funded[0].props.title ?? funded[0].evidence[0]?.external_id).slice(0, 70)}.`, `Proyecto financiado desde ${MIN_FY}: ${String(funded[0].props.title ?? funded[0].evidence[0]?.external_id).slice(0, 70)}.`), edges: funded.map((e) => e.id) });
    const bridge = A?.bridges.find((b) => b.entity === id);
    const overlap = bridge ? bridge.diseases.filter((x) => cluster.has(x) || scope.has(x)).length : 0;
    if (bridge && overlap >= 2) reasons.push({ code: "network_overlap", weight: WEIGHT.network_overlap * overlap, text: tr(l, `Works across ${bridge.diseases.length} atlas diseases (${bridge.diseases.slice(0, 3).map(name).join(", ")}).`, `Trabaja en ${bridge.diseases.length} enfermedades del atlas (${bridge.diseases.slice(0, 3).map(name).join(", ")}).`), edges: bridge.edges.slice(0, 8) });

    const backed = reasons.filter((r) => r.edges.some((e) => g.edgeById.has(e)))
      .map((r) => ({ ...r, sources: sourcesFor(g, r.edges) }));
    if (!backed.length || !backed.some((r) => r.code === "shared_mechanism" || r.code === "works_on_ours")) continue;
    const score = backed.reduce((s, r) => s + r.weight, 0) + (c.kind === "investigator" && persona === "osei" ? 8 : 0) + (c.kind === "sponsor" && persona === "priya" ? 8 : 0) + (c.kind === "patient_org" && (persona === "maria" || persona === "devon") ? 20 : 0);
    partners.push({
      id, name: c.name, kind: c.kind, institution: c.institution, url: c.url, score: Math.round(score),
      diseases: diseases.map((x) => ({ id: x, name: name(x) })), reasons: backed.sort((a, b) => b.weight - a.weight),
      cite: cite(g, backed.flatMap((r) => r.edges)),
    });
  }
  partners.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return {
    disease: d, persona, partners: partners.slice(0, limit),
    method: tr(l, "Score = shared mechanism (inferred similarity of the neighbor they work on) + already connected to your disease + patient community + active studies + funding since 2024 + network overlap. Every reason cites edges.",
                  "Puntuación = mecanismo compartido (similitud inferida de la vecina en la que trabaja) + ya conectado con tu enfermedad + comunidad de pacientes + estudios activos + financiación desde 2024 + solapamiento de red. Cada razón cita aristas."),
  };
}

/** First evidence record of each edge (max 3): what an intro message can link to. */
function sourcesFor(g: GraphIndex, edgeIds: string[]) {
  const out: { label: string; url: string }[] = [];
  for (const id of edgeIds) {
    const ev = g.edgeById.get(id)?.evidence[0];
    if (!ev || out.some((o) => o.url === ev.url)) continue;
    const label = ev.source === "atlas_analysis" ? "Nexmed analysis — inferred similarity, needs expert review" : `${ev.external_id}${ev.quote ? ` — ${ev.quote.slice(0, 70)}` : ""}`;
    out.push({ label, url: ev.url });
    if (out.length === 3) break;
  }
  return out;
}
