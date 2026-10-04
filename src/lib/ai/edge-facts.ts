/**
 * Graph edges → numbered FACTS (pure). Each fact restates exactly one edge, carries its evidence ids,
 * and says who states it (the source) or that the atlas inferred it. Used by /api/explain and agent tools.
 */
import type { Edge, Entity, SourceId } from "../atlas/types";
import type { AtlasIndex } from "./types";
import type { Fact, FactStatus } from "./draft";

type L = "en" | "es";

export const SOURCE_LABEL: Record<SourceId, string> = {
  orphanet: "Orphanet", hpo: "the Human Phenotype Ontology", monarch: "Monarch", clinvar: "ClinVar", ctgov: "ClinicalTrials.gov",
  opentargets: "Open Targets", reactome: "Reactome", pubmed: "PubMed", nih_reporter: "NIH RePORTER", patient_orgs: "the organization's own website",
  fda: "the FDA", atlas_analysis: "Nexmed analysis", nexmed_analysis: "Nexmed analysis", openai_extraction: "an OpenAI extraction", community: "a community draft",
};

const short = (e: Entity | undefined, l: L) => {
  if (!e) return "?";
  const p = e.props as Record<string, unknown>;
  const s = (l === "es" ? p.short_name_es ?? p.name_es : p.short_name) ?? (l === "es" ? p.name_es : undefined);
  return typeof s === "string" && s ? s : e.name;
};
const statusOf = (e: Edge): FactStatus => (e.kind === "inferred" ? "inferred" : e.kind === "extracted" ? "extracted" : "observed");
const humanStatus = (s: unknown) => String(s ?? "").toLowerCase().replace(/_/g, " ");

/** One edge → one fact. Returns null for community drafts (`proposed` is never evidence) or edges without evidence. */
export function edgeFact(idx: AtlasIndex, edge: Edge, id: string, l: L): Fact | null {
  if (edge.kind === "proposed" || !edge.evidence.length) return null;
  const from = idx.byId.get(edge.from), to = idx.byId.get(edge.to);
  const a = short(from, l), b = short(to, l);
  const src = SOURCE_LABEL[edge.evidence[0].source] ?? edge.evidence[0].source;
  const es = l === "es";
  const p = edge.props as Record<string, unknown>;
  let text: string, simple: string;

  switch (edge.relation) {
    case "causes":
      text = es ? `Según ${src}, las variantes en el gen ${a} causan ${b}.` : `According to ${src}, variants in the ${a} gene cause ${b}.`;
      simple = es ? `Un cambio en el gen ${a} causa ${b}.` : `A change in the ${a} gene causes ${b}.`;
      break;
    case "has_phenotype": {
      const freq = typeof p.frequency === "string" ? ` (${p.frequency})` : "";
      text = es ? `Según ${src}, ${a} presenta ${b}${freq}.` : `According to ${src}, ${a} can show ${b}${freq}.`;
      simple = es ? `Las personas con ${a} pueden tener ${b.toLowerCase()}.` : `People with ${a} can have ${b.toLowerCase()}.`;
      break;
    }
    case "has_variant":
      text = es ? `${src} registra la variante ${b} en el gen ${a}.` : `${src} records the variant ${b} in the ${a} gene.`;
      simple = es ? `${src} anota un cambio concreto en el gen ${a}.` : `${src} lists a specific change in the ${a} gene.`;
      break;
    case "studies": {
      const kind = from?.type === "study" ? (es ? "El artículo" : "The paper") : (es ? "El estudio" : "The study");
      const status = from?.props.status ? ` (${humanStatus(from.props.status)})` : "";
      const stopped = p.stopped ? (es ? ` Se detuvo${p.why_stopped ? `: ${p.why_stopped}` : ""}.` : ` It was stopped${p.why_stopped ? `: ${p.why_stopped}` : ""}.`) : "";
      text = es ? `${kind} «${a}»${status} trata sobre ${b}, según ${src}.${stopped}` : `${kind} "${a}"${status} is about ${b}, according to ${src}.${stopped}`;
      simple = es ? `Hay un estudio sobre ${b}: «${a}».${stopped}` : `There is a research study about ${b}: "${a}".${stopped}`;
      break;
    }
    case "treats": {
      const approved = p.approved === true;
      text = approved
        ? (es ? `${src} registra ${a} como fármaco aprobado para ${b}.` : `${src} lists ${a} as an approved drug for ${b}.`)
        : (es ? `${src} registra ${a} como candidato en estudio para ${b} (etapa: ${humanStatus(p.stage) || "desconocida"}); no es una recomendación.` : `${src} lists ${a} as a candidate being studied for ${b} (stage: ${humanStatus(p.stage) || "unknown"}); this is not a recommendation.`);
      simple = approved
        ? (es ? `${a} es un medicamento aprobado para ${b}. Pregunta a tu médico si aplica.` : `${a} is an approved medicine for ${b}. Ask your doctor if it applies.`)
        : (es ? `${a} se está estudiando para ${b}. Todavía no está aprobado.` : `${a} is being studied for ${b}. It is not approved.`);
      break;
    }
    case "supports":
      text = es ? `${a} es una organización de pacientes para ${b} (fuente: ${src}).` : `${a} is a patient organization for ${b} (source: ${src}).`;
      simple = es ? `${a} es un grupo que apoya a familias con ${b}.` : `${a} is a group that supports families living with ${b}.`;
      break;
    case "researches": {
      const project = typeof p.title === "string" ? (es ? ` en el proyecto «${p.title}»` : ` in the project "${p.title}"`) : "";
      text = es ? `${a} investiga ${b}${project}, según ${src}.` : `${a} researches ${b}${project}, according to ${src}.`;
      simple = es ? `${a} estudia ${b}.` : `${a} does research on ${b}.`;
      break;
    }
    case "participates_in":
      text = es ? `Según ${src}, el gen ${a} participa en el proceso «${b}».` : `According to ${src}, the ${a} gene takes part in the "${b}" process.`;
      simple = es ? `El gen ${a} trabaja en un proceso del cuerpo llamado «${b}».` : `The ${a} gene works in a body process called "${b}".`;
      break;
    case "is_a":
      text = es ? `Según ${src}, ${a} es un tipo de ${b}.` : `According to ${src}, ${a} is a kind of ${b}.`;
      simple = text;
      break;
    case "similar_to": {
      const x = idx.snap.analytics?.similarity[edge.id];
      const phen = x?.shared_phenotypes.slice(0, 3).map((s) => s.name).join(", ");
      const path = x?.shared_pathways[0]?.name;
      const what = [phen && (es ? `señales compartidas como ${phen}` : `shared signs such as ${phen}`), path && (es ? `el proceso «${path}»` : `the "${path}" process`)].filter(Boolean).join(es ? " y " : " and ");
      text = es
        ? `El atlas sugiere que ${a} y ${b} están relacionadas (similitud ${edge.confidence.toFixed(2)})${what ? `: ${what}` : ""}. Es una inferencia que debe revisar un experto.`
        : `The atlas suggests ${a} and ${b} are related (similarity ${edge.confidence.toFixed(2)})${what ? `: ${what}` : ""}. This is an inference that needs expert review.`;
      simple = es ? `El atlas cree que ${a} y ${b} podrían parecerse. Un experto debe revisarlo.` : `The atlas thinks ${a} and ${b} may be alike. An expert needs to check this.`;
      break;
    }
    default:
      text = `${a} → ${b}.`; simple = text;
  }

  if (edge.kind === "extracted") {
    const pmid = edge.evidence[0].external_id;
    text = es ? `Un artículo (${pmid}) reporta, según una extracción con IA: ${text.replace(/^Según [^,]+, /, "")} Necesita revisión de un experto.`
              : `A paper (${pmid}) reports, per an AI extraction: ${text.replace(/^According to [^,]+, /, "")} This needs expert review.`;
    simple = es ? `Un artículo podría decir esto; la IA lo leyó y un experto debe revisarlo.` : `A paper may say this; AI read it and an expert needs to check it.`;
  }

  return { id, kind: "edge", status: statusOf(edge), text, simple, evidence_ids: edge.evidence.map((e) => e.id), nodes: [edge.from, edge.to], edges: [edge.id] };
}

/** Facts for a set of edge ids, in the order given. Unknown or non-evidence edges are reported, never invented. */
export function edgeFacts(idx: AtlasIndex, edgeIds: string[], l: L): { facts: Fact[]; unknown: string[]; skipped: string[] } {
  const facts: Fact[] = []; const unknown: string[] = []; const skipped: string[] = [];
  for (const id of [...new Set(edgeIds)]) {
    const e = idx.edgeById.get(id);
    if (!e) { unknown.push(id); continue; }
    const f = edgeFact(idx, e, `f${facts.length + 1}`, l);
    if (f) facts.push(f); else skipped.push(id);
  }
  return { facts, unknown, skipped };
}

/** Names of the entities touched by the facts: allowed to contain words like "Cure" (org names). */
export function namesOf(idx: AtlasIndex, facts: Fact[]) {
  return [...new Set(facts.flatMap((f) => f.nodes).map((n) => idx.byId.get(n)?.name).filter((x): x is string => !!x))];
}
