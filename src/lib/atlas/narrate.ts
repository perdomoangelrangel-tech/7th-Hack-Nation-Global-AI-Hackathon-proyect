/**
 * Narración: convierte un camino del grafo en lenguaje claro, citando cada paso.
 *  1. buildFacts(): el recorrido se vuelve una lista de HECHOS numerados, cada uno con su evidencia,
 *     su estado (observado / inferido / hueco) y los nodos del grafo que hay que iluminar al decirlo.
 *  2. El modelo de OpenAI redacta para la persona elegida citando fact_ids (Structured Outputs).
 *  3. El verificador determinista borra toda frase cuyo fact_id no exista. Sin clave: plantilla.
 */
import "server-only";
import { atlas, journey, nameOf, type Journey, type Locale } from "./store";
import type { Evidence } from "./types";
import { PERSONAS, RULES, type FactKind, type PersonaId } from "../agents/profiles";
import { structured, TEXT_MODEL } from "../openai";
import { verify } from "../verifier";

export interface Fact { id: string; kind: FactKind; status: "observed" | "inferred" | "gap"; text: string; evidence_ids: string[]; nodes: string[]; edges: string[] }
export interface NarratedClaim { text: string; fact_ids: string[]; status: Fact["status"]; evidence: Evidence[]; nodes: string[]; edges: string[] }
export interface Narration { disease: string; persona: PersonaId; mode: "openai" | "template"; model: string | null; claims: NarratedClaim[]; dropped: { text: string; reason: string }[]; spoken: string; verified: boolean; facts: number }

const evOf = (edgeIds: string[]) => edgeIds.flatMap((id) => atlas().edgeById.get(id)?.evidence.map((e) => e.id) ?? []);
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function buildFacts(j: Journey, l: Locale): { facts: Fact[]; coverage: Evidence } {
  const es = l === "es";
  const d = j.disease.id;
  const { byId } = atlas();
  const facts: Fact[] = [];
  const push = (f: Omit<Fact, "id">) => { if (f.evidence_ids.length) facts.push({ ...f, id: `f${facts.length + 1}` }); };

  // Evidencia sintética de cobertura: lo que buscamos, para que "no hay" sea una afirmación con respaldo.
  const coverage: Evidence = {
    id: `coverage:${d}`, source: "atlas_analysis", external_id: `coverage/${j.disease.canonical_id}`,
    url: "https://github.com/perdomoangelrangel-tech/7th-Hack-Nation-Global-AI-Hackathon-proyect#search-coverage",
    quote: `${j.coverage.sources.map((s) => s.name).join(", ")} · ${j.coverage.counts.studies} studies, ${j.coverage.counts.papers} papers, ${j.coverage.counts.nih_projects} NIH projects, ${j.coverage.counts.phenotypes} phenotypes`,
    published_on: null, retrieved_at: new Date().toISOString(),
  };

  const causes = (atlas().in.get(d) ?? []).filter((e) => e.relation === "causes" && e.props.primary);
  const orphaEdge = (atlas().out.get(d) ?? []).find((e) => e.relation === "has_phenotype") ?? causes[0];
  if (j.disease.definition && orphaEdge) push({ kind: "disease", status: "observed", nodes: [d], edges: [], evidence_ids: orphaEdge.evidence.slice(0, 1).map((e) => e.id),
    text: `${j.disease.name}: ${firstSentence(j.disease.definition)}` });

  for (const c of causes) {
    const gene = byId.get(c.from)!;
    push({ kind: "gene", status: "observed", nodes: [gene.id, d], edges: [c.id], evidence_ids: c.evidence.filter((e) => !e.external_id.startsWith("count:")).map((e) => e.id),
      text: es ? `Las variantes en el gen ${gene.name} causan ${j.disease.name}.` : `Variants in the ${gene.name} gene cause ${j.disease.name}.` });
  }
  const ve = j.disease.variant_effect;
  if (ve) {
    const ce = atlas().edgeById.get(ve.edge);
    const countEv = ce?.evidence.filter((e) => e.external_id.startsWith("count:") || e.source === "clinvar").map((e) => e.id) ?? [];
    push({ kind: "variant_effect", status: "inferred", nodes: [ce?.from ?? d, d], edges: [ve.edge], evidence_ids: countEv,
      text: es ? `De ${ve.n} variantes patogénicas de ${ve.gene} registradas en ClinVar para esta enfermedad, ${pct(ve.lof_fraction)} son truncantes y ${pct(ve.missense_fraction)} de sentido erróneo: ${ve.call}.`
               : `Of ${ve.n} pathogenic ${ve.gene} variants recorded in ClinVar for this disease, ${pct(ve.lof_fraction)} are truncating and ${pct(ve.missense_fraction)} missense: ${translateCall(ve.call, l)}.` });
  }

  for (const n of j.shares.slice(0, 3)) {
    const x = n.explanation;
    const phen = x.shared_phenotypes.slice(0, 3).map((p) => p.name).join(", ");
    push({ kind: "neighbor", status: "inferred", nodes: [d, n.disease], edges: [n.edge], evidence_ids: evOf([n.edge]),
      text: es ? `El atlas conecta ${j.disease.name} con ${n.name} (similitud ${n.score.toFixed(2)}): comparten ${phen}${x.shared_pathways.length ? ` y la vía ${x.shared_pathways[0].name}` : ""}.${n.same_cluster ? " Están en el mismo cluster de mecanismo." : ""}`
               : `The atlas connects ${j.disease.name} with ${n.name} (similarity ${n.score.toFixed(2)}): they share ${phen}${x.shared_pathways.length ? ` and the ${x.shared_pathways[0].name} pathway` : ""}.${n.same_cluster ? " They sit in the same mechanism cluster." : ""}` });
    for (const p of x.shared_pathways.slice(0, 1)) {
      const pe = [...(atlas().in.get(p.id) ?? [])].filter((e) => e.relation === "participates_in");
      const genes = pe.map((e) => byId.get(e.from)?.name).filter(Boolean);
      if (genes.length > 1) push({ kind: "pathway", status: "observed", nodes: [p.id, ...pe.map((e) => e.from)], edges: pe.map((e) => e.id), evidence_ids: evOf(pe.map((e) => e.id)),
        text: es ? `Según Reactome, ${genes.join(" y ")} participan en la vía ${p.name}: distintos nombres de gen, un proceso biológico compartido.` : `According to Reactome, ${genes.join(" and ")} take part in ${p.name}: different gene names, one shared biological process.` });
    }
  }

  for (const c of j.counterexamples.slice(0, 1)) {
    const pe = (atlas().out.get(d) ?? []).filter((e) => e.relation === "has_phenotype" && c.shared_phenotypes.includes(byId.get(e.to)?.name ?? ""));
    push({ kind: "counterexample", status: "inferred", nodes: [d, c.other], edges: pe.map((e) => e.id), evidence_ids: evOf(pe.map((e) => e.id)).concat(coverage.id),
      text: es ? `Ojo: ${c.other_name} comparte síntomas como ${c.shared_phenotypes.slice(0, 2).join(" y ")}, pero ninguna vía biológica en nuestras fuentes; puede requerir una estrategia distinta.` : `Careful: ${c.other_name} shares symptoms such as ${c.shared_phenotypes.slice(0, 2).join(" and ")}, but no biological pathway in our sources; it may need a different strategy.` });
  }

  const kindName = (k: string) => (es ? { natural_history: "un estudio de historia natural", registry: "un registro", biomarker_study: "un estudio de biomarcadores", observational_cohort: "una cohorte observacional", interventional_trial: "un ensayo" } : { natural_history: "a natural history study", registry: "a registry", biomarker_study: "a biomarker study", observational_cohort: "an observational cohort", interventional_trial: "a trial" })[k as "registry"] ?? k;
  for (const a of j.assets.own.filter((x) => x.shared_with.length).slice(0, 1)) push({ kind: "asset", status: "observed", nodes: [a.id, d, ...j.shares.filter((s) => a.shared_with.includes(s.name)).map((s) => s.disease)], edges: [a.edge], evidence_ids: evOf([a.edge]),
    text: es ? `Ya existe un estudio que incluye a ${j.disease.name} y a ${a.shared_with.join(" y ")}: «${a.title}». Es la prueba de que estas comunidades ya pueden investigar juntas.` : `A study already includes both ${j.disease.name} and ${a.shared_with.join(" and ")}: "${a.title}". Proof these communities can already research together.` });
  for (const a of [...j.assets.own.filter((x) => !x.shared_with.length).slice(0, 2), ...j.assets.reusable.slice(0, 2)]) {
    const dn = nameOf(byId.get(a.disease), l);
    push({ kind: "asset", status: "observed", nodes: [a.id, a.disease], edges: [a.edge], evidence_ids: evOf([a.edge]),
      text: es ? `${a.own ? "Para" : "En la enfermedad vecina"} ${dn} existe ${kindName(a.kind)}: «${a.title}» (${a.status.toLowerCase().replace(/_/g, " ")}).${a.own ? "" : " Habría que revisar si su elegibilidad puede incluir a esta enfermedad."}`
               : `${a.own ? "For" : "In the neighbor disease"} ${dn} there is ${kindName(a.kind)}: "${a.title}" (${a.status.toLowerCase().replace(/_/g, " ")}).${a.own ? "" : " Its eligibility would need review before including this disease."}` });
  }

  for (const t of j.assets.treatments.filter((x) => x.approved).slice(0, 1)) push({ kind: "treatment", status: "observed", nodes: [t.id, d], edges: [t.edge], evidence_ids: evOf([t.edge]),
    text: es ? `Open Targets registra ${t.name} como fármaco aprobado para ${j.disease.name}${t.mechanism ? ` (${t.mechanism})` : ""}.` : `Open Targets lists ${t.name} as an approved drug for ${j.disease.name}${t.mechanism ? ` (${t.mechanism})` : ""}.` });
  if (!j.assets.treatments.some((x) => x.approved)) push({ kind: "gap", status: "gap", nodes: [d], edges: [], evidence_ids: [coverage.id],
    text: es ? `En nuestras fuentes no hay un fármaco aprobado para ${j.disease.name}; hay ${j.assets.treatments.length} candidato(s) en estudio.` : `Our sources show no approved drug for ${j.disease.name}; there are ${j.assets.treatments.length} candidate(s) under study.` });
  for (const t of j.assets.neighbor_approved.slice(0, 1)) push({ kind: "treatment", status: "inferred", nodes: [t.id, t.disease, d], edges: [t.edge], evidence_ids: evOf([t.edge]),
    text: es ? `${t.name} está aprobado para ${t.disease_name}, una enfermedad vecina. Si tiene sentido para esta enfermedad es una pregunta para un experto, no una recomendación.` : `${t.name} is approved for ${t.disease_name}, a neighbor disease. Whether it makes sense here is a question for an expert, not a recommendation.` });

  for (const c of j.collaborators.slice(0, 3)) push({ kind: "collaborator", status: "observed", nodes: [c.id, ...c.diseases], edges: c.edges.slice(0, 4), evidence_ids: evOf(c.edges.slice(0, 4)),
    text: c.kind === "patient_org" ? (es ? `${c.name} es una organización de pacientes: ${c.why.toLowerCase()}.` : `${c.name} is a patient organization: ${c.why.toLowerCase()}.`)
      : c.kind === "investigator" ? (es ? `${c.name}${c.institution ? `, de ${c.institution},` : ""} ${c.why.charAt(0).toLowerCase()}${c.why.slice(1)}.` : `${c.name}${c.institution ? ` at ${c.institution}` : ""} ${c.why.charAt(0).toLowerCase()}${c.why.slice(1)}.`)
      : (es ? `${c.name}: ${c.why.toLowerCase()}.` : `${c.name}: ${c.why.toLowerCase()}.`) });

  for (const s of j.steps) push({ kind: "step", status: s.evidence_edges.length ? "inferred" : "gap", nodes: s.nodes, edges: s.evidence_edges, evidence_ids: s.evidence_edges.length ? evOf(s.evidence_edges) : [coverage.id],
    text: `${s.title}. ${s.detail}` });

  for (const g of j.gaps.filter((x) => x.kind !== "no_approved_treatment").slice(0, 2)) push({ kind: "gap", status: "gap", nodes: [d], edges: [], evidence_ids: [coverage.id], text: `${g.detail} ${g.what_would_change_it}` });
  if (j.honest_gap) push({ kind: "gap", status: "gap", nodes: [d], edges: [], evidence_ids: [coverage.id], text: `${j.honest_gap.detail} ${j.honest_gap.next_question}` });

  return { facts, coverage };
}

/** La voz lee la primera oración de la definición de Orphanet; el panel muestra la completa. */
function firstSentence(s: string) { const m = s.match(/^.+?[.!?](s|$)/); return (m ? m[0] : s).trim(); }

function translateCall(call: string, l: Locale) {
  if (l === "es") return call;
  return call
    .replace("pérdida de función (declarada por Orphanet)", "loss of function (stated by Orphanet)")
    .replace("ganancia de función (declarada por Orphanet)", "gain of function (stated by Orphanet)")
    .replace("predominan variantes truncantes → pérdida de función probable", "truncating variants predominate → loss of function is likely")
    .replace(/predominan variantes de sentido erróneo.*/, "missense variants predominate → the mechanism may differ from loss of function (gain or dominant-negative); needs functional validation")
    .replace("mezcla de variantes truncantes y de sentido erróneo → mecanismo no concluyente", "a mix of truncating and missense variants → mechanism is inconclusive");
}

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["claims"],
  properties: {
    claims: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["text", "fact_ids"], properties: { text: { type: "string" }, fact_ids: { type: "array", items: { type: "string" } } } },
    },
  },
};

export async function narrate(diseaseId: string, personaId: PersonaId, l: Locale): Promise<Narration | null> {
  const j = journey(diseaseId, l); if (!j) return null;
  const persona = PERSONAS[personaId];
  const { facts, coverage } = buildFacts(j, l);
  const byFact = new Map(facts.map((f) => [f.id, f]));
  const ordered = [...facts].sort((a, b) => rank(a.kind) - rank(b.kind));
  function rank(k: FactKind) { const i = persona.priorities.indexOf(k); return i < 0 ? 99 : i; }

  const label = (s: Fact["status"]) => (l === "es" ? { observed: "OBSERVADO", inferred: "INFERIDO", gap: "HUECO" } : { observed: "OBSERVED", inferred: "INFERRED", gap: "GAP" })[s];
  const llm = await structured<{ claims: { text: string; fact_ids: string[] }[] }>({
    name: "atlas_narration",
    system: `${persona.tone[l]}\n\n${l === "es" ? `Narra el recorrido de ${j.disease.name} para ${persona.name} (${persona.role.es}) en un máximo de ${persona.maxClaims} afirmaciones, en el orden que más le sirva a esa persona. Termina con el siguiente paso concreto.` : `Narrate the journey for ${j.disease.name} to ${persona.name} (${persona.role.en}) in at most ${persona.maxClaims} claims, in the order most useful to that person. End with the concrete next step.`}\n\n${RULES[l]}`,
    input: `FACTS:\n${ordered.map((f) => `[${f.id}] (${label(f.status)}, ${f.kind}) ${f.text}`).join("\n")}`,
    schema: SCHEMA,
  });

  // Plantilla sin modelo: cupo por tipo para que la narración recorra conexión -> activo -> colaborador -> paso.
  const QUOTA: Partial<Record<FactKind, number>> = { disease: 1, gene: 1, variant_effect: 1, neighbor: 1, pathway: 1, counterexample: 1, asset: 2, treatment: 1, collaborator: 1, step: 2, gap: 1 };
  const used = new Map<FactKind, number>();
  const template = ordered.filter((f) => { const n = used.get(f.kind) ?? 0; if (n >= (QUOTA[f.kind] ?? 1)) return false; used.set(f.kind, n + 1); return true; })
    .slice(0, persona.maxClaims)
    .sort((a, b) => Number(a.kind === "step") - Number(b.kind === "step")) // el siguiente paso siempre al final
    .map((f) => ({ text: f.text, fact_ids: [f.id] }));
  const raw = llm ? llm.claims.slice(0, persona.maxClaims + 1) : template;

  // Verificación: fact_ids desconocidos -> la afirmación se borra. Luego el verificador de evidencia de siempre.
  const allowedEvidence = new Set([...facts.flatMap((f) => f.evidence_ids), coverage.id]);
  const mapped = raw.map((c) => ({ text: c.text, evidence_ids: c.fact_ids.every((id) => byFact.has(id)) ? c.fact_ids.flatMap((id) => byFact.get(id)!.evidence_ids) : [] , fact_ids: c.fact_ids }));
  const v = verify({ spoken: "", claims: mapped.map(({ text, evidence_ids }) => ({ text, evidence_ids })), next_steps: [] }, allowedEvidence, l);
  const evidenceById = new Map([...atlas().evidenceById, [coverage.id, coverage]]);
  const claims: NarratedClaim[] = v.claims.map((c) => {
    const m = mapped.find((x) => x.text === c.text)!;
    const fs = m.fact_ids.map((id) => byFact.get(id)!).filter(Boolean);
    const status: Fact["status"] = fs.some((f) => f.status === "gap") ? "gap" : fs.some((f) => f.status === "inferred") ? "inferred" : "observed";
    return {
      text: c.text, fact_ids: m.fact_ids, status,
      evidence: [...new Set(c.evidence_ids)].map((id) => evidenceById.get(id)).filter((e): e is Evidence => !!e).slice(0, 6),
      nodes: [...new Set(fs.flatMap((f) => f.nodes))], edges: [...new Set(fs.flatMap((f) => f.edges))],
    };
  });
  return { disease: diseaseId, persona: personaId, mode: llm ? "openai" : "template", model: llm ? TEXT_MODEL : null, claims, dropped: v.dropped, spoken: v.spoken, verified: v.verified, facts: facts.length };
}
