/**
 * Journey v2: the four questions a family or patient group asks, answered only from the graph.
 *   1. Who shares our disease characteristics?   (neighbors + why + counterexamples)
 *   2. What useful work already exists?          (reusable assets + what differs + what needs expert review)
 *   3. Who could help?                           (collaborators that already bridge both communities)
 *   4. What should we do together next?          (2–4 steps this week, each with evidence edges + owner type)
 * Every card carries a `cite` (edge ids + evidence ids). A step without evidence edges is never returned.
 * When there is nothing to say, each question returns `none` (what we checked, what evidence is missing).
 */
import type { Edge, Gap } from "../atlas/types";
import type { PersonaId } from "../agents/profiles";
import {
  ACTIVE_STATUSES, ANALYSIS_LABEL, isAnalysisSource, cite, diseasesOf, fullNameOf, inOf, nameOf, other, outOf, prettyStatus, tr,
  type Cite, type GraphIndex, type Locale,
} from "./graph";

export type QuestionId = "connections" | "assets" | "people" | "next";
export type OwnerType = "patient_group" | "researcher" | "clinician" | "funder";

export interface NoneFound { title: string; detail: string; missing_evidence: string[]; next_question: string }

export interface VariantEffect { gene: string; lof_fraction: number; missense_fraction: number; n: number; edge: string }

export type LeadStrength = "strong" | "possible" | "weak";
export interface NeighborCard {
  disease: string; name: string; score: number; same_cluster: boolean; edge: string;
  /** Shown on the route instead of the raw score (UX_WAVE4 §3); the score itself stays for the evidence drawer. */
  strength: { level: LeadStrength; label: string; basis: string; informative_symptoms: number };
  shared: { phenotypes: { id: string; name: string }[]; pathways: { id: string; name: string }[]; genes: string[] };
  variant_effect: { self: VariantEffect | null; other: VariantEffect | null; match: boolean | null };
  strategy: string; needs_review: string[]; cite: Cite;
}
export interface CounterCard { disease: string; name: string; shared_phenotypes: string[]; why: string; cite: Cite }
export interface AssetCard {
  id: string; nct: string; title: string; kind: string; status: string; active: boolean; sponsor: string | null;
  countries: string[]; enrollment: number | null; disease: string; disease_name: string; own: boolean;
  shared_with: { id: string; name: string }[]; url: string; what_differs: string[]; needs_review: string[]; cite: Cite;
}
export interface TreatmentCard { id: string; name: string; approved: boolean; stage: string; mechanism: string | null; stopped: boolean; disease: string; disease_name: string; cite: Cite }
export interface CollaboratorCard {
  id: string; name: string; kind: "patient_org" | "research_org" | "investigator" | "sponsor";
  institution: string | null; url: string | null; diseases: { id: string; name: string }[];
  bridges: boolean; why: string; proof: { edge: string; label: string; url: string }[]; cite: Cite;
}
export interface StepCard {
  id: string; kind: "connect" | "reuse" | "validate" | "repurpose" | "fund" | "fill_gap" | "community";
  owner: OwnerType; title: string; detail: string; nodes: string[]; needs_review: boolean; cite: Cite;
}
export interface GapCard { kind: Gap["kind"]; title: string; what_would_change_it: string }
export interface UnmetNeedRow { disease: string; name: string; approved: number; active_trials: number; patient_org: boolean; gaps: Gap["kind"][]; cite: Cite }
export interface Coverage {
  sources: { id: string; name: string; last_synced_at: string | null; evidence_for_disease: number }[];
  counts: Record<string, number>;
}

export interface JourneyV2 {
  version: 2;
  persona: PersonaId; locale: Locale;
  disease: { id: string; name: string; full_name: string; canonical_id: string; definition: string | null; orphanet_url: string | null; centrality: number; variant_effect: VariantEffect | null };
  cluster: { id: string; label: string; label_basis: string; color: string; members: { id: string; name: string }[] } | null;
  order: QuestionId[];
  summary: Record<QuestionId, { text: string; cite: Cite }>;
  connections: { neighbors: NeighborCard[]; counterexamples: CounterCard[]; none: NoneFound | null };
  assets: { own: AssetCard[]; reusable: AssetCard[]; treatments: TreatmentCard[]; neighbor_approved: TreatmentCard[]; none: NoneFound | null };
  people: { collaborators: CollaboratorCard[]; none: NoneFound | null };
  next: { steps: StepCard[]; later: StepCard[]; none: NoneFound | null };
  gaps: GapCard[];
  unmet_need: UnmetNeedRow[];
  coverage: Coverage;
  no_route: NoneFound | null;
  disclaimer: string;
  /** Patient mode (UX_WAVE4 S2): plain words, every sentence still cited. */
  plain: PlainView;
  /** Researcher mode: the causal gene, its variant effect and its Reactome pathways. */
  mechanism: MechanismView;
}

export interface PlainView {
  what_is_it: { text: string; signs: string[]; cite: Cite };
  people_like_you: { groups: { id: string; name: string; url: string | null }[]; cite: Cite };
  research_now: { studies: { id: string; nct: string; title: string; status: string; countries: string[]; url: string }[]; cite: Cite };
  this_week: StepCard[];
}
export interface MechanismView {
  gene: { id: string; symbol: string; edge: string } | null;
  variant_effect: VariantEffect | null;
  variant_call: string | null;
  pathways: { id: string; name: string; edge: string; shared_with: { id: string; name: string }[] }[];
  cluster_basis: string | null;
  cite: Cite;
}

export const ORDER: Record<PersonaId, QuestionId[]> = {
  devon: ["people", "connections", "assets", "next"],      // Patient: community first
  maria: ["connections", "assets", "people", "next"],      // Family & patient group: the full route
  osei: ["connections", "people", "assets", "next"],       // Researcher: mechanism + counterexamples, then colleagues
  priya: ["connections", "assets", "next", "people"],      // Pharma: clusters + unmet need, assets
};

const STEP_ORDER: Record<PersonaId, StepCard["kind"][]> = {
  devon: ["community", "connect", "reuse", "fill_gap", "validate", "repurpose", "fund"],
  maria: ["connect", "reuse", "validate", "fill_gap", "fund", "repurpose", "community"],
  osei: ["validate", "repurpose", "reuse", "connect", "fund", "fill_gap", "community"],
  priya: ["repurpose", "fund", "reuse", "validate", "connect", "fill_gap", "community"],
};

const ASSET_KIND_ORDER = ["natural_history", "registry", "biomarker_study", "observational_cohort", "interventional_trial"];
export const DISCLAIMER = {
  en: "Not medical advice. Sourced information only; inferred links are hypotheses that an expert must review.",
  es: "No es consejo médico. Solo información con fuentes; las conexiones inferidas son hipótesis que debe revisar un experto.",
};

export function buildJourney(g: GraphIndex, d: string, persona: PersonaId = "maria", l: Locale = "en"): JourneyV2 | null {
  const disease = g.byId.get(d);
  if (!disease || disease.type !== "disease") return null;
  const A = g.snap.analytics;
  const dn = nameOf(disease, l);
  const name = (id: string) => nameOf(g.byId.get(id), l);
  const ve = (id: string): VariantEffect | null => { const v = A?.variant_effect[id]; return v ? { gene: v.gene, lof_fraction: v.lof_fraction, missense_fraction: v.missense_fraction, n: v.n, edge: v.edge } : null; };

  /* ---------------- 1. Who shares our disease characteristics? ---------------- */
  const simEdges = outOf(g, d).concat(inOf(g, d)).filter((e) => e.relation === "similar_to");
  const neighbors: NeighborCard[] = simEdges.map((e) => {
    const nd = other(e, d);
    const x = A?.similarity[e.id];
    const self = ve(d), oth = ve(nd);
    // Only a large gap in truncating fraction counts as a different variant effect (avoid over-reading 57% vs 46%).
    const match = self && oth ? Math.abs(self.lof_fraction - oth.lof_fraction) < 0.25 : null;
    const shared = {
      phenotypes: (x?.shared_phenotypes ?? []).map((p) => ({ id: p.id, name: p.name })),
      pathways: (x?.shared_pathways ?? []).map((p) => ({ id: p.id, name: p.name })),
      genes: x?.shared_genes ?? [],
    };
    const mech = shared.pathways.length > 0 || shared.genes.length > 0;
    const strategy = mech
      ? tr(l, `Shared mechanism signal (${shared.genes.length ? `gene ${shared.genes.join(", ")}` : `pathway ${shared.pathways[0].name}`}): approaches studied in ${name(nd)} may be worth comparing.`,
             `Señal de mecanismo compartido (${shared.genes.length ? `gen ${shared.genes.join(", ")}` : `vía ${shared.pathways[0].name}`}): vale la pena comparar lo estudiado en ${name(nd)}.`)
      : tr(l, `Shared symptoms, no shared pathway or gene in our sources: a lead for comparison, not proof of a shared mechanism.`,
             `Síntomas compartidos, sin vía ni gen en común en nuestras fuentes: una pista para comparar, no prueba de un mecanismo compartido.`);
    const needs_review = [tr(l, "Inferred by Nedamex from observed symptom/pathway edges — an expert must confirm it.", "Inferido por Nedamex a partir de aristas observadas de síntomas/vías — debe confirmarlo un experto.")];
    if (match === false && self && oth) needs_review.push(tr(l,
      `Different variant effect (${self.gene} ${pct(self.lof_fraction)} truncating vs ${oth.gene} ${pct(oth.lof_fraction)}): mechanism-based endpoints may not transfer.`,
      `Efecto de variante distinto (${self.gene} ${pct(self.lof_fraction)} truncantes vs ${oth.gene} ${pct(oth.lof_fraction)}): los endpoints de mecanismo podrían no trasladarse.`));
    return {
      disease: nd, name: name(nd), score: e.confidence, edge: e.id, strength: leadStrength(shared, x?.shared_phenotypes ?? [], l),
      same_cluster: !!A && A.disease_cluster[e.from] === A.disease_cluster[e.to],
      shared, variant_effect: { self, other: oth, match }, strategy, needs_review,
      cite: cite(g, [e.id, ...(x?.supporting_edges ?? []).slice(0, 12), ...(self ? [self.edge] : []), ...(oth ? [oth.edge] : [])]),
    };
  }).sort((a, b) => b.score - a.score);
  const nbIds = new Set(neighbors.map((n) => n.disease));
  const lead = neighbors[0];

  const counterexamples: CounterCard[] = (A?.counterexamples ?? []).filter((c) => c.a === d || c.b === d).map((c) => {
    const od = c.a === d ? c.b : c.a;
    const names = new Set(c.shared_phenotypes);
    const phenEdges = [d, od].flatMap((x) => outOf(g, x).filter((e) => e.relation === "has_phenotype" && names.has(g.byId.get(e.to)?.name ?? "")).map((e) => e.id));
    return {
      disease: od, name: name(od), shared_phenotypes: c.shared_phenotypes,
      why: tr(l, `Similar symptoms (${c.shared_phenotypes.slice(0, 3).join(", ")}) but no shared Reactome pathway: probably a different mechanism, so probably a different strategy.`,
                 `Síntomas parecidos (${c.shared_phenotypes.slice(0, 3).join(", ")}) pero ninguna vía Reactome en común: probablemente otro mecanismo y otra estrategia.`),
      cite: cite(g, phenEdges),
    };
  }).filter((c) => c.cite.edges.length > 0);

  /* ---------------- 2. What useful work already exists? ---------------- */
  const assetEdges = (dis: string) => inOf(g, dis).filter((e) => e.relation === "studies" && g.byId.get(e.from)?.type === "trial");
  const trialDiseases = (trialId: string) => outOf(g, trialId).filter((e) => e.relation === "studies").map((e) => e.to);
  const toAsset = (e: Edge, own: boolean): AssetCard => {
    const t = g.byId.get(e.from)!; const p = t.props as Record<string, unknown>;
    const status = String(p.status ?? "UNKNOWN");
    const kind = String(p.asset_kind ?? "interventional_trial");
    const inAtlas = trialDiseases(t.id);
    const shared_with = inAtlas.filter((x) => x !== e.to && nbIds.has(x)).map((x) => ({ id: x, name: name(x) }));
    const conditions = (p.conditions as string[] | undefined) ?? [];
    const what_differs: string[] = []; const needs_review: string[] = [];
    const sponsor = (p.sponsor as string | undefined) ?? null;
    if (own) {
      if (shared_with.length) what_differs.push(tr(l, `Already enrolls ${dn} and ${shared_with.map((s) => s.name).join(", ")} — an existing bridge between communities.`, `Ya incluye ${dn} y ${shared_with.map((s) => s.name).join(", ")} — un puente que ya existe entre comunidades.`));
      if (ACTIVE_STATUSES.has(status)) needs_review.push(tr(l, `Confirm with the study team that ${dn} participants can still enroll.`, `Confirmar con el equipo del estudio que participantes con ${dn} aún pueden inscribirse.`));
    } else {
      const own_d = e.to;
      what_differs.push(tr(l, `Written for ${name(own_d)}${conditions.length ? ` (conditions: ${conditions.slice(0, 3).join(", ")})` : ""}, not for ${dn}.`, `Escrito para ${name(own_d)}${conditions.length ? ` (condiciones: ${conditions.slice(0, 3).join(", ")})` : ""}, no para ${dn}.`));
      needs_review.push(tr(l, `Eligibility: check whether the protocol can admit ${dn} patients.`, `Elegibilidad: revisar si el protocolo puede admitir pacientes con ${dn}.`));
      const nb = neighbors.find((n) => n.disease === own_d);
      if (nb && (nb.variant_effect.match === false || (!nb.shared.pathways.length && !nb.shared.genes.length)))
        needs_review.push(tr(l, `Biology: outcome measures were chosen for ${name(own_d)}; the shared link with ${dn} is symptoms, not a confirmed mechanism.`, `Biología: los desenlaces se eligieron para ${name(own_d)}; el vínculo con ${dn} son síntomas, no un mecanismo confirmado.`));
    }
    return {
      id: t.id, nct: t.canonical_id, title: t.name, kind, status, active: ACTIVE_STATUSES.has(status), sponsor,
      countries: (p.countries as string[] | undefined) ?? [], enrollment: typeof p.enrollment === "number" ? p.enrollment : null,
      disease: e.to, disease_name: name(e.to), own, shared_with, url: e.evidence[0]?.url ?? "",
      what_differs, needs_review,
      cite: cite(g, [e.id, ...outOf(g, t.id).filter((x) => x.relation === "studies" && nbIds.has(x.to)).map((x) => x.id)]),
    };
  };
  const nbRank = new Map(neighbors.map((n, i) => [n.disease, i]));
  const rankAsset = (a: AssetCard) => (a.shared_with.length ? -100 : 0) + (a.active ? 0 : a.status === "COMPLETED" ? 30 : 50) + ASSET_KIND_ORDER.indexOf(a.kind) * 5 + (nbRank.get(a.disease) ?? 0) * 12;
  const own = assetEdges(d).map((e) => toAsset(e, true)).sort((a, b) => rankAsset(a) - rankAsset(b));
  const ownIds = new Set(own.map((a) => a.id));
  const reusable = neighbors.slice(0, 3).flatMap((n) => assetEdges(n.disease).map((e) => toAsset(e, false)))
    .filter((a) => a.kind !== "interventional_trial" && !ownIds.has(a.id) && a.status !== "WITHDRAWN")
    .filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i)
    .sort((a, b) => rankAsset(a) - rankAsset(b))
    .slice(0, 6);

  const toTreatment = (e: Edge, dis: string): TreatmentCard => {
    const t = g.byId.get(e.from)!;
    return { id: t.id, name: t.name, approved: !!e.props.approved, stage: String(e.props.stage ?? ""), mechanism: (t.props.mechanism as string | undefined) ?? null,
      stopped: ((e.props.stopped_reports as unknown[] | undefined) ?? []).length > 0, disease: dis, disease_name: name(dis), cite: cite(g, [e.id]) };
  };
  const treatments = inOf(g, d).filter((e) => e.relation === "treats").map((e) => toTreatment(e, d)).sort((a, b) => Number(b.approved) - Number(a.approved) || b.stage.localeCompare(a.stage));
  const neighborApproved = neighbors.slice(0, 3).flatMap((n) => inOf(g, n.disease).filter((e) => e.relation === "treats" && e.props.approved).map((e) => toTreatment(e, n.disease)))
    .filter((t, i, arr) => arr.findIndex((x) => x.name.toLowerCase().split(" ")[0] === t.name.toLowerCase().split(" ")[0] && x.disease === t.disease) === i);

  /* ---------------- 3. Who could help? ---------------- */
  const collaborators: CollaboratorCard[] = [];
  const proofLabel = (e: Edge, who: string) => {
    const dis = e.to === who ? e.from : e.to;
    const ev = e.evidence[0];
    const p = e.props as Record<string, unknown>;
    const what = p.title ? String(p.title).slice(0, 80) : g.byId.get(e.from)?.type === "trial" ? g.byId.get(e.from)!.name.slice(0, 80) : ev?.quote ? ev.quote.slice(0, 80) : tr(l, "publication", "publicación");
    return { edge: e.id, label: `${name(dis) || name(e.to)} · ${what}${ev ? ` (${ev.external_id})` : ""}`, url: ev?.url ?? "" };
  };
  for (const dis of [d, ...neighbors.slice(0, 3).map((n) => n.disease)]) {
    for (const e of inOf(g, dis).filter((x) => (x.relation === "supports" || x.relation === "researches") && g.byId.get(x.from)?.type === "organization")) {
      const o = g.byId.get(e.from)!;
      if (o.props.kind === "umbrella") continue;
      const existing = collaborators.find((c) => c.id === o.id);
      if (existing) { existing.diseases.push({ id: dis, name: name(dis) }); existing.cite = cite(g, [...existing.cite.edges, e.id]); existing.bridges = existing.diseases.some((x) => x.id === d) && existing.diseases.some((x) => nbIds.has(x.id)); continue; }
      collaborators.push({
        id: o.id, name: o.name, kind: e.relation === "supports" ? "patient_org" : "research_org",
        institution: null, url: (o.props.url as string | undefined) ?? null, diseases: [{ id: dis, name: name(dis) }], bridges: false,
        why: dis === d ? tr(l, `The patient community for ${dn}.`, `La comunidad de pacientes de ${dn}.`) : tr(l, `The patient community for ${name(dis)}, a neighbor disease.`, `La comunidad de pacientes de ${name(dis)}, una enfermedad vecina.`),
        proof: [{ edge: e.id, label: `${name(dis)} · ${e.evidence[0]?.external_id ?? e.relation}`, url: e.evidence[0]?.url ?? "" }],
        cite: cite(g, [e.id]),
      });
    }
  }
  for (const b of (A?.bridges ?? []).filter((x) => x.diseases.includes(d) && x.kind !== "organization")) {
    const others = b.diseases.filter((x) => x !== d);
    if (!others.length) continue;
    // Keep only the edges that touch the focus disease or its neighbors: that is the proof that matters here.
    const rel = b.edges.map((id) => g.edgeById.get(id)).filter((e): e is Edge => !!e && (e.to === d || e.from === d || nbIds.has(e.to) || nbIds.has(e.from)));
    if (!rel.length) continue;
    const touchesNb = others.some((x) => nbIds.has(x));
    const ent = g.byId.get(b.entity);
    const othersShown = [...others.filter((x) => nbIds.has(x)), ...others.filter((x) => !nbIds.has(x))];
    collaborators.push({
      id: b.entity, name: b.name, kind: b.kind === "investigator" ? "investigator" : "sponsor",
      institution: (ent?.props.institution as string | undefined) ?? null, url: null,
      diseases: b.diseases.map((x) => ({ id: x, name: name(x) })), bridges: touchesNb,
      why: tr(l, `Already works on ${dn} and ${othersShown.slice(0, 3).map(name).join(", ")}${othersShown.length > 3 ? ` (+${othersShown.length - 3})` : ""}.`,
                 `Ya trabaja en ${dn} y en ${othersShown.slice(0, 3).map(name).join(", ")}${othersShown.length > 3 ? ` (+${othersShown.length - 3})` : ""}.`),
      proof: rel.sort((a, b2) => Number(nbIds.has(b2.to)) - Number(nbIds.has(a.to))).slice(0, 4).map((e) => proofLabel(e, b.entity)),
      cite: cite(g, rel.map((e) => e.id)),
    });
  }
  const nbScore = new Map(neighbors.map((n) => [n.disease, n.score]));
  const collabScore = (c: CollaboratorCard) => (c.bridges ? 20 : 0) + (c.diseases.some((x) => x.id === d) ? 6 : 0) + ({ patient_org: 8, investigator: 5, research_org: 2, sponsor: 1 })[c.kind]
    + Math.min(c.diseases.length, 4) + 20 * Math.max(0, ...c.diseases.map((x) => nbScore.get(x.id) ?? 0));
  collaborators.sort((a, b) => collabScore(b) - collabScore(a) || a.name.localeCompare(b.name));
  // Diversity: every patient community (ours + neighbors) and the strongest bridges; sponsors capped so they do not crowd out people.
  const cited = collaborators.filter((c) => c.cite.edges.length > 0);
  const people = [...cited.filter((c) => c.kind === "patient_org"), ...cited.filter((c) => c.kind === "investigator").slice(0, 4), ...cited.filter((c) => c.kind === "research_org").slice(0, 2), ...cited.filter((c) => c.kind === "sponsor").slice(0, 3)]
    .sort((a, b) => collabScore(b) - collabScore(a) || a.name.localeCompare(b.name));
  // Patient mode: "is there a community for my exact diagnosis?" comes before any researcher or sponsor.
  if (persona === "devon") people.sort((a, b) => Number(isOwnGroup(b)) - Number(isOwnGroup(a)));
  function isOwnGroup(c: CollaboratorCard) { return c.kind === "patient_org" && c.diseases.some((x) => x.id === d); }

  /* ---------------- 4. What should we do together next? ---------------- */
  const steps: StepCard[] = [];
  const ownOrg = people.find((c) => c.kind === "patient_org" && c.diseases.some((x) => x.id === d));
  if (ownOrg) steps.push({ id: "community", kind: "community", owner: "patient_group", nodes: [ownOrg.id, d], needs_review: false, cite: ownOrg.cite,
    title: tr(l, `Connect with ${ownOrg.name}`, `Conectar con ${ownOrg.name}`),
    detail: tr(l, `It is the patient organization for ${dn} in our sources. Ask what registry or natural-history data they already hold.`, `Es la organización de pacientes de ${dn} en nuestras fuentes. Pregunten qué registro o datos de historia natural tienen ya.`) });
  if (lead) {
    const org = people.find((c) => c.kind === "patient_org" && c.diseases.some((x) => x.id === lead.disease));
    const what = lead.shared.phenotypes.slice(0, 3).map((p) => p.name).join(", ");
    steps.push({ id: "connect", kind: "connect", owner: "patient_group", nodes: [d, lead.disease, ...(org ? [org.id] : [])], needs_review: true,
      cite: cite(g, [lead.edge, ...(org?.cite.edges ?? [])]),
      title: org ? tr(l, `Reach out to ${org.name} (${lead.name})`, `Contactar a ${org.name} (${lead.name})`) : tr(l, `Reach out to the ${lead.name} community`, `Contactar a la comunidad de ${lead.name}`),
      detail: tr(l, `${dn} and ${lead.name} share ${what}. Bring this connection's explanation: it is inferred and needs expert review.`,
                    `${dn} y ${lead.name} comparten ${what}. Lleven la explicación de esta conexión: es inferida y debe revisarla un experto.`) });
  }
  const sharedOwn = own.find((a) => a.shared_with.length && a.active);
  if (sharedOwn) steps.push({ id: "reuse-shared", kind: "reuse", owner: "patient_group", nodes: [sharedOwn.id, d, ...sharedOwn.shared_with.map((s) => s.id)], needs_review: false, cite: sharedOwn.cite,
    title: tr(l, `Build on ${sharedOwn.nct}, which already enrolls ${dn} and ${sharedOwn.shared_with[0].name}`, `Apoyarse en ${sharedOwn.nct}, que ya incluye ${dn} y ${sharedOwn.shared_with[0].name}`),
    detail: tr(l, `${sharedOwn.title}${sharedOwn.sponsor ? ` (${sharedOwn.sponsor})` : ""}, ${prettyStatus(sharedOwn.status)}. Ask the study team how families can join and which data could be shared across both communities.`,
                  `${sharedOwn.title}${sharedOwn.sponsor ? ` (${sharedOwn.sponsor})` : ""}, ${prettyStatus(sharedOwn.status)}. Pregunten al equipo cómo pueden unirse las familias y qué datos podrían compartirse entre ambas comunidades.`) });
  const REUSE_KINDS = new Set(["natural_history", "registry", "observational_cohort"]);
  // Closest neighbors first (rank < 2): natural history / registry, then cohort; only then farther neighbors.
  const near = (a: AssetCard) => (nbRank.get(a.disease) ?? 9) < 2;
  const reuse = reusable.find((a) => a.active && near(a) && (a.kind === "natural_history" || a.kind === "registry"))
    ?? reusable.find((a) => a.active && near(a) && REUSE_KINDS.has(a.kind))
    ?? reusable.find((a) => a.active && REUSE_KINDS.has(a.kind))
    ?? reusable.find((a) => a.active) ?? reusable[0];
  if (reuse) steps.push({ id: "reuse", kind: "reuse", owner: "patient_group", nodes: [reuse.id, reuse.disease, d], needs_review: true, cite: reuse.cite,
    title: tr(l, `Ask whether ${reuse.nct} (${reuse.disease_name}) could include ${dn}`, `Preguntar si ${reuse.nct} (${reuse.disease_name}) podría incluir ${dn}`),
    detail: `${reuse.title}. ${reuse.needs_review.join(" ")}` });
  const bridge = people.find((c) => c.kind === "investigator" && c.bridges);
  if (bridge) steps.push({ id: "validate", kind: "validate", owner: "researcher", nodes: [bridge.id, d, ...bridge.diseases.filter((x) => nbIds.has(x.id)).map((x) => x.id)], needs_review: true, cite: bridge.cite,
    title: tr(l, `Ask ${bridge.name} to review the shared mechanism`, `Pedir a ${bridge.name} que revise el mecanismo compartido`),
    detail: tr(l, `${bridge.why} Concrete question: do the shared symptoms and variant effects justify a common outcome measure?`, `${bridge.why} Pregunta concreta: ¿los síntomas compartidos y el efecto de variante justifican un desenlace común?`) });
  const approvedNb = neighborApproved[0];
  if (approvedNb && lead && !treatments.some((t) => t.approved)) steps.push({ id: "repurpose", kind: "repurpose", owner: "clinician", nodes: [approvedNb.id, approvedNb.disease, d], needs_review: true,
    cite: cite(g, [...approvedNb.cite.edges, neighbors.find((n) => n.disease === approvedNb.disease)?.edge ?? lead.edge]),
    title: tr(l, `Ask a clinician whether ${approvedNb.name} makes biological sense for ${dn}`, `Preguntar a un clínico si ${approvedNb.name} tiene sentido biológico para ${dn}`),
    detail: tr(l, `It is approved for ${approvedNb.disease_name}${approvedNb.mechanism ? ` (${approvedNb.mechanism})` : ""}. This is a question for an expert, not a treatment recommendation.`,
                  `Está aprobado para ${approvedNb.disease_name}${approvedNb.mechanism ? ` (${approvedNb.mechanism})` : ""}. Es una pregunta para un experto, no una recomendación de tratamiento.`) });
  const sponsor = people.find((c) => c.kind === "sponsor" && c.bridges);
  if (sponsor) steps.push({ id: "fund", kind: "fund", owner: "funder", nodes: [d, ...sponsor.diseases.filter((x) => nbIds.has(x.id)).map((x) => x.id)], needs_review: false, cite: sponsor.cite,
    title: tr(l, `Ask ${sponsor.name} about a shared protocol`, `Preguntar a ${sponsor.name} por un protocolo compartido`),
    detail: tr(l, `${sponsor.name} already sponsors studies in ${sponsor.diseases.filter((x) => x.id === d || nbIds.has(x.id)).map((x) => x.name).join(" and ")}. A shared natural-history protocol could serve both communities.`,
                  `${sponsor.name} ya patrocina estudios en ${sponsor.diseases.filter((x) => x.id === d || nbIds.has(x.id)).map((x) => x.name).join(" y ")}. Un protocolo compartido de historia natural podría servir a ambas comunidades.`) });
  const myGaps = (A?.gaps ?? []).filter((x) => x.disease === d);
  const regGap = myGaps.find((x) => x.kind === "no_registry" || x.kind === "no_natural_history");
  const template = [...own, ...reusable].find((a) => a.kind === "registry" || a.kind === "natural_history");
  if (regGap && template) steps.push({ id: "fill-gap", kind: "fill_gap", owner: "patient_group", nodes: [template.id, d], needs_review: true, cite: template.cite,
    title: tr(l, `Close the ${regGap.kind === "no_registry" ? "registry" : "natural-history"} gap using ${template.nct} as a template`, `Cerrar el hueco de ${regGap.kind === "no_registry" ? "registro" : "historia natural"} usando ${template.nct} como plantilla`),
    detail: tr(l, `No ${regGap.kind === "no_registry" ? "patient registry" : "natural-history study"} specific to ${dn} is visible in our sources. ${template.title} shows which outcomes others already collect.`,
                  `En nuestras fuentes no hay un ${regGap.kind === "no_registry" ? "registro de pacientes" : "estudio de historia natural"} específico de ${dn}. ${template.title} muestra qué desenlaces ya recogen otros.`) });

  const rankOrder = STEP_ORDER[persona];
  const ranked = steps.filter((s) => s.cite.edges.length > 0) // rule: a step without evidence edges is not shown
    .sort((a, b) => rankOrder.indexOf(a.kind) - rankOrder.indexOf(b.kind));
  const thisWeek = ranked.slice(0, 4);
  const later = ranked.slice(4);

  /* ---------------- Gaps, unmet need, coverage ---------------- */
  const gaps = myGaps.map((x) => gapCard(x, dn, l));
  const unmet_need: UnmetNeedRow[] = [d, ...neighbors.map((n) => n.disease)].map((x) => {
    const tEdges = inOf(g, x).filter((e) => e.relation === "treats" && e.props.approved);
    const aEdges = assetEdges(x).filter((e) => e.props.asset_kind === "interventional_trial" && ACTIVE_STATUSES.has(String(g.byId.get(e.from)?.props.status)));
    const oEdges = inOf(g, x).filter((e) => e.relation === "supports" && g.byId.get(e.from)?.props.kind !== "umbrella");
    return { disease: x, name: name(x), approved: new Set(tEdges.map((e) => e.from)).size, active_trials: aEdges.length, patient_org: oEdges.length > 0,
      gaps: (A?.gaps ?? []).filter((y) => y.disease === x).map((y) => y.kind), cite: cite(g, [...tEdges, ...aEdges, ...oEdges].map((e) => e.id)) };
  }).sort((a, b) => a.approved - b.approved || a.active_trials - b.active_trials);

  const coverage = coverageFor(g, d);
  const checked = coverage.sources.map((s) => s.name).join(", ");

  const none_connections: NoneFound | null = neighbors.length ? null : {
    title: tr(l, "No supported connection found", "No encontramos una conexión respaldada"),
    detail: tr(l, `None of the ${coverage.counts.atlas_diseases} diseases in the atlas passes the similarity threshold with ${dn} (symptoms weighted by rarity, Reactome pathways, genes). Sources checked: ${checked}.`,
                  `Ninguna de las ${coverage.counts.atlas_diseases} enfermedades del atlas supera el umbral de similitud con ${dn} (síntomas ponderados por rareza, vías Reactome, genes). Fuentes revisadas: ${checked}.`),
    missing_evidence: [
      tr(l, `Only ${coverage.counts.symptoms} symptoms (HPO) are recorded for ${dn}; more well-described symptoms would change the comparison.`, `Solo hay ${coverage.counts.symptoms} síntomas (HPO) registrados para ${dn}; más síntomas bien descritos cambiarían la comparación.`),
      tr(l, "Pathway membership (Reactome) for the causal gene.", "Pertenencia a vías (Reactome) del gen causal."),
      tr(l, "More diseases in the atlas: the comparison is only as wide as the slice we ingested.", "Más enfermedades en el atlas: la comparación solo es tan amplia como el corte ingerido."),
    ],
    next_question: tr(l, "Which symptoms do your patients show that Orphanet does not list? Recording them (HPO terms) is the evidence that would change this answer.", "¿Qué síntomas tienen sus pacientes que Orphanet no recoge? Registrarlos (términos HPO) es la evidencia que cambiaría esta respuesta."),
  };
  const none_assets: NoneFound | null = own.length || reusable.length ? null : {
    title: tr(l, "No reusable study found", "No encontramos estudios reutilizables"),
    detail: tr(l, `ClinicalTrials.gov lists no study for ${dn} or its neighbors in our slice.`, `ClinicalTrials.gov no lista estudios de ${dn} ni de sus vecinas en nuestro corte.`),
    missing_evidence: [tr(l, "A registered natural-history study or registry (ClinicalTrials.gov).", "Un estudio de historia natural o registro inscrito (ClinicalTrials.gov).")],
    next_question: tr(l, "Does your organization keep patient data that could become a registry?", "¿Su organización guarda datos de pacientes que podrían convertirse en un registro?"),
  };
  const none_people: NoneFound | null = people.length ? null : {
    title: tr(l, "No collaborator found in our sources", "No encontramos colaboradores en nuestras fuentes"),
    detail: tr(l, `No patient group, NIH-funded researcher or study sponsor connected to ${dn} in ${checked}.`, `Ningún grupo de pacientes, investigador financiado por NIH ni patrocinador conectado a ${dn} en ${checked}.`),
    missing_evidence: [tr(l, "Patient organizations and funded projects naming this disease.", "Organizaciones de pacientes y proyectos financiados que nombren esta enfermedad.")],
    next_question: tr(l, "Who has published case reports on this disease? Their names are the first lead.", "¿Quién ha publicado casos de esta enfermedad? Sus nombres son la primera pista."),
  };
  const none_next: NoneFound | null = thisWeek.length ? null : {
    title: tr(l, "No evidence-backed next step yet", "Aún no hay un siguiente paso respaldado"),
    detail: tr(l, "We only propose steps we can back with edges in the graph. None qualifies for this disease today.", "Solo proponemos pasos que podemos respaldar con aristas del grafo. Hoy ninguno califica para esta enfermedad."),
    missing_evidence: [...(none_connections?.missing_evidence ?? []), ...(none_people?.missing_evidence ?? [])].slice(0, 3),
    next_question: none_connections?.next_question ?? tr(l, "What would your community most want to measure in a first study?", "¿Qué querría medir primero su comunidad en un estudio?"),
  };

  /* ---------------- Summary (progressive reveal: one line per question) ---------------- */
  const summary: JourneyV2["summary"] = {
    connections: lead
      ? { text: tr(l, `${dn} shares ${lead.shared.phenotypes.length} symptoms${lead.shared.pathways.length ? " and a pathway" : ""} with ${lead.name} · ${lead.strength.label}.`, `${dn} comparte ${lead.shared.phenotypes.length} síntomas${lead.shared.pathways.length ? " y una vía" : ""} con ${lead.name} · ${lead.strength.label}.`), cite: cite(g, [lead.edge]) }
      : { text: none_connections!.title, cite: cite(g, []) },
    assets: sharedOwn
      ? { text: tr(l, `${own.filter((a) => a.shared_with.length).length} studies already enroll ${dn} with a neighbor; ${reusable.length} more could be reused.`, `${own.filter((a) => a.shared_with.length).length} estudios ya incluyen ${dn} con una vecina; ${reusable.length} más podrían reutilizarse.`), cite: sharedOwn.cite }
      : reuse ? { text: tr(l, `${reusable.length} neighbor studies could be reused, starting with ${reuse.nct}.`, `${reusable.length} estudios de vecinas podrían reutilizarse, empezando por ${reuse.nct}.`), cite: reuse.cite }
      : own[0] ? { text: tr(l, `${own.length} studies on ${dn}; none from neighbors is reusable yet.`, `${own.length} estudios sobre ${dn}; ninguno de vecinas es reutilizable aún.`), cite: own[0].cite }
      : { text: none_assets!.title, cite: cite(g, []) },
    people: people[0]
      ? { text: `${people[0].name}: ${people[0].why}`, cite: people[0].cite }
      : { text: none_people!.title, cite: cite(g, []) },
    next: thisWeek[0]
      ? { text: tr(l, `${thisWeek.length} steps this week, starting with: ${thisWeek[0].title}.`, `${thisWeek.length} pasos esta semana, empezando por: ${thisWeek[0].title}.`), cite: thisWeek[0].cite }
      : { text: none_next!.title, cite: cite(g, []) },
  };

  const cluster = A?.clusters.find((c) => c.id === A.disease_cluster[d]) ?? null;

  /* ---------------- Patient plain view + Researcher mechanism view ---------------- */
  const causeEdges = inOf(g, d).filter((e) => e.relation === "causes").sort((a, b) => Number(!!b.props.primary) - Number(!!a.props.primary));
  const geneEdge = causeEdges[0];
  const gene = geneEdge ? g.byId.get(geneEdge.from) : undefined;
  const symbol = gene ? gene.name.split(" ")[0] : null;
  const phenEdges = outOf(g, d).filter((e) => e.relation === "has_phenotype")
    .sort((a, b) => freqRank(String(b.props.frequency ?? "")) - freqRank(String(a.props.frequency ?? "")) || Number(g.byId.get(b.to)?.props.ic ?? 0) - Number(g.byId.get(a.to)?.props.ic ?? 0));
  const signs: string[] = []; const signEdges: string[] = [];
  for (const e of phenEdges) {
    const w = plainSign(g.byId.get(e.to), l);
    if (w && !signs.includes(w)) { signs.push(w); signEdges.push(e.id); }
    if (signs.length === 4) break;
  }
  const ownGroups = inOf(g, d).filter((e) => e.relation === "supports" && g.byId.get(e.from)?.props.kind !== "umbrella");
  const recruiting = own.filter((a) => ["RECRUITING", "NOT_YET_RECRUITING", "ENROLLING_BY_INVITATION"].includes(a.status)).slice(0, 4);
  const plain: PlainView = {
    what_is_it: {
      text: tr(l,
        `${fullNameOf(disease, l)} is a rare condition${symbol ? ` caused by changes in the ${symbol} gene` : ""}.${signs.length ? ` Doctors record signs such as ${listOf(signs, l)}.` : ""} Every child is different — ask your care team what applies to yours.`,
        `${fullNameOf(disease, l)} es una condición rara${symbol ? ` causada por cambios en el gen ${symbol}` : ""}.${signs.length ? ` Los médicos registran signos como ${listOf(signs, l)}.` : ""} Cada niño es distinto — pregunta a tu equipo médico qué aplica al tuyo.`),
      signs, cite: cite(g, [...(geneEdge ? [geneEdge.id] : []), ...signEdges]),
    },
    people_like_you: { groups: ownGroups.map((e) => ({ id: e.from, name: g.byId.get(e.from)!.name, url: (g.byId.get(e.from)!.props.url as string | undefined) ?? null })), cite: cite(g, ownGroups.map((e) => e.id)) },
    research_now: { studies: recruiting.map((a) => ({ id: a.id, nct: a.nct, title: a.title, status: a.status, countries: a.countries, url: a.url })), cite: cite(g, recruiting.flatMap((a) => a.cite.edges.slice(0, 1))) },
    this_week: thisWeek.slice(0, 3),
  };
  const pwEdges = gene ? outOf(g, gene.id).filter((e) => e.relation === "participates_in") : [];
  const nbGenes = new Map(neighbors.map((n) => [n.disease, inOf(g, n.disease).filter((e) => e.relation === "causes").map((e) => e.from)]));
  const mechanism: MechanismView = {
    gene: gene && geneEdge ? { id: gene.id, symbol: symbol!, edge: geneEdge.id } : null,
    variant_effect: ve(d),
    variant_call: (A?.variant_effect[d]?.call as string | undefined) ?? null,
    pathways: pwEdges.map((e) => ({
      id: e.to, name: g.byId.get(e.to)?.name ?? e.to, edge: e.id,
      shared_with: neighbors.filter((n) => (nbGenes.get(n.disease) ?? []).some((gid) => outOf(g, gid).some((x) => x.relation === "participates_in" && x.to === e.to))).map((n) => ({ id: n.disease, name: n.name })),
    })).sort((a, b) => b.shared_with.length - a.shared_with.length).slice(0, 10),
    cluster_basis: cluster?.label_basis ?? null,
    cite: cite(g, [...(geneEdge ? [geneEdge.id] : []), ...(ve(d) ? [ve(d)!.edge] : []), ...pwEdges.slice(0, 10).map((e) => e.id)]),
  };

  return {
    version: 2, persona, locale: l,
    disease: { id: d, name: dn, full_name: fullNameOf(disease, l), canonical_id: disease.canonical_id, definition: (disease.props.definition as string | undefined) ?? null,
      orphanet_url: (disease.props.orphanet_url as string | undefined) ?? null, centrality: A?.centrality[d] ?? 0, variant_effect: ve(d) },
    cluster: cluster ? { id: cluster.id, label: cluster.label, label_basis: cluster.label_basis, color: cluster.color, members: cluster.diseases.map((x) => ({ id: x, name: name(x) })) } : null,
    order: ORDER[persona],
    summary,
    connections: { neighbors, counterexamples, none: none_connections },
    assets: { own: own.slice(0, 8), reusable, treatments: treatments.slice(0, 8), neighbor_approved: neighborApproved.slice(0, 4), none: none_assets },
    people: { collaborators: people, none: none_people },
    next: { steps: thisWeek, later, none: none_next },
    gaps, unmet_need, coverage,
    no_route: none_connections,
    disclaimer: DISCLAIMER[l],
    plain, mechanism,
  };
}

const FREQ = ["very rare", "occasional", "frequent", "very frequent", "obligate"];
function freqRank(f: string) { const x = f.toLowerCase(); for (let i = FREQ.length - 1; i >= 0; i--) if (x.startsWith(FREQ[i])) return i + 1; return 0; }

/**
 * A plain word for a symptom without inventing one: the broadest HPO ancestor that is still specific
 * (annotated in < 5,000 diseases), e.g. "Focal impaired awareness seizure" → "seizures".
 */
export function plainSign(p: { name: string; props: Record<string, unknown> } | undefined, l: Locale): string | null {
  if (!p) return null;
  // Skip HPO category nodes and lab / imaging findings: a parent should read signs they can see.
  const category = (n: string) => /^abnormal|^abnormality|morphology|physiology|^atypical|activity|concentration|\blevel\b|excretion|material|\brate\b|\b(mri|eeg|emg|csf|electroretinogram)\b|constitutional|^generalized abnormality/i.test(n);
  const own = { name: p.name, name_es: p.props.name_es as string | undefined, n: Number(p.props.annotated_diseases ?? 0) };
  // Broadest real symptom term (not an HPO "Abnormality of…" category) still annotated in < 5,000 diseases.
  const pick = [own, ...((p.props.ancestors as { name: string; name_es?: string; n: number }[] | undefined) ?? [])]
    .filter((a) => !category(a.name) && a.n < 5000).sort((a, b) => b.n - a.n)[0];
  if (!pick) return null;
  return (l === "es" ? pick.name_es ?? pick.name : pick.name).toLowerCase();
}
const listOf = (xs: string[], l: Locale) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${l === "es" ? "y" : "and"} ${xs[xs.length - 1]}`);

export function coverageFor(g: GraphIndex, d: string): Coverage {
  const touching = [...outOf(g, d), ...inOf(g, d)];
  const bySource = new Map<string, number>();
  for (const e of touching) for (const ev of e.evidence) bySource.set(ev.source, (bySource.get(ev.source) ?? 0) + 1);
  const disease = g.byId.get(d);
  const inE = inOf(g, d);
  return {
    sources: Object.values(g.snap.sources).filter((s): s is NonNullable<typeof s> => !!s).map((s) => ({ id: s.id, name: isAnalysisSource(s.id) ? ANALYSIS_LABEL.en : s.name, last_synced_at: s.last_synced_at, evidence_for_disease: bySource.get(s.id) ?? 0 })),
    counts: {
      symptoms: outOf(g, d).filter((e) => e.relation === "has_phenotype").length,
      studies: inE.filter((e) => e.relation === "studies" && g.byId.get(e.from)?.type === "trial").length,
      papers: inE.filter((e) => e.relation === "studies" && g.byId.get(e.from)?.type === "study").length,
      researchers: inE.filter((e) => e.relation === "researches" && g.byId.get(e.from)?.type === "investigator").length,
      treatments: inE.filter((e) => e.relation === "treats").length,
      pubmed_since_2019: Number(disease?.props.pubmed_total_since_2019 ?? 0),
      atlas_diseases: diseasesOf(g).length,
    },
  };
}

function gapCard(x: Gap, dn: string, l: Locale): GapCard {
  const T: Record<Gap["kind"], [string, string, string, string]> = {
    no_approved_treatment: [`No approved treatment for ${dn} in Open Targets.`, "A positive phase 3 trial, or an approved drug with the same mechanism in a neighbor disease.", `Sin tratamiento aprobado para ${dn} en Open Targets.`, "Un ensayo fase 3 positivo, o un fármaco aprobado del mismo mecanismo en una enfermedad vecina."],
    no_natural_history: [`No natural-history study for ${dn} in ClinicalTrials.gov.`, "A registered natural-history protocol, or joining a neighbor's.", `Sin estudio de historia natural de ${dn} en ClinicalTrials.gov.`, "Un protocolo de historia natural inscrito, o sumarse al de una vecina."],
    no_registry: [`No patient registry for ${dn} visible in our sources.`, "The patient organization publishing its registry or listing it on ClinicalTrials.gov.", `Sin registro de pacientes de ${dn} visible en nuestras fuentes.`, "Que la organización de pacientes publique su registro o lo inscriba en ClinicalTrials.gov."],
    no_nih_funding: [`No NIH-funded project names ${dn}.`, "A funded project in NIH RePORTER.", `Ningún proyecto financiado por NIH nombra ${dn}.`, "Un proyecto financiado en NIH RePORTER."],
    no_patient_group: [`No patient organization for ${dn} in our sources.`, "A patient organization listing this disease.", `Sin organización de pacientes para ${dn} en nuestras fuentes.`, "Una organización de pacientes que liste esta enfermedad."],
    few_phenotypes: [`Few symptoms are recorded for ${dn}.`, "More HPO-annotated symptoms (Orphanet / HPO).", `Hay pocos síntomas registrados para ${dn}.`, "Más síntomas anotados con HPO (Orphanet / HPO)."],
    no_active_trial: [`No active trial for ${dn}.`, "A recruiting study on ClinicalTrials.gov.", `Sin ensayo activo para ${dn}.`, "Un estudio reclutando en ClinicalTrials.gov."],
  };
  const t = T[x.kind];
  return t ? { kind: x.kind, title: l === "es" ? t[2] : t[0], what_would_change_it: l === "es" ? t[3] : t[1] } : { kind: x.kind, title: x.detail, what_would_change_it: x.what_would_change_it };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Informative = information content ≥ 0.4 (above the median of shared symptoms in the atlas). */
export const INFORMATIVE_IC = 0.4;

/**
 * Lead strength (UX_WAVE4 §3), deterministic and explainable:
 *   Strong   — shares a gene or a Reactome pathway AND ≥ 3 informative symptoms
 *   Possible — shares ≥ 5 informative symptoms
 *   Weak     — anything else
 */
export function leadStrength(shared: { pathways: unknown[]; genes: unknown[] }, phenotypes: { ic: number }[], l: Locale = "en"): NeighborCard["strength"] {
  const inf = phenotypes.filter((p) => p.ic >= INFORMATIVE_IC).length;
  const mech = shared.pathways.length > 0 || shared.genes.length > 0;
  const level: LeadStrength = mech && inf >= 3 ? "strong" : inf >= 5 ? "possible" : "weak";
  const label = { strong: tr(l, "Strong lead", "Pista fuerte"), possible: tr(l, "Possible lead", "Pista posible"), weak: tr(l, "Weak lead", "Pista débil") }[level];
  const basis = tr(l,
    `${inf} informative shared symptoms, ${shared.pathways.length} shared pathways, ${shared.genes.length} shared genes. Strong = gene or pathway + ≥3 informative symptoms; Possible = ≥5 informative symptoms; otherwise Weak.`,
    `${inf} síntomas informativos compartidos, ${shared.pathways.length} vías compartidas, ${shared.genes.length} genes compartidos. Fuerte = gen o vía + ≥3 síntomas informativos; Posible = ≥5 síntomas informativos; si no, Débil.`);
  return { level, label, basis, informative_symptoms: inf };
}
