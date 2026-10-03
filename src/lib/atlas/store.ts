/**
 * Lectura del grafo (data/atlas.json). Solo servidor. Todas las vistas devuelven ids de aristas y
 * evidencia: la UI y la narración nunca reciben una afirmación sin su fuente.
 */
import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AtlasSnapshot, Edge, Entity, EntityType, Evidence, SimilarityExplanation } from "./types";
import { loadFromSupabase } from "./source";

export type Locale = "en" | "es";

interface Index {
  snap: AtlasSnapshot;
  byId: Map<string, Entity>;
  edgeById: Map<string, Edge>;
  out: Map<string, Edge[]>;
  in: Map<string, Edge[]>;
  evidenceById: Map<string, Evidence>;
}

let cache: (Index & { source: "file" | "supabase" }) | null = null;
let loadedAt = 0;
const TTL_MS = 5 * 60_000;

function buildIndex(snap: AtlasSnapshot, source: "file" | "supabase") {
  const byId = new Map(snap.entities.map((e) => [e.id, e]));
  const edgeById = new Map(snap.edges.map((e) => [e.id, e]));
  const out = new Map<string, Edge[]>(); const inn = new Map<string, Edge[]>();
  const evidenceById = new Map<string, Evidence>();
  for (const e of snap.edges) {
    out.set(e.from, [...(out.get(e.from) ?? []), e]);
    inn.set(e.to, [...(inn.get(e.to) ?? []), e]);
    for (const ev of e.evidence) evidenceById.set(ev.id, ev);
  }
  return { snap, byId, edgeById, out, in: inn, evidenceById, source };
}

/**
 * Synchronous accessor used by every view. Returns the last loaded graph; if nothing was loaded yet,
 * falls back to the bundled snapshot (data/atlas.json) so the app always renders, even offline.
 */
export function atlas(): Index {
  if (cache) return cache;
  const snap = JSON.parse(readFileSync(join(process.cwd(), "data", "atlas.json"), "utf8")) as AtlasSnapshot;
  cache = buildIndex(snap, "file");
  return cache;
}

/**
 * Call once at the top of every server entry point (route handler / page) BEFORE using atlas().
 * Loads the live graph from Supabase (see ./source.ts) with a 5-minute cache; falls back to the file.
 */
export async function loadAtlas(): Promise<Index> {
  if (cache?.source === "supabase" && Date.now() - loadedAt < TTL_MS) return cache;
  const live = await loadFromSupabase().catch((e) => { console.error("[atlas] supabase load failed:", (e as Error).message); return null; });
  if (live && live.entities.length) { cache = buildIndex(live, "supabase"); loadedAt = Date.now(); return cache; }
  return atlas();
}

export const atlasSource = () => (cache ? cache.source : "file");

/** Nombre para mostrar y para la voz: corto si existe ("STXBP1-DEE"), en el idioma pedido. */
export const nameOf = (e: Entity | undefined, l: Locale) => {
  if (!e) return "";
  const p = e.props as Record<string, string | undefined>;
  return (l === "es" ? p.short_name_es ?? p.name_es : p.short_name) ?? (l === "es" ? p.name_es : undefined) ?? e.name;
};
/** Nombre completo (encabezados). */
export const fullNameOf = (e: Entity | undefined, l: Locale) => (e ? (l === "es" && typeof e.props.name_es === "string" ? e.props.name_es : e.name) : "");
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const edgesOf = (id: string) => [...(atlas().out.get(id) ?? []), ...(atlas().in.get(id) ?? [])];
const other = (e: Edge, id: string) => (e.from === id ? e.to : e.from);
const diseases = () => atlas().snap.entities.filter((e) => e.type === "disease");

/* ------------------------------------------------------------------ */
/* Búsqueda global con resolución de sinónimos                         */
/* ------------------------------------------------------------------ */
export interface SearchHit {
  id: string; type: EntityType; name: string; matched: string; via_synonym: boolean;
  disease: string | null;   // la enfermedad que abre el grafo
  sub: string;
}

const TYPE_RANK: Partial<Record<EntityType, number>> = { disease: 0, gene: 1, phenotype: 2, pathway: 3, organization: 4, treatment: 5, investigator: 6, trial: 7 };

export function search(q: string, l: Locale = "en", limit = 12): SearchHit[] {
  const nq = norm(q); if (nq.length < 2) return [];
  const { snap } = atlas();
  const hits: (SearchHit & { score: number })[] = [];
  for (const e of snap.entities) {
    if (!(e.type in TYPE_RANK)) continue;
    const names = [{ s: e.name, syn: false }, { s: e.canonical_id, syn: false }, ...(typeof e.props.name_es === "string" ? [{ s: e.props.name_es, syn: false }] : []), ...e.aliases.map((a) => ({ s: a.alias, syn: true }))];
    let best: { s: string; syn: boolean; score: number } | null = null;
    for (const n of names) {
      const nn = norm(n.s); if (!nn) continue;
      const score = nn === nq ? 0 : nn.startsWith(nq) ? 1 : nn.split(/[\s,()-]+/).some((w) => w.startsWith(nq)) ? 2 : nn.includes(nq) ? 3 : 9;
      if (score < 9 && (!best || score < best.score)) best = { ...n, score };
    }
    if (!best) continue;
    const disease = e.type === "disease" ? e.id : bestDiseaseFor(e.id);
    if (!disease) continue;
    hits.push({
      id: e.id, type: e.type, name: nameOf(e, l), matched: best.s, via_synonym: best.syn && norm(best.s) !== norm(e.name),
      disease, sub: subtitle(e, disease, l), score: best.score * 10 + (TYPE_RANK[e.type] ?? 9) + (e.type === "investigator" ? 5 : 0),
    });
  }
  return hits.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name)).slice(0, limit).map((h) => { const { score, ...rest } = h; void score; return rest; });
}

/** Para un gen, síntoma, vía u organización: la enfermedad del atlas más fuertemente conectada. */
function bestDiseaseFor(id: string): string | null {
  const { byId } = atlas();
  const direct = edgesOf(id).map((e) => ({ d: other(e, id), w: e.confidence })).filter((x) => byId.get(x.d)?.type === "disease");
  if (direct.length) return direct.sort((a, b) => b.w - a.w)[0].d;
  // vía -> gen -> enfermedad
  for (const e of edgesOf(id)) {
    const g = other(e, id);
    if (byId.get(g)?.type === "gene") { const d = edgesOf(g).find((x) => x.relation === "causes"); if (d) return d.to; }
  }
  return null;
}

function subtitle(e: Entity, disease: string, l: Locale) {
  const d = nameOf(atlas().byId.get(disease), l);
  const t: Record<string, [string, string]> = {
    disease: [String(e.canonical_id), String(e.canonical_id)], gene: [`gene · ${d}`, `gen · ${d}`], phenotype: [`symptom · ${d}`, `síntoma · ${d}`],
    pathway: [`mechanism · ${d}`, `mecanismo · ${d}`], organization: [`patient group · ${d}`, `grupo de pacientes · ${d}`],
    treatment: [`treatment · ${d}`, `tratamiento · ${d}`], investigator: [`researcher · ${d}`, `investigador · ${d}`], trial: [`study · ${d}`, `estudio · ${d}`],
  };
  return (t[e.type] ?? [e.type, e.type])[l === "es" ? 1 : 0];
}

/* ------------------------------------------------------------------ */
/* Vista del grafo                                                     */
/* ------------------------------------------------------------------ */
export interface GNode { id: string; type: EntityType; name: string; cluster: string | null; color: string | null; size: number; focus?: boolean; props?: Record<string, unknown>; /** links diseases of different mechanism clusters */ bridge?: boolean; /** community draft node (proposals layer) — never evidence */ draft?: boolean }
/** `proposed` = community draft (never evidence); added client-side by the proposals layer. */
export interface GLink { id: string; source: string; target: string; relation: string; kind: Edge["kind"] | "proposed"; confidence: number; label?: string; /** crosses two mechanism clusters */ bridge?: boolean }
export interface GraphView { focus: string; nodes: GNode[]; links: GLink[]; clusters: { id: string; label: string; color: string; diseases: string[] }[] }

export function graphView(focus: string, l: Locale): GraphView | null {
  const { byId, snap } = atlas();
  const fd = byId.get(focus); if (!fd || fd.type !== "disease") return null;
  const A = snap.analytics;
  const color = (d: string) => A?.clusters.find((c) => c.id === A.disease_cluster[d])?.color ?? null;
  const nodes = new Map<string, GNode>(); const links = new Map<string, GLink>();
  const addNode = (id: string, size = 4) => {
    const e = byId.get(id); if (!e || nodes.has(id)) return;
    nodes.set(id, { id, type: e.type, name: nameOf(e, l), cluster: e.type === "disease" ? A?.disease_cluster[id] ?? null : null, color: e.type === "disease" ? color(id) : null, size, focus: id === focus });
  };
  const addLink = (e: Edge, bridge = crossCluster(e)) => {
    if (!nodes.has(e.from) || !nodes.has(e.to)) return;
    links.set(e.id, { id: e.id, source: e.from, target: e.to, relation: e.relation, kind: e.kind, confidence: e.confidence, ...(bridge ? { bridge } : {}) });
  };

  // Todas las enfermedades del atlas (la constelación), con sus conexiones inferidas.
  for (const d of diseases()) addNode(d.id, 8 + (A?.centrality[d.id] ?? 0) / 14);
  for (const e of snap.edges.filter((x) => x.relation === "similar_to")) addLink(e);

  // El camino de mecanismo: enfermedad -> gen -> vía <- gen <- enfermedad vecina.
  const neighbors = neighborsOf(focus).slice(0, 4).map((n) => n.disease);
  for (const d of [focus, ...neighbors]) {
    for (const ge of (atlas().in.get(d) ?? []).filter((e) => e.relation === "causes" && e.props.primary)) {
      addNode(ge.from, d === focus ? 6 : 5); addLink(ge);
    }
  }
  const genes = [...nodes.values()].filter((n) => n.type === "gene").map((n) => n.id);
  const pathwayGenes = new Map<string, string[]>();
  for (const g of genes) for (const pe of (atlas().out.get(g) ?? []).filter((e) => e.relation === "participates_in")) pathwayGenes.set(pe.to, [...(pathwayGenes.get(pe.to) ?? []), g]);
  const focusGenes = new Set(genes.filter((g) => (atlas().out.get(g) ?? []).some((e) => e.relation === "causes" && e.to === focus)));
  let ownPathways = 0;
  for (const [p, gs] of pathwayGenes) {
    const shared = gs.length > 1; const own = gs.some((g) => focusGenes.has(g));
    if (shared || (own && ownPathways++ < 6)) {
      addNode(p, shared ? 5 : 3.5);
      for (const g of gs) { const e = (atlas().out.get(g) ?? []).find((x) => x.relation === "participates_in" && x.to === p); if (e) addLink(e); }
    }
  }
  // Síntomas: los más informativos de la enfermedad foco + los que comparte con sus vecinas.
  const phen = (atlas().out.get(focus) ?? []).filter((e) => e.relation === "has_phenotype")
    .sort((a, b) => b.confidence * Number(byId.get(b.to)?.props.ic ?? 0) - a.confidence * Number(byId.get(a.to)?.props.ic ?? 0));
  for (const e of phen.slice(0, 7)) { addNode(e.to, 3); addLink(e); }
  for (const n of neighbors) for (const e of (atlas().out.get(n) ?? []).filter((x) => x.relation === "has_phenotype" && nodes.has(x.to))) addLink(e);
  // Comunidad: grupos de pacientes de la enfermedad foco y de las vecinas.
  for (const d of [focus, ...neighbors]) for (const e of (atlas().in.get(d) ?? []).filter((x) => x.relation === "supports" || (x.relation === "researches" && byId.get(x.from)?.type === "organization"))) {
    if (byId.get(e.from)?.props.kind === "umbrella") continue;
    addNode(e.from, 4); addLink(e);
  }
  // Activos reutilizables: historia natural / registros / biomarcadores de foco y vecinas.
  for (const d of [focus, ...neighbors]) {
    const assets = (atlas().in.get(d) ?? []).filter((e) => e.relation === "studies" && ["natural_history", "registry", "biomarker_study"].includes(String(e.props.asset_kind)));
    for (const e of assets.slice(0, d === focus ? 3 : 2)) { addNode(e.from, 3.5); addLink(e); }
  }
  // Puentes: investigadores que ya trabajan en la foco y en una vecina.
  for (const b of (A?.bridges ?? []).filter((x) => x.kind === "investigator" && x.diseases.includes(focus) && x.diseases.some((d) => neighbors.includes(d))).slice(0, 4)) {
    addNode(b.entity, 3.5);
    const bn = nodes.get(b.entity);
    if (bn && b.cross_cluster) nodes.set(b.entity, { ...bn, bridge: true });
    for (const eid of b.edges) { const e = atlas().edgeById.get(eid); if (e) addLink(e, b.cross_cluster); }
  }
  return {
    focus, nodes: [...nodes.values()], links: [...links.values()],
    clusters: (A?.clusters ?? []).map((c) => ({ id: c.id, label: c.label, color: c.color, diseases: c.diseases })),
  };
}

/** A similarity edge between diseases of two different mechanism clusters: the bridges worth highlighting. */
function crossCluster(e: Edge) {
  const dc = atlas().snap.analytics?.disease_cluster;
  if (!dc || e.relation !== "similar_to") return false;
  return !!dc[e.from] && !!dc[e.to] && dc[e.from] !== dc[e.to];
}

/** Pantalla inicial: solo las enfermedades y sus conexiones inferidas (la constelación). */
export function constellation(l: Locale): GraphView {
  const { snap } = atlas(); const A = snap.analytics;
  return {
    focus: "",
    nodes: diseases().map((d) => ({ id: d.id, type: "disease" as const, name: nameOf(d, l), cluster: A?.disease_cluster[d.id] ?? null, color: A?.clusters.find((c) => c.id === A.disease_cluster[d.id])?.color ?? null, size: 8 + (A?.centrality[d.id] ?? 0) / 14 })),
    links: snap.edges.filter((e) => e.relation === "similar_to").map((e) => ({ id: e.id, source: e.from, target: e.to, relation: e.relation, kind: e.kind, confidence: e.confidence, ...(crossCluster(e) ? { bridge: true } : {}) })),
    clusters: (A?.clusters ?? []).map((c) => ({ id: c.id, label: c.label, color: c.color, diseases: c.diseases })),
  };
}

/* ------------------------------------------------------------------ */
/* Vecinas (¿quién comparte nuestras características?)                 */
/* ------------------------------------------------------------------ */
export interface Neighbor { disease: string; edge: string; score: number; explanation: SimilarityExplanation; same_cluster: boolean }

export function neighborsOf(d: string): Neighbor[] {
  const A = atlas().snap.analytics; if (!A) return [];
  return atlas().snap.edges.filter((e) => e.relation === "similar_to" && (e.from === d || e.to === d))
    .map((e) => ({ disease: other(e, d), edge: e.id, score: e.confidence, explanation: A.similarity[e.id], same_cluster: A.disease_cluster[e.from] === A.disease_cluster[e.to] }))
    .sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------------ */
/* Detalle de arista: explicar cada conexión                           */
/* ------------------------------------------------------------------ */
export function edgeDetail(edgeId: string, l: Locale) {
  const { edgeById, byId, snap } = atlas();
  const e = edgeById.get(edgeId); if (!e) return null;
  const from = byId.get(e.from)!, to = byId.get(e.to)!;
  const contradictions: { text: string; evidence: Evidence | null }[] = [];
  if (e.props.stopped) contradictions.push({ text: `${l === "es" ? "Estudio detenido" : "Study stopped"}${e.props.why_stopped ? `: ${e.props.why_stopped}` : ""}`, evidence: e.evidence[0] ?? null });
  for (const s of (e.props.stopped_reports as { id: string; why: string | null }[] | undefined) ?? []) contradictions.push({ text: `${s.id}: ${s.why ?? (l === "es" ? "detenido sin motivo publicado" : "stopped, no reason published")}`, evidence: e.evidence.find((x) => x.external_id === s.id) ?? null });
  if (e.relation === "causes") {
    const conflicts = Number(from.props.clinvar_conflicting_total ?? 0);
    if (conflicts) contradictions.push({ text: l === "es" ? `${conflicts} variantes de ${from.name} tienen interpretaciones en conflicto en ClinVar` : `${conflicts} ${from.name} variants have conflicting interpretations in ClinVar`, evidence: null });
  }
  if (from.props.site_verified === false) contradictions.push({ text: l === "es" ? "El sitio de la organización no respondió en la última ingesta" : "The organization's site did not respond at last ingest", evidence: null });
  return {
    edge: e, from: { ...from, display: nameOf(from, l) }, to: { ...to, display: nameOf(to, l) },
    similarity: e.relation === "similar_to" ? snap.analytics?.similarity[e.id] ?? null : null,
    contradictions,
  };
}

/* ------------------------------------------------------------------ */
/* El recorrido: conexión -> activo -> colaborador -> siguiente paso    */
/* ------------------------------------------------------------------ */
export interface Asset { id: string; edge: string; disease: string; kind: string; title: string; status: string; sponsor?: string; countries: string[]; own: boolean; differs: string[]; url: string; shared_with: string[] }
export interface Collaborator { id: string; name: string; kind: "patient_org" | "research_org" | "investigator" | "sponsor"; diseases: string[]; edges: string[]; why: string; url?: string; institution?: string }
export interface Step { id: string; title: string; detail: string; evidence_edges: string[]; nodes: string[]; kind: "connect" | "reuse" | "validate" | "fund" | "fill_gap" }

export function journey(d: string, l: Locale) {
  const { byId, snap } = atlas();
  const disease = byId.get(d); if (!disease || disease.type !== "disease") return null;
  const A = snap.analytics;
  const es = l === "es";
  const nb = neighborsOf(d);
  const lead = nb[0];
  const cluster = A?.clusters.find((c) => c.id === A.disease_cluster[d]) ?? null;

  // 1. ¿Quién comparte nuestras características?
  const shares = nb.map((n) => ({
    ...n, name: nameOf(byId.get(n.disease), l),
    variant_effect: { self: A?.variant_effect[d] ?? null, other: A?.variant_effect[n.disease] ?? null },
  }));
  const counterexamples = (A?.counterexamples ?? []).filter((c) => c.a === d || c.b === d).map((c) => ({ ...c, other: c.a === d ? c.b : c.a, other_name: nameOf(byId.get(c.a === d ? c.b : c.a), l) }));

  // 2. ¿Qué existe ya? Activos propios y de las vecinas (reutilizables), con lo que cambia entre enfermedades.
  const assetsFor = (dis: string, own: boolean): Asset[] => (atlas().in.get(dis) ?? [])
    .filter((e) => e.relation === "studies" && byId.get(e.from)?.type === "trial")
    .map((e) => {
      const t = byId.get(e.from)!; const p = t.props;
      const differs: string[] = [];
      if (!own) {
        differs.push(es ? `Elegibilidad escrita para ${nameOf(byId.get(dis), l)}: revisar si admite ${nameOf(disease, l)}` : `Eligibility written for ${nameOf(byId.get(dis), l)}: check whether it admits ${nameOf(disease, l)}`);
        const ve = A?.variant_effect[dis], vs = A?.variant_effect[d];
        if (ve && vs && (ve.lof_fraction >= 0.5) !== (vs.lof_fraction >= 0.5)) differs.push(es ? "Efecto de variante distinto: endpoints de mecanismo no son trasladables sin validación" : "Different variant effect: mechanism endpoints do not transfer without validation");
      }
      return { id: t.id, edge: e.id, disease: dis, kind: String(p.asset_kind ?? "interventional_trial"), title: t.name, status: String(p.status ?? ""), sponsor: p.sponsor as string | undefined, countries: (p.countries as string[]) ?? [], own, differs, url: e.evidence[0]?.url ?? "", shared_with: [] };
    });
  const KIND_ORDER = ["natural_history", "registry", "biomarker_study", "observational_cohort", "interventional_trial"];
  const ACTIVE = new Set(["RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING", "ENROLLING_BY_INVITATION"]);
  const rankAsset = (a: Asset) => KIND_ORDER.indexOf(a.kind) * 10 + (ACTIVE.has(a.status) ? 0 : a.status === "COMPLETED" ? 2 : 5);
  const ownAssets = assetsFor(d, true).sort((a, b) => rankAsset(a) - rankAsset(b));
  // Un estudio que ya incluye a la enfermedad foco y a una vecina es un activo YA compartido: se marca, no se repite.
  const ownIds = new Set(ownAssets.map((a) => a.id));
  for (const a of ownAssets) a.shared_with = nb.map((n) => n.disease).filter((x) => (atlas().in.get(x) ?? []).some((e) => e.relation === "studies" && e.from === a.id)).map((x) => nameOf(byId.get(x), l));
  const neighborAssets = nb.slice(0, 3).flatMap((n) => assetsFor(n.disease, false))
    .filter((a) => a.kind !== "interventional_trial" && !ownIds.has(a.id))
    .filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i)
    .sort((a, b) => rankAsset(a) - rankAsset(b));
  const treatments = (atlas().in.get(d) ?? []).filter((e) => e.relation === "treats").map((e) => ({ id: e.from, edge: e.id, name: byId.get(e.from)!.name, approved: !!e.props.approved, stage: String(e.props.stage ?? ""), mechanism: byId.get(e.from)!.props.mechanism as string | undefined, stopped: ((e.props.stopped_reports as unknown[]) ?? []).length > 0 }))
    .sort((a, b) => Number(b.approved) - Number(a.approved) || b.stage.localeCompare(a.stage));
  const neighborApproved = nb.slice(0, 3).flatMap((n) => (atlas().in.get(n.disease) ?? []).filter((e) => e.relation === "treats" && e.props.approved).map((e) => ({ id: e.from, edge: e.id, name: byId.get(e.from)!.name, disease: n.disease, disease_name: nameOf(byId.get(n.disease), l), mechanism: byId.get(e.from)!.props.mechanism as string | undefined })));

  // 3. ¿Quién puede ayudar?
  const collaborators: Collaborator[] = [];
  for (const dis of [d, ...nb.slice(0, 3).map((n) => n.disease)]) {
    for (const e of (atlas().in.get(dis) ?? []).filter((x) => (x.relation === "supports" || x.relation === "researches") && byId.get(x.from)?.type === "organization")) {
      const o = byId.get(e.from)!; if (o.props.kind === "umbrella" || collaborators.some((c) => c.id === o.id)) continue;
      collaborators.push({ id: o.id, name: o.name, kind: e.relation === "supports" ? "patient_org" : "research_org", diseases: [dis], edges: [e.id], url: o.props.url as string,
        why: dis === d ? (es ? "Comunidad de tu enfermedad" : "Your disease's community") : (es ? `Comunidad de ${nameOf(byId.get(dis), l)} (enfermedad vecina)` : `Community of ${nameOf(byId.get(dis), l)} (neighbor disease)`) });
    }
  }
  for (const b of (A?.bridges ?? []).filter((x) => x.diseases.includes(d) && x.kind !== "organization")) {
    const others = b.diseases.filter((x) => x !== d);
    if (!others.length) continue;
    const ent = byId.get(b.entity);
    collaborators.push({ id: b.entity, name: b.name, kind: b.kind === "investigator" ? "investigator" : "sponsor", diseases: b.diseases, edges: b.edges, institution: ent?.props.institution as string | undefined,
      why: es ? `Ya trabaja en ${nameOf(disease, l)} y en ${others.map((x) => nameOf(byId.get(x), l)).join(", ")}` : `Already works on ${nameOf(disease, l)} and ${others.map((x) => nameOf(byId.get(x), l)).join(", ")}` });
  }
  const nbIds = new Set(nb.map((n) => n.disease));
  collaborators.sort((a, b) => score(b) - score(a));
  function score(c: Collaborator) {
    // The disease's own patient groups always make the list (a family looks for them first), then bridges.
    const ownGroup = c.kind === "patient_org" && c.diseases.includes(d) ? 20 : 0;
    return ownGroup + (c.diseases.some((x) => nbIds.has(x)) && c.diseases.includes(d) ? 10 : 0) + (c.kind === "investigator" ? 3 : c.kind === "patient_org" ? 4 : 2) + c.diseases.length;
  }

  // 4. ¿Qué hacemos después? Pasos concretos, cada uno con sus aristas de evidencia.
  const steps: Step[] = [];
  const gaps = (A?.gaps ?? []).filter((g) => g.disease === d);
  if (lead) {
    const ln = nameOf(byId.get(lead.disease), l);
    const org = collaborators.find((c) => c.kind === "patient_org" && c.diseases.includes(lead.disease));
    steps.push({ id: "connect", kind: "connect", nodes: [d, lead.disease, ...(org ? [org.id] : [])], evidence_edges: [lead.edge, ...(org?.edges ?? [])],
      title: es ? `Contactar a la comunidad de ${ln}` : `Reach out to the ${ln} community`,
      detail: es ? `Comparten ${lead.explanation.shared_phenotypes.slice(0, 3).map((p) => p.name).join(", ")}${lead.explanation.shared_pathways.length ? ` y la vía ${lead.explanation.shared_pathways[0].name}` : ""}. ${org ? `${org.name} es su grupo de pacientes.` : ""} Lleven la explicación de esta conexión, que es inferida: debe revisarla un experto.`
                 : `You share ${lead.explanation.shared_phenotypes.slice(0, 3).map((p) => p.name).join(", ")}${lead.explanation.shared_pathways.length ? ` and the ${lead.explanation.shared_pathways[0].name} pathway` : ""}. ${org ? `${org.name} is their patient group.` : ""} Bring this connection's explanation — it is inferred and needs expert review.` });
  }
  const reusable = neighborAssets.find((a) => a.kind === "natural_history" || a.kind === "registry");
  if (reusable) steps.push({ id: "reuse", kind: "reuse", nodes: [reusable.id, reusable.disease, d], evidence_edges: [reusable.edge],
    title: es ? `Evaluar si ${reusable.kind === "registry" ? "su registro" : "su estudio de historia natural"} puede incluirlos` : `Assess whether their ${reusable.kind === "registry" ? "registry" : "natural history study"} can include you`,
    detail: `${reusable.title} (${reusable.edge && atlas().edgeById.get(reusable.edge)?.evidence[0]?.external_id}). ${reusable.differs.join(". ")}.` });
  const bridge = collaborators.find((c) => c.kind === "investigator" && c.diseases.some((x) => nbIds.has(x)));
  if (bridge) steps.push({ id: "validate", kind: "validate", nodes: [bridge.id, d, ...bridge.diseases.filter((x) => nbIds.has(x))], evidence_edges: bridge.edges,
    title: es ? `Pedir a ${bridge.name} que valide el mecanismo compartido` : `Ask ${bridge.name} to validate the shared mechanism`,
    detail: es ? `${bridge.why}${bridge.institution ? ` (${bridge.institution})` : ""}. Pregunta concreta: ¿el efecto de variante y la vía compartida justifican un endpoint común?` : `${bridge.why}${bridge.institution ? ` (${bridge.institution})` : ""}. Concrete question: do the variant effect and shared pathway justify a common endpoint?` });
  const approvedNb = neighborApproved[0];
  if (approvedNb && !treatments.some((t) => t.approved)) steps.push({ id: "repurpose", kind: "validate", nodes: [approvedNb.id, approvedNb.disease, d], evidence_edges: [approvedNb.edge, ...(lead ? [lead.edge] : [])],
    title: es ? `Preguntar si ${approvedNb.name} tiene sentido biológico para ${nameOf(disease, l)}` : `Ask whether ${approvedNb.name} makes biological sense for ${nameOf(disease, l)}`,
    detail: es ? `Está aprobado para ${approvedNb.disease_name}${approvedNb.mechanism ? ` (${approvedNb.mechanism})` : ""}. Es una hipótesis para un experto, no una recomendación de tratamiento.` : `It is approved for ${approvedNb.disease_name}${approvedNb.mechanism ? ` (${approvedNb.mechanism})` : ""}. A hypothesis for an expert, not a treatment recommendation.` });
  for (const g of gaps.filter((x) => ["no_natural_history", "no_registry"].includes(x.kind)).slice(0, 1)) steps.push({ id: `gap-${g.kind}`, kind: "fill_gap", nodes: [d], evidence_edges: [], title: es ? "Cerrar un hueco que nadie más va a cerrar" : "Close a gap nobody else will", detail: `${g.detail} ${g.what_would_change_it}` });

  // Cobertura de la búsqueda: lo que miramos, para que "no hay" signifique algo.
  const inE = atlas().in.get(d) ?? [];
  const coverage = {
    sources: Object.values(snap.sources).map((s) => ({ id: s!.id, name: s!.name, last_synced_at: s!.last_synced_at })),
    counts: {
      phenotypes: (atlas().out.get(d) ?? []).filter((e) => e.relation === "has_phenotype").length,
      studies: inE.filter((e) => e.relation === "studies" && byId.get(e.from)?.type === "trial").length,
      papers: inE.filter((e) => e.relation === "studies" && byId.get(e.from)?.type === "study").length,
      pubmed_total_since_2019: Number(disease.props.pubmed_total_since_2019 ?? 0),
      nih_projects: Number(disease.props.nih_projects ?? 0),
      treatments: treatments.length,
      atlas_diseases: diseases().length,
    },
    opentargets_indexed: disease.props.opentargets_indexed !== false,
  };
  const honest_gap = !lead ? {
    title: es ? "No encontramos una conexión respaldada" : "No supported connection found",
    detail: es ? `Entre las ${coverage.counts.atlas_diseases} enfermedades del atlas ninguna supera el umbral de similitud con ${nameOf(disease, l)}.` : `None of the ${coverage.counts.atlas_diseases} atlas diseases passes the similarity threshold with ${nameOf(disease, l)}.`,
    next_question: es ? "¿Qué fenotipos observan en sus pacientes que no están en Orphanet? Registrarlos (HPO) es la evidencia que cambiaría esta respuesta." : "Which phenotypes do your patients show that Orphanet does not list? Recording them (HPO) is the evidence that would change this answer.",
  } : null;

  return {
    disease: { id: d, name: nameOf(disease, l), full_name: fullNameOf(disease, l), canonical_id: disease.canonical_id, definition: disease.props.definition as string | undefined, prevalence: disease.props.prevalence, centrality: A?.centrality[d] ?? 0, variant_effect: A?.variant_effect[d] ?? null, orphanet_url: disease.props.orphanet_url as string | undefined },
    cluster: cluster ? { id: cluster.id, label: cluster.label, label_basis: cluster.label_basis, color: cluster.color, members: cluster.diseases.map((x) => ({ id: x, name: nameOf(byId.get(x), l) })), shared_pathways: cluster.shared_pathways, shared_phenotypes: cluster.shared_phenotypes } : null,
    shares, counterexamples,
    assets: { own: ownAssets.slice(0, 8), reusable: neighborAssets.slice(0, 6), treatments: treatments.slice(0, 8), neighbor_approved: neighborApproved.slice(0, 4) },
    collaborators: collaborators.slice(0, 8),
    steps, gaps, coverage, honest_gap,
  };
}

export type Journey = NonNullable<ReturnType<typeof journey>>;

/** Todas las enfermedades (para el selector inicial y la página de inicio). */
export function diseaseList(l: Locale) {
  const A = atlas().snap.analytics;
  return diseases().map((d) => ({ id: d.id, name: nameOf(d, l), cluster: A?.disease_cluster[d.id] ?? null, color: A?.clusters.find((c) => c.id === A.disease_cluster[d.id])?.color ?? null, centrality: A?.centrality[d.id] ?? 0 }))
    .sort((a, b) => b.centrality - a.centrality);
}

export function stats() {
  const { snap } = atlas();
  const count = (t: EntityType) => snap.entities.filter((e) => e.type === t).length;
  return {
    generated_at: snap.generated_at, diseases: count("disease"), genes: count("gene"), phenotypes: count("phenotype"), pathways: count("pathway"),
    studies: count("trial"), papers: count("study"), investigators: count("investigator"), organizations: count("organization"), treatments: count("treatment"),
    edges: snap.edges.length, evidence: snap.edges.reduce((s, e) => s + e.evidence.length, 0),
    inferred: snap.edges.filter((e) => e.kind === "inferred").length, clusters: snap.analytics?.clusters.length ?? 0,
    sources: Object.keys(snap.sources).length,
  };
}
