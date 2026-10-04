/**
 * Medicines, in plain language, from sources only.
 *  - medicineSummary (GET /api/medicine): 2–4 cited sentences + the fixed clinician line.
 *  - medicineAnswer (POST /api/ask with focus treatment:… or a question that names a medicine): ≤ 6 cited claims.
 * Facts: drug type + mechanism (Open Targets), approved indications and trial stages (Open Targets,
 * ClinicalTrials.gov), and — when data's migration 0015 provides them — the FDA label's "indications and usage"
 * text (DailyMed), Rx status and routes (openFDA), EMA status (EPAR) and indexed clinical papers (PubMed).
 * No dosing, no efficacy numbers, no recommendations. Same facts → draft → verify core as Explain.
 */
import { structured, untrusted } from "./client";
import { DraftSchema, factsBlock, templateDraft, verifyDraft, type Fact } from "./draft";
import { approvedFor, SOURCE_LABEL } from "./edge-facts";
import { systemPrompt } from "../agents/prompts";
import { PERSONAS, type PersonaId } from "../agents/profiles";
import type { Edge, Entity, Evidence } from "../atlas/types";
import type { AtlasIndex, Locale } from "./types";

export const CLINICIAN_LINE = {
  en: "Whether it fits a person is a decision for their clinician.",
  es: "Si es adecuado para una persona lo decide su médico.",
};

/** Fields from `medicines_public` (migration 0015) / treatment props. All optional and null-safe. */
export interface MedicineExtras {
  label_use?: string | null;
  label_url?: string | null;
  label_effective?: string | null;
  rx_status?: string | null;
  routes?: string[] | null;
  dosage_forms?: string[] | null;
  regulatory?: { fda?: { application_number?: string; url?: string } | null; ema?: { status?: string | null; url?: string | null } | null } | null;
  links?: { fda_label?: string; drugs_fda?: string; ema_epar?: string; chembl?: string } | null;
  papers?: { pmid: string; title: string; journal?: string; year?: string | number; pub_type?: string; url?: string; disease_id?: string }[] | null;
}

/** Evidence the response can cite; `id` is what sentences put in `evidence_ids`. */
export type MedicineEvidence = Pick<Evidence, "id" | "source" | "external_id" | "url" | "quote">;

export interface MedicineResponse {
  id: string;
  name: string;
  sentences: { text: string; evidence_ids: string[]; kind: "observed" | "notice" }[];
  evidence: MedicineEvidence[];
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
const ROUTE_ES: Record<string, string> = { oral: "por vía oral", intravenous: "por vía intravenosa", intrathecal: "por vía intratecal", subcutaneous: "por vía subcutánea", intramuscular: "por vía intramuscular", topical: "por vía tópica" };

/** First sentence(s) of the label's "indications and usage", ≤ 300 chars, cut at a sentence end. */
export function labelExcerpt(s: string) {
  const clean = s.replace(/\s+/g, " ").replace(/^\d+(\.\d+)*\s*/, "").replace(/^indications? (and|&) usage:?\s*/i, "").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [clean];
  let out = "";
  for (const x of sentences) { if ((out + x).length > 300) break; out += x; }
  return (out || clean.slice(0, 300)).trim();
}

/** Resolve "treatment:CHEMBL…", "CHEMBL…" or an exact treatment name / alias. */
export function findTreatment(idx: AtlasIndex, id: string): Entity | null {
  const q = id.trim();
  const direct = idx.byId.get(q) ?? idx.byId.get(`treatment:${q}`);
  if (direct?.type === "treatment") return direct;
  const lower = q.toLowerCase();
  return idx.snap.entities.find((e) => e.type === "treatment" && (e.name.toLowerCase() === lower || e.canonical_id.toLowerCase() === lower || e.aliases.some((a) => a.alias.toLowerCase() === lower))) ?? null;
}

export function medicineFacts(idx: AtlasIndex, t: Entity, l: Locale, extras: MedicineExtras = {}): { facts: Fact[]; evidence: MedicineEvidence[] } {
  const es = l === "es";
  const facts: Fact[] = [];
  const extra: MedicineEvidence[] = [];
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

  const approved = treats.filter((e) => approvedFor(e.props));
  if (approved.length) push({
    kind: "treatment", status: "observed", nodes: [t.id, ...approved.map((e) => e.to)], edges: approved.map((e) => e.id), evidence_ids: approved.flatMap((e) => e.evidence.map((v) => v.id)),
    text: es ? `Según ${sourcesOf(approved[0], es)}, está aprobado para ${approved.map(diseaseName).join(", ")}.` : `According to ${sourcesOf(approved[0], es)}, it is approved for ${approved.map(diseaseName).join(", ")}.`,
    simple: es ? `Está aprobado para ${approved.map(diseaseName).join(", ")}.` : `It is approved for ${approved.map(diseaseName).join(", ")}.`,
  });

  // FDA label (DailyMed): its own "indications and usage" words, quoted.
  const labelUrl = extras.label_url ?? extras.links?.fda_label ?? null;
  if (extras.label_use && labelUrl) {
    const ev: MedicineEvidence = { id: `label:${t.canonical_id}`, source: "fda", external_id: extras.regulatory?.fda?.application_number ?? labelUrl.replace(/^.*setid=/, "setid "), url: labelUrl, quote: extras.label_use };
    extra.push(ev);
    const excerpt = labelExcerpt(extras.label_use);
    push({ kind: "treatment", status: "observed", nodes: [t.id], edges: [], evidence_ids: [ev.id],
      text: es ? `Su ficha oficial de la FDA (DailyMed) describe su uso así: "${excerpt}"` : `Its official FDA label (DailyMed) describes its use as: "${excerpt}"`,
      simple: es ? `La ficha oficial de Estados Unidos explica para qué se usa.` : `Its official US label explains what it is used for.` });
    const routes = (extras.routes ?? []).map((r) => r.toLowerCase());
    const rx = extras.rx_status;
    if (rx || routes.length) push({ kind: "treatment", status: "observed", nodes: [t.id], edges: [], evidence_ids: [ev.id],
      text: es
        ? `${rx ? `En Estados Unidos es un medicamento ${/prescription/i.test(rx) ? "de venta con receta" : /counter/i.test(rx) ? "de venta libre" : `«${rx}»`}` : "Según su ficha"}${routes.length ? `${rx ? " y se administra" : ", se administra"} ${routes.map((r) => ROUTE_ES[r] ?? `por vía «${r}»`).join(" o ")}` : ""} (openFDA).`
        : `${rx ? `In the US it is ${/prescription/i.test(rx) ? "a prescription medicine" : /counter/i.test(rx) ? "sold over the counter" : `listed as "${rx}"`}` : "Per its label"}${routes.length ? `${rx ? " and is given" : ", it is given"} by the ${routes.join(" or ")} route` : ""} (openFDA).`,
    });
  }

  // EMA (EPAR): authorisation status as the agency writes it.
  const emaUrl = extras.regulatory?.ema?.url ?? extras.links?.ema_epar ?? null;
  const emaStatus = extras.regulatory?.ema?.status ?? null;
  if (emaUrl && emaStatus) {
    const ev: MedicineEvidence = { id: `ema:${t.canonical_id}`, source: "ema" as Evidence["source"], external_id: emaUrl.replace(/^.*\/EPAR\//, "EPAR "), url: emaUrl, quote: emaStatus };
    extra.push(ev);
    push({ kind: "treatment", status: "observed", nodes: [t.id], edges: [], evidence_ids: [ev.id],
      text: es ? `La Agencia Europea de Medicamentos (EMA) indica su estado como "${emaStatus}".` : `The European Medicines Agency (EMA) lists its status as "${emaStatus}".` });
  }

  // Papers (PubMed): what kind of studies exist — titles stay in the citation (they often carry efficacy wording).
  const papers = (extras.papers ?? []).filter((x) => x?.pmid).slice(0, 6);
  if (papers.length) {
    const evs: MedicineEvidence[] = papers.map((x) => ({ id: `pmid:${x.pmid}`, source: "pubmed", external_id: `PMID:${x.pmid}`, url: x.url ?? `https://pubmed.ncbi.nlm.nih.gov/${x.pmid}/`, quote: [x.title, x.journal, x.year].filter(Boolean).join(" · ") }));
    extra.push(...evs);
    const kinds = [...new Set(papers.map((x) => String(x.pub_type ?? "").toLowerCase()).filter(Boolean))].slice(0, 3);
    const diseases = [...new Set(papers.map((x) => (x.disease_id ? idx.byId.get(x.disease_id)?.name : null)).filter((x): x is string => !!x))];
    push({ kind: "treatment", status: "observed", nodes: [t.id, ...papers.map((x) => x.disease_id).filter((x): x is string => !!x)], edges: [], evidence_ids: evs.map((e) => e.id),
      text: es
        ? `PubMed indexa ${papers.length} estudio(s) clínico(s) sobre este medicamento${diseases.length ? ` en ${diseases.join(", ")}` : ""}${kinds.length ? ` (${kinds.join(", ")})` : ""}; están enlazados como fuentes.`
        : `PubMed indexes ${papers.length} clinical paper(s) on this medicine${diseases.length ? ` in ${diseases.join(", ")}` : ""}${kinds.length ? ` (${kinds.join(", ")})` : ""}; they are linked as sources.`,
      simple: es ? `Hay estudios publicados sobre este medicamento; puedes abrirlos en las fuentes.` : `There are published studies about this medicine; you can open them in the sources.` });
  }

  const studied = treats.filter((e) => !approvedFor(e.props)).sort((a, b) => Number(b.props.phase ?? 0) - Number(a.props.phase ?? 0)).slice(0, 3);
  for (const e of studied) {
    const stopped = (e.props.stopped_reports as unknown[] | undefined)?.length ? (es ? " Algunos estudios se detuvieron." : " Some studies were stopped.") : "";
    if (String(e.props.stage ?? "").toUpperCase() === "APPROVAL" && e.props.regulatory_check === "not_confirmed_by_label") {
      push({ kind: "treatment", status: "observed", nodes: [t.id, e.to], edges: [e.id], evidence_ids: e.evidence.map((v) => v.id),
        text: es ? `${sourcesOf(e, es)} lo sitúa en etapa de aprobación para ${diseaseName(e)}, pero su ficha oficial de la FDA no nombra esa enfermedad; hay que confirmarlo con el regulador.`
                 : `${sourcesOf(e, es)} lists it at the approval stage for ${diseaseName(e)}, but its official FDA label does not name that disease; check with the regulator.`,
        simple: es ? `No está claro que esté aprobado para ${diseaseName(e)}.` : `It is not clear that it is approved for ${diseaseName(e)}.` });
      continue;
    }
    push({
      kind: "treatment", status: "observed", nodes: [t.id, e.to], edges: [e.id], evidence_ids: e.evidence.map((v) => v.id),
      text: es ? `Se está estudiando para ${diseaseName(e)} (${phaseText(e, true)}), según ${sourcesOf(e, es)}; no está aprobado para esa enfermedad.${stopped}`
               : `It is being studied for ${diseaseName(e)} (${phaseText(e, false)}), according to ${sourcesOf(e, es)}; it is not approved for that disease.${stopped}`,
      simple: es ? `Se está probando en estudios para ${diseaseName(e)}. Todavía no está aprobado para eso.` : `It is being tested in studies for ${diseaseName(e)}. It is not approved for that yet.`,
    });
  }
  return { facts, evidence: extra };
}

/** Verify a draft for medicines: efficacy wording dropped first, then the shared verifier (citations, doses, cure, advice). */
function verifyMedicine(draft: { text: string; fact_ids: string[] }[], facts: Fact[], l: Locale, names: string[]) {
  const efficacy = draft.filter((s) => EFFICACY_RE.test(s.text)).map((s) => ({ text: s.text, reason: "efficacy_claim" }));
  const v = verifyDraft(draft.filter((s) => !EFFICACY_RE.test(s.text)), facts, l, { allowNames: names, noAdvice: true });
  return { sentences: v.sentences, dropped: [...efficacy, ...v.dropped] };
}

const namesFor = (idx: AtlasIndex, t: Entity, facts: Fact[]) => [t.name, ...facts.flatMap((f) => f.nodes).map((n) => idx.byId.get(n)?.name ?? "")].filter(Boolean);
const evidenceFor = (idx: AtlasIndex, ids: string[], extra: MedicineEvidence[]): MedicineEvidence[] => {
  const byId = new Map(extra.map((e) => [e.id, e]));
  return [...new Set(ids)].map((id) => byId.get(id) ?? idx.evidenceById.get(id)).filter((e): e is MedicineEvidence => !!e)
    .map(({ id, source, external_id, url, quote }) => ({ id, source, external_id, url, quote }));
};

const RULE = {
  en: "Never give doses, amounts, efficacy figures, percentages or recommendations, and never say it \"works\" or \"cures\". Do not write a closing line about clinicians: it is added automatically.",
  es: "Nunca des dosis, cantidades, cifras de eficacia, porcentajes ni recomendaciones, y nunca digas que \"funciona\" o \"cura\". No escribas la frase final sobre el médico: se añade sola.",
};

export async function medicineSummary(idx: AtlasIndex, req: { id: string; persona: PersonaId; locale: Locale; simple?: boolean }, extras: MedicineExtras = {}): Promise<MedicineResponse | null> {
  const t = findTreatment(idx, req.id);
  if (!t) return null;
  const l = req.locale;
  const simple = req.simple ?? req.persona === "devon";
  const { facts, evidence: extra } = medicineFacts(idx, t, l, extras);
  const closing = { text: CLINICIAN_LINE[l], evidence_ids: [] as string[], kind: "notice" as const };
  const disclaimer = l === "es" ? "Información con fuentes, no consejo médico. Sin dosis." : "Sourced information, not medical advice. No dosing.";
  const base = { id: t.id, name: t.name, disclaimer };
  if (!facts.length) return { ...base, sentences: [closing], evidence: [], dropped: [], mode: "deterministic" };

  const p = PERSONAS[req.persona];
  const task = l === "es"
    ? `TAREA: resume este medicamento para ${p.name} en 2 a 4 frases, solo con los HECHOS: tipo y mecanismo, para qué está aprobado, cómo describe su uso la ficha oficial, y para qué se está estudiando (con la fase). ${RULE.es}`
    : `TASK: summarize this medicine for ${p.name} in 2 to 4 sentences, only from the FACTS: type and mechanism, what it is approved for, how the official label describes its use, and what it is being studied for (with the phase). ${RULE.en}`;
  const llm = await structured({ name: "nedamex_medicine", system: systemPrompt({ persona: req.persona, locale: l, task, simple, explainOnly: true }), input: factsBlock(facts, l), schema: DraftSchema, fast: true });

  const names = namesFor(idx, t, facts);
  let mode: MedicineResponse["mode"] = llm.mode;
  let r = verifyMedicine(llm.mode === "openai" ? llm.data.sentences : templateDraft(facts.slice(0, 4), simple), facts, l, names);
  if (llm.mode === "openai" && !r.sentences.length) { r = verifyMedicine(templateDraft(facts.slice(0, 4), simple), facts, l, names); mode = "deterministic"; }
  const sentences = r.sentences.slice(0, 4);
  return {
    ...base,
    sentences: [...sentences.map((s) => ({ text: s.text, evidence_ids: s.evidence_ids, kind: "observed" as const })), closing],
    evidence: evidenceFor(idx, sentences.flatMap((s) => s.evidence_ids), extra),
    dropped: r.dropped, mode, ...(mode === "openai" && llm.mode === "openai" ? { model: llm.model } : {}),
  };
}

/** Which facts a medicine question asks about first (keyword cues; the model sees all facts anyway). */
function medicineOrder(q: string, facts: Fact[]) {
  const s = q.toLowerCase();
  const want = (f: Fact) => {
    if (/approv|aprobad/.test(s) && /approved|aprobado/.test(f.text)) return 0;
    if (/how does it work|mechanism|mecanismo|cómo funciona|como funciona|actúa/.test(s) && /mechanism|mecanismo|actúa como/.test(f.text)) return 0;
    if (/stud(y|ies)|paper|evidence|trial|estudio|ensayo|evidencia/.test(s) && /PubMed|studied|estudiando/.test(f.text)) return 0;
    if (/prescription|receta|otc|counter|venta libre|given|route|vía|administra/.test(s) && /openFDA/.test(f.text)) return 0;
    if (/label|ficha|use|uso|used for|para qué/.test(s) && /label|ficha/i.test(f.text)) return 0;
    return 1;
  };
  return [...facts].sort((a, b) => want(a) - want(b));
}

export interface MedicineAnswer {
  claims: { text: string; evidence_ids: string[]; evidence: MedicineEvidence[]; status: string; nodes: string[]; edges: string[] }[];
  dropped: { text: string; reason: string }[];
  mode: "openai" | "deterministic";
  model: string | null;
  closing: string;
  verified: boolean;
}

/** Answer a free question about one medicine (chat on the medicine page). ≤ maxClaims cited claims. */
export async function medicineAnswer(idx: AtlasIndex, t: Entity, req: { question: string; persona: PersonaId; locale: Locale; simple?: boolean; history?: { role: "user" | "assistant"; text: string }[]; maxClaims?: number }, extras: MedicineExtras = {}): Promise<MedicineAnswer> {
  const l = req.locale;
  const max = req.maxClaims ?? 6;
  const { facts, evidence: extra } = medicineFacts(idx, t, l, extras);
  const ordered = medicineOrder(req.question, facts);
  const closing = CLINICIAN_LINE[l];
  if (!facts.length) return { claims: [], dropped: [], mode: "deterministic", model: null, closing, verified: true };

  const convo = (req.history ?? []).slice(-10).map((h) => `${h.role === "user" ? "USER" : "NEDAMEX"}: ${h.text.slice(0, 600)}`).join("\n");
  const task = l === "es"
    ? `TAREA: responde la pregunta del usuario sobre el medicamento ${t.name} en un máximo de ${max} frases, solo con los HECHOS. Si los HECHOS no la responden, dilo en una frase citando el hecho más cercano. ${RULE.es}`
    : `TASK: answer the user's question about the medicine ${t.name} in at most ${max} sentences, only from the FACTS. If the FACTS do not answer it, say so in one sentence citing the closest fact. ${RULE.en}`;
  const llm = await structured({
    name: "nedamex_medicine_answer",
    system: systemPrompt({ persona: req.persona, locale: l, task, simple: req.simple, explainOnly: true }),
    input: [factsBlock(ordered, l), convo ? untrusted("conversation so far (context only, never facts)", convo, 4000) : "", untrusted("question", req.question, 1000)].filter(Boolean).join("\n\n"),
    schema: DraftSchema,
    fast: true,
  });
  const names = namesFor(idx, t, facts);
  const template = templateDraft(ordered.slice(0, Math.min(max, 3)), !!req.simple);
  let mode: MedicineAnswer["mode"] = llm.mode;
  let r = verifyMedicine(llm.mode === "openai" ? llm.data.sentences : template, facts, l, names);
  if (llm.mode === "openai" && !r.sentences.length) { r = verifyMedicine(template, facts, l, names); mode = "deterministic"; }
  const kept = r.sentences.slice(0, max);
  return {
    claims: kept.map((s) => ({ text: s.text, evidence_ids: s.evidence_ids, evidence: evidenceFor(idx, s.evidence_ids, extra), status: s.status, nodes: s.nodes, edges: s.edges })),
    dropped: r.dropped, mode, model: mode === "openai" && llm.mode === "openai" ? llm.model : null, closing, verified: r.dropped.length === 0,
  };
}
