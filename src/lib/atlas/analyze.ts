/**
 * Graph analytics (challenge Module 3), pure and deterministic: same snapshot in -> same analytics out.
 *   - phenotype information content (IC): "seizure" weighs little, a rare sign weighs a lot
 *   - variant effect per disease (truncating vs missense) from Orphanet + ClinVar
 *   - disease-disease similarity = phenotypes (IC-weighted simGIC) + mechanism (Reactome) + shared gene, with its explanation
 *   - `similar_to` edges of kind INFERRED (never shown as observed), each citing the observed edges behind it
 *   - Louvain clusters over that similarity, named after the dominant mechanism (`label_basis` says why)
 *   - centrality, bridges (shared investigators / organizations / sponsors), gaps, counterexamples
 *
 * Used by the Supabase loader (./source.ts) when the database has no analytics, and by `npm run analyze`.
 */
import { createHash } from "node:crypto";
import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import type { Analytics, AtlasSnapshot, Bridge, Cluster, Counterexample, Edge, Entity, Evidence, Gap, SimilarityExplanation } from "./types";

export const ANALYSIS_VERSION = "nedamex_similarity_v2";
const W = { phenotype: 0.55, pathway: 0.35, gene: 0.1 } as const;
const MIN_EDGE = 0.06;      // below this the connection is not drawn (simGIC scores are low in absolute value)
const TOP_K = 3;            // max inferred neighbors per disease
const MIN_ANCESTOR_IC = 0.25; // ancestors nearly every disease has carry no signal
const LABEL_SLACK = 0.15;     // cluster naming: pathways this close to the most specific one compete on narrowness
// Data-viz palette (the one place raw hex is allowed): logo blues first, then distinct accessible hues.
const PALETTE = ["#3a86bf", "#0f766e", "#b45309", "#7c3aed", "#be185d", "#4d7c0f", "#0e7490", "#9a3412"];
const ACTIVE = new Set(["RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING", "ENROLLING_BY_INVITATION"]);
const TRUNCATING = /frameshift|nonsense|stop[ _]gained|splice[ _](donor|acceptor)|start[ _]lost|initiator codon/i;
const MISSENSE = /missense/i;
const ANALYSIS_URL = "https://github.com/perdomoangelrangel-tech/7th-Hack-Nation-Global-AI-Hackathon-proyect/blob/main/src/lib/atlas/analyze.ts";

export const shortHash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 12);
export const similarityEdgeId = (a: string, b: string) => `edge:${shortHash(`${a}|similar_to|${b}`)}`;

interface Ancestor { id: string; name: string; name_es?: string; n: number | null }
interface Profile {
  phen: Map<string, number>; genes: Set<string>; primary: string[]; leaf: Set<string>; top: Set<string>;
  phenEdges: Map<string, Edge>; pathEdges: Map<string, Edge[]>; via: Map<string, string>;
}

/** Analytics only (the snapshot is not modified). */
export function analyze(snapshot: AtlasSnapshot): Analytics {
  return withAnalytics(snapshot).analytics!;
}

/**
 * Returns a NEW snapshot: previous inferred `similar_to` edges replaced by fresh ones, derived props
 * (phenotype ic, disease cluster / centrality / variant_effect) set on cloned entities, and `analytics`.
 */
export function withAnalytics(snapshot: AtlasSnapshot): AtlasSnapshot {
  const now = snapshot.generated_at;
  const entityList: Entity[] = snapshot.entities.map((e) => ({ ...e, props: { ...e.props } }));
  const entities = new Map(entityList.map((e) => [e.id, e]));
  const edges = snapshot.edges.filter((e) => !(e.kind === "inferred" && e.relation === "similar_to"));
  const byEdgeId = new Map(edges.map((e) => [e.id, e]));
  const outIdx = new Map<string, Edge[]>(); const inIdx = new Map<string, Edge[]>();
  for (const e of edges) {
    if (e.kind === "proposed") continue; // community drafts never feed the analysis
    const ko = `${e.relation}|${e.from}`, ki = `${e.relation}|${e.to}`;
    outIdx.set(ko, [...(outIdx.get(ko) ?? []), e]); inIdx.set(ki, [...(inIdx.get(ki) ?? []), e]);
  }
  const out = (rel: string, from: string) => outIdx.get(`${rel}|${from}`) ?? [];
  const into = (rel: string, to: string) => inIdx.get(`${rel}|${to}`) ?? [];
  const ofType = (t: Entity["type"]) => entityList.filter((e) => e.type === t);
  const diseases = ofType("disease").filter((d) => edges.some((e) => e.from === d.id || e.to === d.id)).sort((a, b) => a.id.localeCompare(b.id));
  const diseaseIds = new Set(diseases.map((d) => d.id));

  /* 1. Phenotype IC (and HPO ancestors) ------------------------------- */
  const phenotypes = ofType("phenotype");
  // Ancestors: HPO ancestors stored on the term (bundled snapshot) or the closure of observed `is_a` edges (live DB).
  const parents = new Map<string, string[]>();
  for (const e of edges) if (e.relation === "is_a") parents.set(e.from, [...(parents.get(e.from) ?? []), e.to]);
  const ancestorCache = new Map<string, Ancestor[]>();
  const ancestorsFor = (p: Entity | undefined): Ancestor[] => {
    if (!p) return [];
    const declared = ancestorsOf(p);
    if (declared.length || !parents.has(p.id)) return declared;
    if (ancestorCache.has(p.id)) return ancestorCache.get(p.id)!;
    const seen = new Set<string>(); const stack = [...(parents.get(p.id) ?? [])];
    while (stack.length) { const x = stack.pop()!; if (seen.has(x) || x === p.id) continue; seen.add(x); stack.push(...(parents.get(x) ?? [])); }
    const list = [...seen].sort().map((id) => { const a = entities.get(id); return { id: a?.canonical_id ?? id.replace(/^phenotype:/, ""), name: a?.name ?? id, n: a?.props.annotated_diseases ? Number(a.props.annotated_diseases) : null }; });
    ancestorCache.set(p.id, list);
    return list;
  };
  const totalHpo = Math.max(0, ...phenotypes.map((e) => Number(e.props.hpo_total_diseases ?? 0)));
  const icFromCount = (n: number | null | undefined) => (n && n > 0 && totalHpo > 0 ? -Math.log(n / totalHpo) / Math.log(totalHpo) : null);
  // Fallback IC = 1 - (atlas diseases whose phenotype closure contains the term) / (atlas diseases).
  const closureCount = new Map<string, number>();
  for (const d of diseases) {
    const terms = new Set<string>();
    for (const e of out("has_phenotype", d.id)) { terms.add(e.to); for (const a of ancestorsFor(entities.get(e.to))) terms.add(`phenotype:${a.id}`); }
    for (const t of terms) closureCount.set(t, (closureCount.get(t) ?? 0) + 1);
  }
  const atlasIc = (term: string) => round(1 - (closureCount.get(term) ?? 0) / Math.max(1, diseases.length));
  const icOf = new Map<string, number>();
  const termName = new Map<string, string>();
  for (const p of phenotypes) {
    // Normalized IC 0..1 = -ln(n/N)/ln(N) from HPO annotation counts; without them, frequency inside the atlas (flagged in ic_basis).
    const fromHpo = icFromCount(Number(p.props.annotated_diseases ?? 0));
    const ic = fromHpo !== null ? round(fromHpo) : atlasIc(p.id);
    icOf.set(p.id, ic);
    termName.set(p.id, p.name);
    p.props.ic = ic;
    p.props.ic_basis = fromHpo !== null ? "hpo_annotations" : "atlas_frequency";
    for (const a of ancestorsFor(p)) {
      const key = `phenotype:${a.id}`;
      const aic = icFromCount(a.n);
      if (aic !== null) icOf.set(key, round(aic));
      else if (!icOf.has(key)) icOf.set(key, atlasIc(key));
      if (!termName.has(key)) termName.set(key, a.name);
    }
  }

  /* 2. Disease profiles ----------------------------------------------- */
  const profiles = new Map<string, Profile>();
  for (const d of diseases) {
    const phenEdges = new Map(out("has_phenotype", d.id).map((e) => [e.to, e]));
    // simGIC: each phenotype contributes its IC and its ancestors' (upward closure), weighted by frequency.
    const phen = new Map<string, number>(); const via = new Map<string, string>();
    for (const [pid, e] of [...phenEdges].sort(([a], [b]) => a.localeCompare(b))) {
      const add = (term: string, w: number) => { if (w > (phen.get(term) ?? 0)) { phen.set(term, w); if (term !== pid) via.set(term, pid); } };
      add(pid, e.confidence * (icOf.get(pid) ?? 0.5));
      for (const a of ancestorsFor(entities.get(pid))) {
        const ic = icOf.get(`phenotype:${a.id}`);
        if (ic !== undefined && ic >= MIN_ANCESTOR_IC) add(`phenotype:${a.id}`, e.confidence * ic);
      }
    }
    const allCauses = into("causes", d.id);
    const causal = allCauses.filter((e) => e.confidence >= 0.9);
    const primary = primaryCauses(allCauses).map((e) => e.from);
    const leaf = new Set<string>(); const top = new Set<string>(); const pathEdges = new Map<string, Edge[]>();
    for (const ge of causal.length ? causal : primaryCauses(allCauses)) for (const pe of out("participates_in", ge.from)) {
      leaf.add(pe.to);
      const t = String(entities.get(pe.to)?.props.top_level ?? ""); if (t) top.add(t);
      pathEdges.set(pe.to, [...(pathEdges.get(pe.to) ?? []), pe]);
    }
    profiles.set(d.id, { phen, genes: new Set(allCauses.map((e) => e.from)), primary, leaf, top, phenEdges, pathEdges, via });
  }

  /* 3. Variant effect PER DISEASE -------------------------------------- */
  // Full ClinVar count (P/LP of the gene for THAT disease). Fallback: the gene's variant sample.
  const variantEffect: Analytics["variant_effect"] = {};
  for (const d of diseases) {
    const causal = primaryCauses(into("causes", d.id));
    const ce = causal.find((e) => e.props.variant_counts) ?? causal[0];
    if (!ce) continue;
    const vc = ce.props.variant_counts as { total: number; missense: number; truncating: number } | undefined;
    const declared = (ce.props.variant_effect ?? ce.props.functional_effect) as string | undefined;
    let n = 0, lofF = 0, misF = 0, basis = "";
    if (vc?.total) { n = vc.total; lofF = vc.truncating / n; misF = vc.missense / n; basis = "ClinVar pathogenic/likely pathogenic count for this disease"; }
    else {
      const vs = out("has_variant", ce.from).map((e) => entities.get(e.to)?.props.consequences as string[] | undefined).filter((c): c is string[] => !!c?.length);
      n = vs.length; basis = "sample of the gene's ClinVar variants";
      lofF = n ? vs.filter((c) => c.some((x) => TRUNCATING.test(x))).length / n : 0;
      misF = n ? vs.filter((c) => c.some((x) => MISSENSE.test(x)) && !c.some((x) => TRUNCATING.test(x))).length / n : 0;
    }
    if (!n && !declared) continue;
    const gene = entities.get(ce.from)?.name ?? ce.from;
    const call = declared === "loss_of_function" ? "loss of function (declared by Orphanet)"
      : declared === "gain_of_function" ? "gain of function (declared by Orphanet)"
      : lofF >= 0.5 ? "mostly truncating variants → loss of function likely"
      : misF >= 0.6 ? "mostly missense variants → the mechanism may differ from loss of function (gain of function or dominant negative); needs functional validation"
      : "mix of truncating and missense variants → mechanism inconclusive";
    variantEffect[d.id] = { gene, lof_fraction: round(lofF), missense_fraction: round(misF), n, call, basis, edge: ce.id };
    entities.get(d.id)!.props.variant_effect = variantEffect[d.id];
  }
  const effectClass = (id: string) => {
    const v = variantEffect[id]; if (!v) return null;
    if (/declared/.test(v.call)) return v.call.startsWith("gain") ? "gof" : "lof";
    return v.lof_fraction >= 0.5 ? "lof" : v.missense_fraction >= 0.6 ? "missense" : "mixed";
  };

  /* 4. Pairwise similarity -------------------------------------------- */
  const pairs: { a: string; b: string; s: SimilarityExplanation }[] = [];
  for (let i = 0; i < diseases.length; i++) for (let j = i + 1; j < diseases.length; j++) {
    const a = diseases[i].id, b = diseases[j].id;
    const A = profiles.get(a)!, B = profiles.get(b)!;
    let num = 0, den = 0;
    const shared: { id: string; name: string; ic: number }[] = [];
    for (const p of [...new Set([...A.phen.keys(), ...B.phen.keys()])].sort()) {
      const x = A.phen.get(p) ?? 0, y = B.phen.get(p) ?? 0;
      num += Math.min(x, y); den += Math.max(x, y);
      if (x && y) shared.push({ id: p, name: termName.get(p) ?? p, ic: icOf.get(p) ?? 0 });
    }
    shared.sort((x, y) => y.ic - x.ic || x.id.localeCompare(y.id));
    const sPh = den ? num / den : 0;
    const leafShared = [...A.leaf].filter((x) => B.leaf.has(x)).sort();
    const leafUnion = new Set([...A.leaf, ...B.leaf]).size;
    const topUnion = new Set([...A.top, ...B.top]).size;
    const jLeaf = leafUnion ? leafShared.length / leafUnion : 0;
    const jTop = topUnion ? [...A.top].filter((x) => B.top.has(x)).length / topUnion : 0;
    const sPw = 0.7 * jLeaf + 0.3 * jTop;
    const sharedGenes = [...A.genes].filter((x) => B.genes.has(x)).sort();
    const score = W.phenotype * sPh + W.pathway * sPw + W.gene * (sharedGenes.length ? 1 : 0);
    const ea = effectClass(a), eb = effectClass(b);
    const topShared = shared.slice(0, 8);
    // The observed edge behind a shared term is the direct phenotype edge (or the descendant it came through).
    const edgeFor = (P: Profile, term: string) => P.phenEdges.get(term)?.id ?? P.phenEdges.get(P.via.get(term) ?? "")?.id;
    const supporting = [
      ...topShared.slice(0, 4).flatMap((p) => [edgeFor(A, p.id), edgeFor(B, p.id)]),
      ...leafShared.slice(0, 3).flatMap((p) => [...(A.pathEdges.get(p) ?? []), ...(B.pathEdges.get(p) ?? [])].map((e) => e.id)),
      ...sharedGenes.flatMap((gid) => [...into("causes", a), ...into("causes", b)].filter((e) => e.from === gid).map((e) => e.id)),
    ].filter((x): x is string => !!x);
    pairs.push({
      a, b,
      s: {
        score: round(score), phenotype_score: round(sPh), pathway_score: round(sPw),
        variant_effect_match: ea && eb ? ea === eb : null,
        shared_phenotypes: topShared,
        shared_pathways: leafShared.slice(0, 6).map((id) => ({ id, name: entities.get(id)?.name ?? id })),
        shared_genes: sharedGenes.map((x) => entities.get(x)?.name ?? x),
        supporting_edges: [...new Set(supporting)],
      },
    });
  }

  /* 5. Inferred similar_to edges (top-K per disease) ------------------- */
  const keep = new Set<string>();
  for (const d of diseases) {
    pairs.filter((p) => (p.a === d.id || p.b === d.id) && p.s.score >= MIN_EDGE && p.s.supporting_edges.length)
      .sort((x, y) => y.s.score - x.s.score || `${x.a}|${x.b}`.localeCompare(`${y.a}|${y.b}`)).slice(0, TOP_K)
      .forEach((p) => keep.add(`${p.a}|${p.b}`));
  }
  const similarity: Analytics["similarity"] = {};
  const inferred: Edge[] = [];
  for (const p of pairs.filter((x) => keep.has(`${x.a}|${x.b}`))) {
    const id = similarityEdgeId(p.a, p.b);
    const supportEv = p.s.supporting_edges.flatMap((eid) => byEdgeId.get(eid)?.evidence.slice(0, 1) ?? []);
    const why = [
      p.s.shared_phenotypes.length ? `${p.s.shared_phenotypes.length} shared phenotype(s) (most informative: ${p.s.shared_phenotypes.slice(0, 3).map((x) => x.name).join(", ")})` : null,
      p.s.shared_pathways.length ? `shared Reactome pathway(s): ${p.s.shared_pathways.slice(0, 2).map((x) => x.name).join("; ")}` : null,
      p.s.shared_genes.length ? `shared gene(s): ${p.s.shared_genes.join(", ")}` : null,
    ].filter(Boolean).join(" · ");
    inferred.push({
      id, from: p.a, to: p.b, relation: "similar_to", kind: "inferred",
      confidence: p.s.score, confidence_basis: ANALYSIS_VERSION,
      props: { phenotype_score: p.s.phenotype_score, pathway_score: p.s.pathway_score, variant_effect_match: p.s.variant_effect_match },
      evidence: [
        { id: `ev:${shortHash(`${id}|analysis`)}`, source: "nexmed_analysis", external_id: ANALYSIS_VERSION, url: ANALYSIS_URL, quote: `Inferred by Nedamex (score ${p.s.score}): ${why}`, published_on: null, retrieved_at: now },
        ...dedupe(supportEv),
      ],
    });
    similarity[id] = p.s;
  }

  /* 6. Clusters (deterministic Louvain) -------------------------------- */
  const G = new Graph({ type: "undirected" });
  for (const d of diseases) G.addNode(d.id);
  for (const p of pairs) if (p.s.score >= MIN_EDGE * 0.8) G.addEdge(p.a, p.b, { weight: p.s.score });
  const communities: Record<string, number> = diseases.length
    ? (louvain(G, { getEdgeWeight: "weight", resolution: 1, rng: seeded(7) }) as Record<string, number>)
    : {};
  const groups = new Map<number, string[]>();
  for (const d of diseases) { const c = communities[d.id] ?? -1; groups.set(c, [...(groups.get(c) ?? []), d.id]); }

  const orphanetGroups = (d: string) => ((entities.get(d)?.props.orphanet_groups as { orpha: string; name: string; synonyms?: string[] }[] | undefined) ?? [])
    .filter((g, i, arr) => arr.findIndex((x) => x.orpha === g.orpha) === i);
  const groupSize = new Map<string, number>();
  for (const d of diseases) for (const g of orphanetGroups(d.id)) groupSize.set(g.orpha, (groupSize.get(g.orpha) ?? 0) + 1);
  const groupAtlasSize = (orpha: string) => groupSize.get(orpha) ?? 0;
  const pathwayGenes = new Map<string, number>();
  for (const e of edges) if (e.relation === "participates_in") pathwayGenes.set(e.to, (pathwayGenes.get(e.to) ?? 0) + 1);
  const genesIn = (pathway: string) => pathwayGenes.get(pathway) ?? 0;

  const clusters: Cluster[] = [...groups.values()]
    .map((m) => m.sort())
    .sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]))
    .map((members, i) => nameCluster(members, i));

  function nameCluster(members: string[], i: number): Cluster {
    const pathCount = new Map<string, number>(); const phenCount = new Map<string, number>();
    for (const m of members) {
      for (const p of profiles.get(m)!.leaf) pathCount.set(p, (pathCount.get(p) ?? 0) + 1);
      for (const p of profiles.get(m)!.phen.keys()) phenCount.set(p, (phenCount.get(p) ?? 0) + 1);
    }
    const outside = diseases.filter((d) => !members.includes(d.id));
    const specificity = (p: string, kind: "leaf" | "phen") =>
      outside.filter((d) => (kind === "leaf" ? profiles.get(d.id)!.leaf.has(p) : profiles.get(d.id)!.phen.has(p))).length / Math.max(1, outside.length);
    const minShare = Math.min(2, members.length);
    const shared_pathways = [...pathCount].filter(([, n]) => n >= minShare)
      .map(([id, n]) => ({ id, name: entities.get(id)?.name ?? id, diseases: n, spec: n / members.length - specificity(id, "leaf") }))
      .sort((a, b) => b.spec - a.spec || b.diseases - a.diseases || a.id.localeCompare(b.id)).slice(0, 6);
    const shared_phenotypes = [...phenCount].filter(([, n]) => n >= minShare)
      .map(([id, n]) => ({ id, name: termName.get(id) ?? id, ic: icOf.get(id) ?? 0, diseases: n, spec: (n / members.length - specificity(id, "phen")) * (icOf.get(id) ?? 0.5) }))
      .sort((a, b) => b.spec - a.spec || a.id.localeCompare(b.id)).slice(0, 8);
    // Among near-best pathways (specificity within LABEL_SLACK of the best), name the cluster after the NARROWEST one —
    // fewest atlas genes participate in it — so a broad umbrella pathway (e.g. "Neutrophil degranulation", which
    // contains many lysosomal hydrolases) does not hide the mechanism (e.g. "Glycosphingolipid catabolism").
    const best = shared_pathways[0];
    const pw = best && best.spec > 0
      ? shared_pathways.filter((x) => x.spec > 0 && x.spec >= best.spec - LABEL_SLACK)
        .sort((a, b) => genesIn(a.id) - genesIn(b.id) || b.spec - a.spec || a.id.localeCompare(b.id))[0]
      : best;
    const ph = shared_phenotypes[0];
    // Orphanet classification groups (disease props.orphanet_groups) shared by >= half of the members (>= 2).
    const groupCount = new Map<string, { orpha: string; name: string; synonyms: string[]; n: number }>();
    for (const m of members) for (const g of orphanetGroups(m)) {
      const prev = groupCount.get(g.orpha);
      groupCount.set(g.orpha, { orpha: g.orpha, name: g.name, synonyms: g.synonyms ?? [], n: (prev?.n ?? 0) + 1 });
    }
    const orphanet_groups = [...groupCount.values()].filter((g) => g.n >= 2 && g.n >= members.length / 2)
      .sort((a, b) => b.n - a.n || groupAtlasSize(a.orpha) - groupAtlasSize(b.orpha) || a.name.localeCompare(b.name));
    // Naming precedence: a member-specific Reactome pathway that covers >= half of the members (mechanism) →
    // the most specific Orphanet class covering >= half of the members (fewest atlas diseases outside) →
    // the most informative shared phenotype.
    const byPathway = !!pw && pw.spec > 0 && pw.diseases >= members.length / 2;
    // Best class = highest F1 between the class and the cluster (precision: share of the class's atlas diseases inside
    // the cluster; recall: share of the cluster inside the class), so neither a tiny nor an umbrella class wins.
    const f1 = (g: { orpha: string; n: number }) => { const pr = g.n / Math.max(1, groupAtlasSize(g.orpha)), rc = g.n / members.length; return (2 * pr * rc) / (pr + rc); };
    const grp = !byPathway ? [...orphanet_groups].sort((a, b) => f1(b) - f1(a) || b.n - a.n || a.name.localeCompare(b.name))[0] : undefined;
    const only = members.length === 1 ? entities.get(members[0]) : undefined;
    const label = only ? `${String(only.props.short_name ?? only.name)} (no close neighbor)` : byPathway ? pw.name : grp?.name ?? ph?.name ?? "Cluster";
    const label_basis = only
      ? "Only member: no other atlas disease passes the similarity threshold, so no shared mechanism is claimed"
      : byPathway
      ? `Shared Reactome pathway: ${pw.diseases} of ${members.length} member diseases participate in it vs ${Math.round(specificity(pw.id, "leaf") * 100)}% outside the cluster${pw !== best ? ` (chosen over the broader "${best.name}", ${best.diseases} of ${members.length}, because fewer atlas genes take part in it: ${genesIn(pw.id)} vs ${genesIn(best.id)})` : ""}`
      : grp
        ? `Orphanet classification group ${grp.orpha}: ${grp.n} of ${members.length} member diseases belong to it, ${groupAtlasSize(grp.orpha) - grp.n} atlas disease(s) outside the cluster${pw && pw.spec > 0 ? `; the most specific shared Reactome pathway ("${pw.name}") covers only ${pw.diseases} of ${members.length}` : ""}`
        : ph
          ? `Most informative shared phenotype (IC ${ph.ic}): present in ${ph.diseases} of ${members.length} member diseases; no member-specific Reactome pathway or Orphanet class`
          : "No shared pathway, class or phenotype";
    const aliases = [...new Set([label, ...orphanet_groups.flatMap((g) => [g.name, ...g.synonyms])])];
    return {
      id: `cluster:${i + 1}`, label, label_basis, color: PALETTE[i % PALETTE.length], diseases: members,
      orphanet_groups: orphanet_groups.map(({ orpha, name, n }) => ({ orpha, name, diseases: n })), aliases,
      shared_pathways: shared_pathways.map(({ id, name, diseases }) => ({ id, name, diseases })),
      shared_phenotypes: shared_phenotypes.map(({ id, name, ic, diseases }) => ({ id, name, ic, diseases })),
    };
  }
  const diseaseCluster: Record<string, string> = {};
  for (const c of clusters) for (const d of c.diseases) diseaseCluster[d] = c.id;

  /* 7. Centrality (weighted degree on the similarity graph, 0..100) ---- */
  const strength = new Map(diseases.map((d) => [d.id, pairs.filter((p) => p.a === d.id || p.b === d.id).reduce((s, p) => s + p.s.score, 0)]));
  const maxS = Math.max(...strength.values(), 1e-9);
  const centrality = Object.fromEntries([...strength].map(([k, v]) => [k, Math.round((100 * v) / maxS)]));

  /* 8. Bridges: who already connects communities ---------------------- */
  const bridges: Bridge[] = [];
  const pushBridge = (entity: string, name: string, kind: Bridge["kind"], ds: string[], es: string[]) => {
    const uniq = [...new Set(ds.filter((d) => diseaseIds.has(d)))].sort(); if (uniq.length < 2) return;
    const cl = [...new Set(uniq.map((d) => diseaseCluster[d]))].sort();
    bridges.push({ entity, name, kind, diseases: uniq, clusters: cl, cross_cluster: cl.length > 1, edges: es });
  };
  for (const inv of ofType("investigator")) {
    const es = out("researches", inv.id);
    pushBridge(inv.id, inv.name, "investigator", es.map((e) => e.to), es.map((e) => e.id));
  }
  for (const org of ofType("organization").filter((e) => e.props.kind !== "umbrella")) {
    const es = [...out("researches", org.id), ...out("supports", org.id)];
    pushBridge(org.id, org.name, "organization", es.map((e) => e.to), es.map((e) => e.id));
  }
  const sponsors = new Map<string, { ds: string[]; es: string[] }>();
  for (const e of edges.filter((x) => x.relation === "studies" && entities.get(x.from)?.type === "trial")) {
    const t = entities.get(e.from)!;
    for (const s of [t.props.sponsor, ...((t.props.collaborators as string[]) ?? [])].filter((x): x is string => typeof x === "string" && !!x)) {
      const v = sponsors.get(s) ?? { ds: [], es: [] }; v.ds.push(e.to); v.es.push(e.id); sponsors.set(s, v);
    }
  }
  for (const [s, v] of sponsors) pushBridge(`sponsor:${s}`, s, "sponsor", v.ds, v.es);
  bridges.sort((a, b) => Number(b.cross_cluster) - Number(a.cross_cluster) || b.diseases.length - a.diseases.length || a.name.localeCompare(b.name));

  /* 9. Gaps: what is missing, and what would change it ----------------- */
  const gaps: Gap[] = [];
  for (const d of diseases) {
    const trials = into("studies", d.id).map((e) => entities.get(e.from)).filter((t): t is Entity => t?.type === "trial");
    const treats = into("treats", d.id);
    const name = d.name;
    if (!treats.some((e) => e.props.approved)) gaps.push({ disease: d.id, kind: "no_approved_treatment", detail: `No approved drug is recorded for ${name} in our sources (${treats.length} candidate(s) in development).`, what_would_change_it: "A positive phase 3 trial, or an approved drug with the same mechanism in a neighbor disease of the cluster." });
    if (!trials.some((t) => t.props.asset_kind === "natural_history")) gaps.push({ disease: d.id, kind: "no_natural_history", detail: `We found no natural history study for ${name} on ClinicalTrials.gov.`, what_would_change_it: "Registering one, or joining a neighbor disease's study with shared phenotypes (see cluster)." });
    if (!trials.some((t) => t.props.asset_kind === "registry") && !ofType("organization").some((o) => o.props.registry && edges.some((e) => e.from === o.id && e.to === d.id))) gaps.push({ disease: d.id, kind: "no_registry", detail: `No patient registry for ${name} is visible in our sources.`, what_would_change_it: "The patient organization publishing its registry or listing it on ClinicalTrials.gov." });
    if (!trials.some((t) => ACTIVE.has(String(t.props.status)))) gaps.push({ disease: d.id, kind: "no_active_trial", detail: `No active or recruiting study for ${name} on ClinicalTrials.gov.`, what_would_change_it: "Reusable study designs from diseases in the same cluster." });
    if (d.props.nih_projects !== undefined && !Number(d.props.nih_projects)) gaps.push({ disease: d.id, kind: "no_nih_funding", detail: `NIH RePORTER shows no recent funded project mentioning ${name}.`, what_would_change_it: "A joint application with investigators already funded on the same mechanism (see bridges)." });
    if (!into("supports", d.id).some((e) => entities.get(e.from)?.props.kind === "patient_org")) gaps.push({ disease: d.id, kind: "no_patient_group", detail: `We have no verified disease-specific patient group for ${name}.`, what_would_change_it: "Connecting with the closest neighbor disease's group and founding one." });
    if ((profiles.get(d.id)?.phenEdges.size ?? 0) < 5) gaps.push({ disease: d.id, kind: "few_phenotypes", detail: `Orphanet annotates few phenotypes for ${name}; phenotype similarity is unreliable.`, what_would_change_it: "Natural history or registry data with HPO phenotypes." });
  }

  /* 10. Counterexamples ------------------------------------------------ */
  // (a) same symptoms, different mechanism: phenotype similarity above the median, no shared Reactome pathway, different clusters.
  const phenMedian = median(pairs.map((p) => p.s.phenotype_score));
  const counterexamples: Counterexample[] = pairs
    .filter((p) => p.s.phenotype_score > 0 && p.s.phenotype_score >= phenMedian && p.s.pathway_score === 0 && p.s.shared_genes.length === 0 && diseaseCluster[p.a] !== diseaseCluster[p.b])
    .sort((x, y) => y.s.phenotype_score - x.s.phenotype_score || `${x.a}|${x.b}`.localeCompare(`${y.a}|${y.b}`)).slice(0, 4)
    .map((p) => ({
      a: p.a, b: p.b, kind: "same_symptoms_different_mechanism" as const, shared_phenotypes: p.s.shared_phenotypes.slice(0, 4).map((x) => x.name),
      why: `They share symptoms (phenotype similarity ${p.s.phenotype_score}) but no Reactome pathway: they likely need different therapeutic strategies.`,
    }));
  // (b) same gene, different mechanism: one gene causes both diseases but the variant effect differs (e.g. loss vs gain of function).
  // Only when the variant effect of BOTH diseases was measured on that same gene (its primary causal gene in each).
  for (const p of pairs) {
    const va = variantEffect[p.a], vb = variantEffect[p.b];
    if (!va || !vb || va.gene !== vb.gene || !p.s.shared_genes.includes(va.gene)) continue;
    const ea = effectClass(p.a), eb = effectClass(p.b);
    if (!ea || !eb || ea === eb) continue;
    counterexamples.push({
      a: p.a, b: p.b, kind: "same_gene_different_mechanism", gene: va.gene, edges: [va.edge, vb.edge],
      shared_phenotypes: p.s.shared_phenotypes.slice(0, 4).map((x) => x.name),
      why: `Same gene (${va.gene}) but a different variant effect: ${entities.get(p.a)?.name} → ${va.call}; ${entities.get(p.b)?.name} → ${vb.call}. A therapy that restores the protein in one could worsen the other — the shared gene alone is not a shared mechanism.`,
    });
  }

  /* 11. Assemble -------------------------------------------------------- */
  for (const d of diseases) { d.props.cluster = diseaseCluster[d.id]; d.props.centrality = centrality[d.id]; }
  const analytics: Analytics = {
    generated_at: now,
    method: `similarity = ${W.phenotype}·weighted phenotype Jaccard (confidence×IC, simGIC with HPO ancestors) + ${W.pathway}·(0.7·Reactome pathway Jaccard + 0.3·top-level Jaccard) + ${W.gene}·shared gene; edges with score ≥ ${MIN_EDGE}, top ${TOP_K} per disease; clusters by Louvain (resolution 1, fixed seed). ${ANALYSIS_VERSION}.`,
    phenotype_ic_reference: { total_diseases: totalHpo || diseases.length, source: totalHpo ? "HPO annotations (ontology.jax.org)" : "frequency inside the atlas (HPO counts not loaded)" },
    clusters, disease_cluster: diseaseCluster, centrality, variant_effect: variantEffect, similarity, bridges, gaps, counterexamples,
  };
  return { ...snapshot, entities: entityList, edges: [...edges, ...inferred], analytics };
}

/** Primary causal genes: flagged `primary`, else the highest-confidence causal edges (>= 0.9). */
function primaryCauses(causes: Edge[]): Edge[] {
  const flagged = causes.filter((e) => e.props.primary);
  if (flagged.length) return flagged;
  const strong = causes.filter((e) => e.confidence >= 0.9);
  return (strong.length ? strong : causes).slice().sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id));
}
function ancestorsOf(p: Entity | undefined): Ancestor[] { return ((p?.props.ancestors as Ancestor[] | undefined) ?? []); }
function round(x: number) { return Math.round(x * 1000) / 1000; }
function median(xs: number[]) { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; }
function dedupe(evs: Evidence[]) { const seen = new Set<string>(); return evs.filter((e) => !seen.has(e.id) && !!seen.add(e.id)); }
function seeded(seed: number) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
