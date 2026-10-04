/**
 * Medicine summary (GET /api/medicine): 3–5 plain-language sentences about one treatment, built ONLY from graph
 * facts — drug type and mechanism (Open Targets), approved indications and trial stages (Open Targets,
 * ClinicalTrials.gov). No dosing, no efficacy numbers, no recommendations. The last sentence is always the fixed
 * clinician line (never model-written). Same facts → draft → verify core as Explain.
 */
import { structured } from "./client";
import { DraftSchema, factsBlock, templateDraft, verifyDraft, type Fact } from "./draft";
import { SOURCE_LABEL } from "./edge-facts";
import { systemPrompt } from "../agents/prompts";
import { PERSONAS, type PersonaId } from "../agents/profiles";
import type { Edge, Entity } from "../atlas/types";
import type { AtlasIndex, Locale } from "./types";

export const CLINICIAN_LINE = {
  en: "Whether it fits a person is a decision for their clinician.",
  es: "Si es adecuado para una persona lo decide su médico.",
};

export interface MedicineResponse {
  id: string;
  name: string;
  sentences: { text: string; evidence_ids: string[]; kind: "observed" | "notice" }[];
  dropped: { text: string; reason: string }[];
  mode: "openai" | "deterministic";
  model?: string;
  disclaimer: string;
}

/** Efficacy talk is not ours to summarize: percentages, "effective", "reduced seizures by…". */
const EFFICACY_RE = /\d+(?:[.,]\d+)?\s?%|\b(efficacy|effective(?:ly|ness)?|reduc(?:ed|es|ing|tion)\b[^.]*\b(?:seizures?|symptoms?|frequency)|response rate|works? (?:well|better)|improv(?:ed|es|ement) (?:in )?(?:seizures?|symptoms?)|eficacia|eficaz)\b/i;

const phaseText = (e: Edge, es: boolean) => {
  const p = e.props as { phase?: number; stage?: string };
  if (typeof p.phase === "number" && p.phase > 0 && p.phase < 4) return es ? `fase ${p.phase}` : `phase ${p.phase}`;
  const s = String(p.stage ?? "").toLowerCase().replace(/_/g, " ");
  return s && s !== "unknown" ? s : es ? "etapa no indicada" : "stage not stated";
};
const sourcesOf = (e: Edge, es: boolean) => [...new Set(e.evidence.map((v) => SOURCE_LABEL[v.source] ?? v.source))].join(es ? " y " : " and ");

/** Open Targets drug types, in Spanish (unknown types are quoted as the source writes them). */
const DRUG_TYPE_ES: Record<string, string> = {
  "small molecule": "una molécula pequeña", antibody: "un anticuerpo", protein: "una proteína", enzyme: "una enzima",
  oligonucleotide: "un oligonucleótido", "antisense oligonucleotide": "un oligonucleótido antisentido", gene: "una terapia génica", cell: "una terapia celular",
};

/** Resolve "treatment:CHEMBL…", "CHEMBL…" or an exact treatment name. */
export function findTreatment(idx: AtlasIndex, id: string): Entity | null {
  const q = id.trim();
  const direct = idx.byId.get(q) ?? idx.byId.get(`treatment:${q}`);
  if (direct?.type === "treatment") return direct;
  const lower = q.toLowerCase();
  return idx.snap.entities.find((e) => e.type === "treatment" && (e.name.toLowerCase() === lower || e.canonical_id.toLowerCase() === lower)) ?? null;
}

export function medicineFacts(idx: AtlasIndex, t: Entity, l: Locale): Fact[] {
  const es = l === "es";
  const facts: Fact[] = [];
  const push = (f: Omit<Fact, "id">) => { if (f.evidence_ids.length) facts.push({ ...f, id: `f${facts.length + 1}` }); };
  const treats = [...(idx.out.get(t.id) ?? [])].filter((e) => e.relation === "treats" && e.kind !== "proposed" && e.evidence.length);
  const diseaseName = (e: Edge) => { const d = idx.byId.get(e.to); const p = d?.props as { short_name?: string } | undefined; return p?.short_name ?? d?.name ?? e.to; };
  const otEvidence = treats.flatMap((e) => e.evidence.filter((v) => v.source === "opentargets").map((v) => v.id));

  const p = t.props as { drug_type?: string; mechanism?: string; mechanisms?: string[] };
  const mechs = (p.mechanisms?.length ? p.mechanisms : p.mechanism ? [p.mechanism] : []).slice(0, 3);
  if (mechs.length || p.drug_type) push({
    kind: "treatment", status: "observed", nodes: [t.id], edges: [], evidence_ids: otEvidence.slice(0, 3),
    text: es
      ? `${t.name}${p.drug_type ? ` es ${DRUG_TYPE_ES[p.drug_type.toLowerCase()] ?? `un medicamento de tipo «${p.drug_type}»`}` : ""}${mechs.length ? `; Open Targets indica que actúa como ${mechs.join(", ")}` : ""}.`
      : `${t.name}${p.drug_type ? ` is a ${p.drug_type.toLowerCase()}` : ""}${mechs.length ? `; Open Targets lists its mechanism as ${mechs.join(", ")}` : ""}.`,
    simple: es ? `${t.name} es un medicamento${mechs.length ? ` que actúa sobre ${mechs[0].toLowerCase()}` : ""}.` : `${t.name} is a medicine${mechs.length ? ` that works as a ${mechs[0].toLowerCase()}` : ""}.`,
  });

  const approved = treats.filter((e) => e.props.approved === true);
  if (approved.length) push({
    kind: "treatment", status: "observed", nodes: [t.id, ...approved.map((e) => e.to)], edges: approved.map((e) => e.id), evidence_ids: approved.flatMap((e) => e.evidence.map((v) => v.id)),
    text: es ? `Según ${sourcesOf(approved[0], es)}, está aprobado para ${approved.map(diseaseName).join(", ")}.` : `According to ${sourcesOf(approved[0], es)}, it is approved for ${approved.map(diseaseName).join(", ")}.`,
    simple: es ? `Está aprobado para ${approved.map(diseaseName).join(", ")}.` : `It is approved for ${approved.map(diseaseName).join(", ")}.`,
  });

  const studied = treats.filter((e) => e.props.approved !== true).sort((a, b) => Number(b.props.phase ?? 0) - Number(a.props.phase ?? 0)).slice(0, 3);
  for (const e of studied) {
    const stopped = (e.props.stopped_reports as unknown[] | undefined)?.length ? (es ? " Algunos estudios se detuvieron." : " Some studies were stopped.") : "";
    push({
      kind: "treatment", status: "observed", nodes: [t.id, e.to], edges: [e.id], evidence_ids: e.evidence.map((v) => v.id),
      text: es ? `Se está estudiando para ${diseaseName(e)} (${phaseText(e, true)}), según ${sourcesOf(e, es)}; no está aprobado para esa enfermedad.${stopped}`
               : `It is being studied for ${diseaseName(e)} (${phaseText(e, false)}), according to ${sourcesOf(e, es)}; it is not approved for that disease.${stopped}`,
      simple: es ? `Se está probando en estudios para ${diseaseName(e)}. Todavía no está aprobado para eso.` : `It is being tested in studies for ${diseaseName(e)}. It is not approved for that yet.`,
    });
  }
  return facts;
}

export async function medicineSummary(idx: AtlasIndex, req: { id: string; persona: PersonaId; locale: Locale; simple?: boolean }): Promise<MedicineResponse | null> {
  const t = findTreatment(idx, req.id);
  if (!t) return null;
  const l = req.locale;
  const simple = req.simple ?? req.persona === "devon";
  const facts = medicineFacts(idx, t, l);
  const closing = { text: CLINICIAN_LINE[l], evidence_ids: [] as string[], kind: "notice" as const };
  const disclaimer = l === "es" ? "Información con fuentes, no consejo médico. Sin dosis." : "Sourced information, not medical advice. No dosing.";
  const base = { id: t.id, name: t.name, disclaimer };
  if (!facts.length) return { ...base, sentences: [closing], dropped: [], mode: "deterministic" };

  const p = PERSONAS[req.persona];
  const task = l === "es"
    ? `TAREA: resume este medicamento para ${p.name} en 2 a 4 frases, solo con los HECHOS: tipo y mecanismo, para qué está aprobado y para qué se está estudiando (con la fase). Nunca des dosis, cifras de eficacia, porcentajes ni recomendaciones, y no digas que "funciona". No escribas la frase final sobre el médico: se añade sola.`
    : `TASK: summarize this medicine for ${p.name} in 2 to 4 sentences, only from the FACTS: type and mechanism, what it is approved for, and what it is being studied for (with the phase). Never give doses, efficacy figures, percentages or recommendations, and never say it "works". Do not write a closing line about clinicians: it is added automatically.`;
  const llm = await structured({ name: "nedamex_medicine", system: systemPrompt({ persona: req.persona, locale: l, task, simple, explainOnly: true }), input: factsBlock(facts, l), schema: DraftSchema, fast: true });

  const names = [t.name, ...facts.flatMap((f) => f.nodes).map((n) => idx.byId.get(n)?.name ?? "")].filter(Boolean);
  const run = (draft: { text: string; fact_ids: string[] }[]) => {
    const efficacy = draft.filter((s) => EFFICACY_RE.test(s.text)).map((s) => ({ text: s.text, reason: "efficacy_claim" }));
    const v = verifyDraft(draft.filter((s) => !EFFICACY_RE.test(s.text)), facts, l, { allowNames: names, noAdvice: true });
    return { sentences: v.sentences.slice(0, 4), dropped: [...efficacy, ...v.dropped] };
  };
  let mode: MedicineResponse["mode"] = llm.mode;
  let r = run(llm.mode === "openai" ? llm.data.sentences : templateDraft(facts.slice(0, 4), simple));
  if (llm.mode === "openai" && !r.sentences.length) { r = run(templateDraft(facts.slice(0, 4), simple)); mode = "deterministic"; }

  return {
    ...base,
    sentences: [...r.sentences.map((s) => ({ text: s.text, evidence_ids: s.evidence_ids, kind: "observed" as const })), closing],
    dropped: r.dropped, mode, ...(mode === "openai" && llm.mode === "openai" ? { model: llm.model } : {}),
  };
}
