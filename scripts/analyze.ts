/**
 * Análisis del grafo (Módulo 3 del reto). Lee data/atlas.json y añade:
 *   - IC por fenotipo (qué tan informativo es: "convulsión" pesa poco, un signo raro pesa mucho)
 *   - Efecto de variante por gen (truncante vs. de sentido erróneo) a partir de Orphanet + ClinVar
 *   - Similitud enfermedad-enfermedad por fenotipo + mecanismo (Reactome) + gen, con su explicación
 *   - Aristas `similar_to` de tipo INFERIDO: nunca se presentan como observadas
 *   - Clusters por Louvain sobre esa similitud, nombrados por el mecanismo dominante
 *   - Centralidad, puentes (investigadores/organizaciones/patrocinadores compartidos), huecos y contraejemplos
 * Determinista: misma entrada -> misma salida.
 *
 *   npm run analyze
 */
import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import { FileGraph, shortHash } from "./ingest/graph";
import type { Analytics, Bridge, Cluster, Edge, Evidence, Gap, SimilarityExplanation } from "../src/lib/atlas/types";

const W = { phenotype: 0.55, pathway: 0.35, gene: 0.10 } as const;
const MIN_EDGE = 0.06;       // por debajo no se dibuja la conexión (los scores simGIC son bajos en valor absoluto)
const TOP_K = 3;             // vecinos máximos por enfermedad
const PALETTE = ["#0f766e", "#b45309", "#4f46e5", "#be185d", "#0369a1", "#65a30d"];
const ACTIVE = new Set(["RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING", "ENROLLING_BY_INVITATION"]);
const TRUNCATING = /frameshift|nonsense|stop[ _]gained|splice[ _](donor|acceptor)|start[ _]lost|initiator codon/i;
const MISSENSE = /missense/i;

const g = new FileGraph("data/atlas.json");
g.dropEdges((e) => e.kind === "inferred");
const entities = new Map(g.allEntities().map((e) => [e.id, e]));
const edges = g.allEdges();
const diseases = g.allEntities().filter((e) => e.type === "disease").sort((a, b) => a.id.localeCompare(b.id));
const out = (rel: string, from: string) => edges.filter((e) => e.relation === rel && e.from === from);
const into = (rel: string, to: string) => edges.filter((e) => e.relation === rel && e.to === to);

/* 1. IC de fenotipos y de sus ancestros HPO -------------------------- */
interface Ancestor { id: string; name: string; name_es?: string; n: number | null }
const totalHpo = Math.max(0, ...g.allEntities().filter((e) => e.type === "phenotype").map((e) => Number(e.props.hpo_total_diseases ?? 0)));
const icFromCount = (n: number | null | undefined) => (n && n > 0 && totalHpo > 0 ? -Math.log(n / totalHpo) / Math.log(totalHpo) : null);
const icOf = new Map<string, number>();
const termName = new Map<string, { name: string; name_es?: string }>();
for (const p of g.allEntities().filter((e) => e.type === "phenotype")) {
  // IC normalizado a 0..1: -ln(n/N)/ln(N). Sin dato de HPO se usa la frecuencia dentro del atlas (marcado).
  const inAtlas = edges.filter((e) => e.relation === "has_phenotype" && e.to === p.id).length;
  const fromHpo = icFromCount(Number(p.props.annotated_diseases ?? 0));
  const ic = fromHpo ?? 1 - inAtlas / Math.max(1, diseases.length);
  icOf.set(p.id, round(ic));
  termName.set(p.id, { name: p.name, name_es: p.props.name_es as string | undefined });
  p.props.ic = round(ic);
  p.props.ic_basis = fromHpo !== null ? "hpo_annotations" : "atlas_frequency";
  for (const a of (p.props.ancestors as Ancestor[] | undefined) ?? []) {
    const aic = icFromCount(a.n);
    if (aic !== null) icOf.set(`phenotype:${a.id}`, round(aic));
    termName.set(`phenotype:${a.id}`, { name: a.name, name_es: a.name_es });
  }
}
// Ancestros con IC muy bajo (casi toda enfermedad los tiene) no aportan señal.
const MIN_ANCESTOR_IC = 0.25;

/* 2. Perfil de cada enfermedad -------------------------------------- */
interface Profile { phen: Map<string, number>; direct: Set<string>; genes: Set<string>; primary: string[]; leaf: Set<string>; top: Set<string>; phenEdges: Map<string, Edge>; pathEdges: Map<string, Edge[]>; via: Map<string, string> }
const profiles = new Map<string, Profile>();
for (const d of diseases) {
  const phenEdges = new Map(out("has_phenotype", d.id).map((e) => [e.to, e]));
  // simGIC: cada fenotipo aporta su IC y el de sus ancestros (cerradura hacia arriba), ponderado por la frecuencia.
  const phen = new Map<string, number>(); const via = new Map<string, string>();
  for (const [pid, e] of phenEdges) {
    const add = (term: string, w: number) => { if (w > (phen.get(term) ?? 0)) { phen.set(term, w); if (term !== pid) via.set(term, pid); } };
    add(pid, e.confidence * (icOf.get(pid) ?? 0.5));
    for (const a of (entities.get(pid)?.props.ancestors as Ancestor[] | undefined) ?? []) {
      const ic = icOf.get(`phenotype:${a.id}`);
      if (ic !== undefined && ic >= MIN_ANCESTOR_IC) add(`phenotype:${a.id}`, e.confidence * ic);
    }
  }
  const causal = into("causes", d.id).filter((e) => e.confidence >= 0.9);
  const genes = new Set(into("causes", d.id).map((e) => e.from));
  const primary = causal.filter((e) => e.props.primary).map((e) => e.from);
  const leaf = new Set<string>(); const top = new Set<string>(); const pathEdges = new Map<string, Edge[]>();
  for (const ge of causal) for (const pe of out("participates_in", ge.from)) {
    leaf.add(pe.to);
    const t = String(entities.get(pe.to)?.props.top_level ?? ""); if (t) top.add(t);
    pathEdges.set(pe.to, [...(pathEdges.get(pe.to) ?? []), pe]);
  }
  profiles.set(d.id, { phen, direct: new Set(phenEdges.keys()), genes, primary: primary.length ? primary : causal.map((e) => e.from), leaf, top, phenEdges, pathEdges, via });
}

/* 3. Efecto de variante POR ENFERMEDAD ------------------------------ */
// Conteo completo de ClinVar (P/LP del gen para ESA enfermedad). Respaldo: muestra de variantes del gen.
const variantEffect: Analytics["variant_effect"] = {};
for (const d of diseases) {
  const causal = into("causes", d.id).filter((e) => e.props.primary);
  const ce = causal.find((e) => e.props.variant_counts) ?? causal[0];
  if (!ce) continue;
  const vc = ce.props.variant_counts as { total: number; missense: number; truncating: number } | undefined;
  const declared = ce.props.variant_effect as string | undefined;
  let n = 0, lofF = 0, misF = 0, basis = "";
  if (vc?.total) { n = vc.total; lofF = vc.truncating / n; misF = vc.missense / n; basis = "conteo ClinVar para esta enfermedad"; }
  else {
    const vs = out("has_variant", ce.from).map((e) => entities.get(e.to)?.props.consequences as string[] | undefined).filter((c): c is string[] => !!c?.length);
    n = vs.length; basis = "muestra de variantes del gen";
    lofF = n ? vs.filter((c) => c.some((x) => TRUNCATING.test(x))).length / n : 0;
    misF = n ? vs.filter((c) => c.some((x) => MISSENSE.test(x)) && !c.some((x) => TRUNCATING.test(x))).length / n : 0;
  }
  if (!n && !declared) continue;
  const gene = entities.get(ce.from)?.name ?? ce.from;
  const call = declared === "loss_of_function" ? "pérdida de función (declarada por Orphanet)"
    : declared === "gain_of_function" ? "ganancia de función (declarada por Orphanet)"
    : lofF >= 0.5 ? "predominan variantes truncantes → pérdida de función probable"
    : misF >= 0.6 ? "predominan variantes de sentido erróneo → el mecanismo puede ser distinto a la pérdida de función (ganancia o dominante negativo); requiere validación funcional"
    : "mezcla de variantes truncantes y de sentido erróneo → mecanismo no concluyente";
  variantEffect[d.id] = { gene, lof_fraction: round(lofF), missense_fraction: round(misF), n, call, basis, edge: ce.id };
  d.props.variant_effect = variantEffect[d.id];
}
const effectClass = (diseaseId: string) => {
  const v = variantEffect[diseaseId]; if (!v) return null;
  return v.lof_fraction >= 0.5 ? "lof" : v.missense_fraction >= 0.6 ? "missense" : "mixed";
};

/* 4. Similitud entre pares ------------------------------------------ */
const pairs: { a: string; b: string; s: SimilarityExplanation }[] = [];
for (let i = 0; i < diseases.length; i++) for (let j = i + 1; j < diseases.length; j++) {
  const A = profiles.get(diseases[i].id)!, B = profiles.get(diseases[j].id)!;
  let num = 0, den = 0;
  const shared: { id: string; name: string; ic: number; w: number }[] = [];
  for (const p of new Set([...A.phen.keys(), ...B.phen.keys()])) {
    const a = A.phen.get(p) ?? 0, b = B.phen.get(p) ?? 0;
    num += Math.min(a, b); den += Math.max(a, b);
    if (a && b) shared.push({ id: p, name: termName.get(p)?.name ?? p, ic: icOf.get(p) ?? 0, w: Math.min(a, b) });
  }
  // Para explicar, preferimos términos informativos que no sean ancestros de otro término compartido ya listado.
  shared.sort((x, y) => y.ic - x.ic);
  const sPh = den ? num / den : 0;
  const leafShared = [...A.leaf].filter((x) => B.leaf.has(x));
  const jLeaf = A.leaf.size + B.leaf.size ? leafShared.length / new Set([...A.leaf, ...B.leaf]).size : 0;
  const jTop = A.top.size + B.top.size ? [...A.top].filter((x) => B.top.has(x)).length / new Set([...A.top, ...B.top]).size : 0;
  const sPw = 0.7 * jLeaf + 0.3 * jTop;
  const sharedGenes = [...A.genes].filter((x) => B.genes.has(x));
  const score = W.phenotype * sPh + W.pathway * sPw + W.gene * (sharedGenes.length ? 1 : 0);
  const ea = effectClass(diseases[i].id), eb = effectClass(diseases[j].id);
  const topShared = shared.slice(0, 8);
  // La arista observada que sostiene un término compartido es la del fenotipo directo (o el descendiente por el que llegó).
  const edgeFor = (P: Profile, term: string) => P.phenEdges.get(term)?.id ?? P.phenEdges.get(P.via.get(term) ?? "")?.id;
  const supporting = [
    ...topShared.slice(0, 4).flatMap((p) => [edgeFor(A, p.id), edgeFor(B, p.id)]),
    ...leafShared.slice(0, 3).flatMap((p) => [...(A.pathEdges.get(p) ?? []), ...(B.pathEdges.get(p) ?? [])].map((e) => e.id)),
    ...sharedGenes.flatMap((gid) => [...into("causes", diseases[i].id), ...into("causes", diseases[j].id)].filter((e) => e.from === gid).map((e) => e.id)),
  ].filter((x): x is string => !!x);
  pairs.push({
    a: diseases[i].id, b: diseases[j].id,
    s: {
      score: round(score), phenotype_score: round(sPh), pathway_score: round(sPw),
      variant_effect_match: ea && eb ? ea === eb : null,
      shared_phenotypes: topShared.map(({ id, name, ic }) => ({ id, name, ic })),
      shared_pathways: leafShared.slice(0, 6).map((id) => ({ id, name: entities.get(id)?.name ?? id })),
      shared_genes: sharedGenes.map((x) => entities.get(x)?.name ?? x),
      supporting_edges: [...new Set(supporting)],
    },
  });
}

/* 5. Aristas inferidas similar_to (top-K por enfermedad) ------------ */
const keep = new Set<string>();
for (const d of diseases) {
  pairs.filter((p) => (p.a === d.id || p.b === d.id) && p.s.score >= MIN_EDGE)
    .sort((x, y) => y.s.score - x.s.score).slice(0, TOP_K)
    .forEach((p) => keep.add(`${p.a}|${p.b}`));
}
const similarity: Analytics["similarity"] = {};
let inferredCount = 0;
const byEdgeId = new Map(edges.map((e) => [e.id, e]));
for (const p of pairs.filter((x) => keep.has(`${x.a}|${x.b}`))) {
  const id = `edge:${shortHash(`${p.a}|similar_to|${p.b}`)}`;
  const supportEv: Evidence[] = p.s.supporting_edges.flatMap((eid) => byEdgeId.get(eid)?.evidence.slice(0, 1) ?? []);
  const why = [
    p.s.shared_phenotypes.length ? `${p.s.shared_phenotypes.length}+ fenotipos compartidos (más informativos: ${p.s.shared_phenotypes.slice(0, 3).map((x) => x.name).join(", ")})` : null,
    p.s.shared_pathways.length ? `vías Reactome compartidas: ${p.s.shared_pathways.slice(0, 2).map((x) => x.name).join("; ")}` : null,
    p.s.shared_genes.length ? `genes compartidos: ${p.s.shared_genes.join(", ")}` : null,
  ].filter(Boolean).join(" · ");
  const edge: Edge = {
    id, from: p.a, to: p.b, relation: "similar_to", kind: "inferred",
    confidence: p.s.score, confidence_basis: "atlas_similarity_v1",
    props: { phenotype_score: p.s.phenotype_score, pathway_score: p.s.pathway_score, variant_effect_match: p.s.variant_effect_match },
    evidence: [
      { id: `ev:${shortHash(`${id}|analysis`)}`, source: "atlas_analysis", external_id: "similarity_v1", url: "https://github.com/perdomoangelrangel-tech/7th-Hack-Nation-Global-AI-Hackathon-proyect/blob/main/scripts/analyze.ts", quote: `Inferido (score ${p.s.score}): ${why}`, published_on: null, retrieved_at: new Date().toISOString() },
      ...dedupe(supportEv),
    ],
  };
  g.putEdge(edge);
  inferredCount++;
  similarity[id] = p.s;
}

/* 6. Clusters (Louvain determinista) -------------------------------- */
const G = new Graph({ type: "undirected" });
for (const d of diseases) G.addNode(d.id);
for (const p of pairs) if (p.s.score >= MIN_EDGE * 0.8) G.addEdge(p.a, p.b, { weight: p.s.score });
const communities = louvain(G, { getEdgeWeight: "weight", resolution: 1, rng: seeded(7) }) as Record<string, number>;
const groups = new Map<number, string[]>();
for (const [node, c] of Object.entries(communities)) groups.set(c, [...(groups.get(c) ?? []), node]);

const clusters: Cluster[] = [...groups.values()]
  .sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]))
  .map((members, i) => {
    const pathCount = new Map<string, number>(); const phenCount = new Map<string, number>();
    for (const m of members) {
      for (const p of profiles.get(m)!.leaf) pathCount.set(p, (pathCount.get(p) ?? 0) + 1);
      for (const p of profiles.get(m)!.phen.keys()) phenCount.set(p, (phenCount.get(p) ?? 0) + 1);
    }
    const outside = diseases.filter((d) => !members.includes(d.id));
    const specificity = (p: string, kind: "leaf" | "phen") => outside.filter((d) => kind === "leaf" ? profiles.get(d.id)!.leaf.has(p) : profiles.get(d.id)!.phen.has(p)).length / Math.max(1, outside.length);
    const shared_pathways = [...pathCount].filter(([, n]) => n >= Math.min(2, members.length))
      .map(([id, n]) => ({ id, name: entities.get(id)?.name ?? id, diseases: n, spec: n / members.length - specificity(id, "leaf") }))
      .sort((a, b) => b.spec - a.spec || b.diseases - a.diseases).slice(0, 6);
    const shared_phenotypes = [...phenCount].filter(([, n]) => n >= Math.min(2, members.length))
      .map(([id, n]) => ({ id, name: termName.get(id)?.name ?? id, ic: icOf.get(id) ?? 0, diseases: n, spec: (n / members.length - specificity(id, "phen")) * (icOf.get(id) ?? 0.5) }))
      .sort((a, b) => b.spec - a.spec).slice(0, 8);
    const label = shared_pathways[0]?.spec > 0 ? shared_pathways[0].name : shared_phenotypes[0]?.name ?? entities.get(members[0])?.name ?? "Cluster";
    return {
      id: `cluster:${i + 1}`, label, color: PALETTE[i % PALETTE.length],
      label_basis: shared_pathways[0]?.spec > 0 ? "vía Reactome más específica del grupo" : "fenotipo más informativo y específico del grupo",
      diseases: members.sort(),
      shared_pathways: shared_pathways.map(({ id, name, diseases }) => ({ id, name, diseases })),
      shared_phenotypes: shared_phenotypes.map(({ id, name, ic, diseases }) => ({ id, name, ic, diseases })),
    };
  });
const diseaseCluster: Record<string, string> = {};
for (const c of clusters) for (const d of c.diseases) diseaseCluster[d] = c.id;

/* 7. Centralidad (grado ponderado en el grafo de similitud, 0..100) - */
const strength = new Map(diseases.map((d) => [d.id, pairs.filter((p) => p.a === d.id || p.b === d.id).reduce((s, p) => s + p.s.score, 0)]));
const maxS = Math.max(...strength.values(), 1e-9);
const centrality = Object.fromEntries([...strength].map(([k, v]) => [k, Math.round((100 * v) / maxS)]));

/* 8. Puentes: quién ya conecta comunidades -------------------------- */
const bridges: Bridge[] = [];
const pushBridge = (entity: string, name: string, kind: Bridge["kind"], ds: string[], es: string[]) => {
  const uniq = [...new Set(ds)]; if (uniq.length < 2) return;
  const cl = [...new Set(uniq.map((d) => diseaseCluster[d]))];
  bridges.push({ entity, name, kind, diseases: uniq, clusters: cl, cross_cluster: cl.length > 1, edges: es });
};
for (const inv of g.allEntities().filter((e) => e.type === "investigator")) {
  const es = edges.filter((e) => e.relation === "researches" && e.from === inv.id);
  pushBridge(inv.id, inv.name, "investigator", es.map((e) => e.to), es.map((e) => e.id));
}
for (const org of g.allEntities().filter((e) => e.type === "organization" && e.props.kind !== "umbrella")) {
  const es = edges.filter((e) => (e.relation === "researches" || e.relation === "supports") && e.from === org.id);
  pushBridge(org.id, org.name, "organization", es.map((e) => e.to), es.map((e) => e.id));
}
const sponsors = new Map<string, { ds: string[]; es: string[] }>();
for (const e of edges.filter((x) => x.relation === "studies" && entities.get(x.from)?.type === "trial")) {
  const t = entities.get(e.from)!;
  for (const s of [t.props.sponsor, ...((t.props.collaborators as string[]) ?? [])].filter(Boolean) as string[]) {
    const v = sponsors.get(s) ?? { ds: [], es: [] }; v.ds.push(e.to); v.es.push(e.id); sponsors.set(s, v);
  }
}
for (const [s, v] of sponsors) pushBridge(`sponsor:${s}`, s, "sponsor", v.ds, v.es);
bridges.sort((a, b) => Number(b.cross_cluster) - Number(a.cross_cluster) || b.diseases.length - a.diseases.length || a.name.localeCompare(b.name));

/* 9. Huecos: lo que falta, y qué lo cambiaría ----------------------- */
const gaps: Gap[] = [];
for (const d of diseases) {
  const trials = into("studies", d.id).filter((e) => entities.get(e.from)?.type === "trial").map((e) => entities.get(e.from)!);
  const treats = into("treats", d.id);
  const name = d.name;
  if (!treats.some((e) => e.props.approved)) gaps.push({ disease: d.id, kind: "no_approved_treatment", detail: `Open Targets no registra un fármaco aprobado para ${name} (${treats.length} candidato(s) en desarrollo).`, what_would_change_it: "Un ensayo fase 3 positivo o un fármaco del mismo mecanismo aprobado en una enfermedad vecina del cluster." });
  if (!trials.some((t) => t.props.asset_kind === "natural_history")) gaps.push({ disease: d.id, kind: "no_natural_history", detail: `No encontramos en ClinicalTrials.gov un estudio de historia natural para ${name}.`, what_would_change_it: "Registrar uno, o sumarse al de una enfermedad vecina con fenotipo compartido (ver cluster)." });
  if (!trials.some((t) => t.props.asset_kind === "registry") && !g.allEntities().some((o) => o.type === "organization" && o.props.registry && edges.some((e) => e.from === o.id && e.to === d.id))) gaps.push({ disease: d.id, kind: "no_registry", detail: `No hay un registro de pacientes de ${name} visible en nuestras fuentes.`, what_would_change_it: "Que la organización de pacientes publique su registro o lo inscriba en ClinicalTrials.gov." });
  if (!trials.some((t) => ACTIVE.has(String(t.props.status)))) gaps.push({ disease: d.id, kind: "no_active_trial", detail: `Ningún estudio activo o reclutando para ${name} en ClinicalTrials.gov.`, what_would_change_it: "Diseños de estudio reutilizables de enfermedades del mismo cluster." });
  if (!Number(d.props.nih_projects ?? 0)) gaps.push({ disease: d.id, kind: "no_nih_funding", detail: `NIH RePORTER no muestra proyectos financiados recientes que mencionen ${name}.`, what_would_change_it: "Una solicitud conjunta con investigadores ya financiados en el mismo mecanismo (ver puentes)." });
  if (!into("supports", d.id).some((e) => entities.get(e.from)?.props.kind === "patient_org")) gaps.push({ disease: d.id, kind: "no_patient_group", detail: `No tenemos un grupo de pacientes específico verificado para ${name}.`, what_would_change_it: "Conectar con el grupo de la enfermedad vecina más cercana y crear uno propio." });
  if ((profiles.get(d.id)?.phen.size ?? 0) < 5) gaps.push({ disease: d.id, kind: "few_phenotypes", detail: `Orphanet anota pocos fenotipos para ${name}; la similitud fenotípica es poco fiable.`, what_would_change_it: "Datos de historia natural o de registro con fenotipos HPO." });
}

/* 10. Contraejemplos: mismos síntomas, distinto mecanismo ------------ */
const phenMedian = median(pairs.map((p) => p.s.phenotype_score));
const counterexamples = pairs
  .filter((p) => p.s.phenotype_score >= phenMedian && p.s.pathway_score === 0 && diseaseCluster[p.a] !== diseaseCluster[p.b])
  .sort((x, y) => y.s.phenotype_score - x.s.phenotype_score).slice(0, 4)
  .map((p) => ({ a: p.a, b: p.b, shared_phenotypes: p.s.shared_phenotypes.slice(0, 4).map((x) => x.name),
    why: `Comparten síntomas (similitud fenotípica ${p.s.phenotype_score}) pero ninguna vía Reactome: probablemente requieren estrategias terapéuticas distintas.` }));

/* 11. Guardar -------------------------------------------------------- */
for (const d of diseases) { d.props.cluster = diseaseCluster[d.id]; d.props.centrality = centrality[d.id]; }
const analytics: Analytics = {
  generated_at: new Date().toISOString(),
  method: `similitud = ${W.phenotype}·Jaccard ponderado de fenotipos (confianza×IC) + ${W.pathway}·(0.7·Jaccard vías Reactome + 0.3·Jaccard nivel superior) + ${W.gene}·gen compartido; aristas con score ≥ ${MIN_EDGE}, top ${TOP_K} por enfermedad; clusters por Louvain (resolución 1, semilla fija).`,
  phenotype_ic_reference: { total_diseases: totalHpo, source: "HPO annotations (ontology.jax.org)" },
  clusters, disease_cluster: diseaseCluster, centrality, variant_effect: variantEffect, similarity, bridges, gaps, counterexamples,
};
g.data.analytics = analytics;
void g.save(); // FileGraph.save es síncrono por dentro

console.log(`✔ análisis: ${clusters.length} clusters, ${inferredCount} conexiones inferidas, ${bridges.length} puentes (${bridges.filter((b) => b.cross_cluster).length} entre clusters), ${gaps.length} huecos, ${counterexamples.length} contraejemplos`);
for (const c of clusters) console.log(`  ${c.id} · ${c.label} · ${c.diseases.map((d) => entities.get(d)?.name).join(" | ")}`);
for (const p of pairs.sort((a, b) => b.s.score - a.s.score).slice(0, 12)) console.log(`  ${p.s.score.toFixed(2)} (fen ${p.s.phenotype_score.toFixed(2)} · vía ${p.s.pathway_score.toFixed(2)}) ${entities.get(p.a)?.name} ↔ ${entities.get(p.b)?.name}`);

/* utilidades -------------------------------------------------------- */
function round(x: number) { return Math.round(x * 1000) / 1000; }
function median(xs: number[]) { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; }
function dedupe(evs: Evidence[]) { const seen = new Set<string>(); return evs.filter((e) => !seen.has(e.id) && seen.add(e.id)); }
function seeded(seed: number) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
