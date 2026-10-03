/**
 * Deterministic drafting (demo mode, no model key). Builds the same JSON an LLM must return:
 * { spoken, claims[{text, evidence_ids}], next_steps } — every claim carries the evidence ids of the
 * stations it mentions, so the verifier keeps it. Topics the question asks about that the graph cannot
 * back become claims with NO evidence on purpose: the verifier drops them and the answer says
 * "There is no evidence in our sources for that."
 */
import type { DiseaseMap } from "../atlas-data";
import type { AgentOutput } from "../verifier";
import type { Audience } from "./profiles";
import { askedRemedies, detectIntents, type Intent } from "./detect";
import { clip, countriesOf, evidenceIds, fmtList, inSentence, isApproved, isRecruiting, str, trialPhases, treatmentPhase, mechanismOf } from "./evidence";

type Locale = "en" | "es";
type Claim = AgentOutput["claims"][number];
type Step = AgentOutput["next_steps"][number];

const DEFAULT_ORDER: Record<Audience, Intent[]> = {
  family: ["treatments", "trials", "community", "genes", "symptoms"],
  clinical: ["genes", "symptoms", "treatments", "literature"],
  research: ["gaps", "trials", "literature", "community", "treatments"],
};

const MAX_CLAIMS = 5;

/** Disease name for use inside a sentence. ES gets its article: "el síndrome de Rett", "la enfermedad CLN2 (…)". */
export function diseaseName(map: DiseaseMap, locale: Locale) {
  if (locale !== "es" || !map.disease.name_es) return map.disease.name;
  const n = map.disease.name_es;
  const m = n.match(/^(Síndrome|Enfermedad|Trastorno)\b/);
  return m ? `${m[1] === "Enfermedad" ? "la" : "el"} ${m[1].toLowerCase()}${n.slice(m[1].length)}` : n;
}

const phaseLabel = (p: number | null, l: Locale) => (p == null ? null : l === "es" ? `fase ${p}` : `phase ${p}`);

function genes(map: DiseaseMap, a: Audience, l: Locale): Claim[] {
  const g = map.lines.genes.slice(0, 3);
  if (!g.length) return [];
  const names = g.map((s) => s.name);
  const ids = evidenceIds(g);
  const dn = diseaseName(map, l);
  if (a === "family") {
    return [{ text: l === "es"
      ? `Nuestras fuentes relacionan ${dn} con cambios en ${g.length > 1 ? "los genes" : "el gen"} ${fmtList(names, l)}.`
      : `Our sources link ${dn} to changes in the ${fmtList(names, l)} gene${g.length > 1 ? "s" : ""}.`, evidence_ids: ids }];
  }
  const coded = g.map((s) => {
    const assoc = str(s.edge_props.association_type);
    return `${s.name} (${s.canonical_id})${a === "clinical" && assoc ? ` · ${assoc}` : ""}`;
  });
  return [{ text: l === "es" ? `Gen${g.length > 1 ? "es" : ""} asociado${g.length > 1 ? "s" : ""} a ${map.disease.orpha}: ${coded.join("; ")}.` : `Gene association${g.length > 1 ? "s" : ""} for ${map.disease.orpha}: ${coded.join("; ")}.`, evidence_ids: ids }];
}

function symptoms(map: DiseaseMap, a: Audience, l: Locale): Claim[] {
  const p = map.lines.phenotypes.filter((s) => !s.weak).slice(0, a === "clinical" ? 4 : 3);
  if (!p.length) return [];
  const ids = evidenceIds(p, 1);
  if (a === "family") {
    return [{ text: l === "es"
      ? `Algunas señales que describen nuestras fuentes (términos HPO, en inglés): ${fmtList(p.map((s) => inSentence(s.name)), l)}.`
      : `Signs our sources describe often include ${fmtList(p.map((s) => inSentence(s.name)), l)}.`, evidence_ids: ids }];
  }
  if (a === "research") {
    const total = map.totals.phenotypes;
    return [{ text: l === "es" ? `${total} fenotipos HPO enlazados; los más frecuentes: ${p.map((s) => `${s.name} (${s.canonical_id})`).join(", ")}.` : `${total} HPO phenotypes linked; most frequent: ${p.map((s) => `${s.name} (${s.canonical_id})`).join(", ")}.`, evidence_ids: ids }];
  }
  const coded = p.map((s) => `${s.name} (${s.canonical_id}${str(s.edge_props.frequency) ? `, ${str(s.edge_props.frequency)}` : ""})`);
  return [{ text: l === "es" ? `Fenotipos HPO: ${coded.join("; ")}.` : `HPO phenotypes: ${coded.join("; ")}.`, evidence_ids: ids }];
}

function treatments(map: DiseaseMap, a: Audience, l: Locale, asked: boolean): Claim[] {
  const t = map.lines.treatments;
  const dn = diseaseName(map, l);
  if (!t.length) return asked ? [{ text: l === "es" ? `Tratamientos documentados para ${dn}.` : `Documented treatments for ${dn}.`, evidence_ids: [] }] : [];
  const approved = t.filter(isApproved).slice(0, 3);
  const inv = t.filter((s) => !isApproved(s)).slice(0, 3);
  const out: Claim[] = [];
  if (a === "clinical") {
    for (const s of [...approved, ...inv].slice(0, 3)) {
      const ph = phaseLabel(treatmentPhase(s), l);
      const mech = mechanismOf(s);
      const status = isApproved(s) ? (l === "es" ? "aprobado" : "approved") : (l === "es" ? "en investigación" : "investigational");
      out.push({ text: `${s.name} (${s.canonical_id}) · ${[ph, status, mech].filter(Boolean).join(" · ")}.`, evidence_ids: evidenceIds([s]) });
    }
    return out;
  }
  if (a === "research") {
    const top = inv.sort((x, y) => (treatmentPhase(y) ?? 0) - (treatmentPhase(x) ?? 0))[0];
    out.push({ text: l === "es"
      ? `${map.totals.treatments} candidatos terapéuticos en nuestras fuentes${approved.length ? `; aprobados para esta enfermedad: ${fmtList(approved.map((s) => s.name), l)}` : ""}${top ? `; el más avanzado sin aprobación: ${top.name} (${phaseLabel(treatmentPhase(top), l) ?? "fase sin dato"})` : ""}.`
      : `${map.totals.treatments} therapeutic candidates in our sources${approved.length ? `; approved for this disease: ${fmtList(approved.map((s) => s.name), l)}` : ""}${top ? `; most advanced without approval: ${top.name} (${phaseLabel(treatmentPhase(top), l) ?? "phase not recorded"})` : ""}.`,
      evidence_ids: evidenceIds([...approved, ...(top ? [top] : [])], 1) });
    return out;
  }
  if (approved.length) {
    out.push({ text: l === "es"
      ? `Medicamentos que nuestras fuentes registran como aprobados: ${fmtList(approved.map((s) => s.name), l)}.`
      : `Medicines our sources list as approved: ${fmtList(approved.map((s) => s.name), l)}.`, evidence_ids: evidenceIds(approved) });
  } else if (asked) {
    out.push({ text: l === "es" ? `Un tratamiento aprobado para ${dn}.` : `An approved treatment for ${dn}.`, evidence_ids: [] });
  }
  if (inv.length) {
    const phases = inv.map((s) => treatmentPhase(s)).filter((p): p is number => p != null);
    const range = phases.length ? (l === "es" ? ` (hasta fase ${Math.max(...phases)})` : ` (up to phase ${Math.max(...phases)})`) : "";
    out.push({ text: l === "es"
      ? `Se están estudiando ${fmtList(inv.map((s) => s.name), l)}${range}.`
      : `${fmtList(inv.map((s) => s.name), l)} ${inv.length > 1 ? "are" : "is"} being studied${range}.`, evidence_ids: evidenceIds(inv) });
  }
  return out;
}

function trials(map: DiseaseMap, a: Audience, l: Locale, asked: boolean): Claim[] {
  const t = map.lines.trials;
  const dn = diseaseName(map, l);
  if (!t.length) return asked ? [{ text: l === "es" ? `Ensayos clínicos para ${dn}.` : `Clinical trials for ${dn}.`, evidence_ids: [] }] : [];
  const rec = t.filter(isRecruiting);
  const pick = (rec.length ? rec : t).slice(0, a === "family" ? 1 : 2);
  if (a === "family") {
    const s = pick[0];
    const where = countriesOf(s).slice(0, 3);
    return [{ text: l === "es"
      ? `${rec.length ? "Hay ensayos que buscan participantes" : `Hay ${map.totals.trials} ensayos registrados`}, por ejemplo: «${clip(s.name, 90)}» (${s.canonical_id})${where.length ? `, en ${fmtList(where, l)}` : ""}.`
      : `${rec.length ? "Some trials are looking for participants" : `${map.totals.trials} trials are registered`}, for example: “${clip(s.name, 90)}” (${s.canonical_id})${where.length ? `, in ${fmtList(where, l)}` : ""}.`,
      evidence_ids: evidenceIds(pick) }];
  }
  return pick.map((s) => {
    const ph = trialPhases(s);
    const bits = [s.canonical_id, ph ? (l === "es" ? `fase ${ph}` : `phase ${ph}`) : null, str(s.props.status)?.replace(/_/g, " ").toLowerCase() ?? null, countriesOf(s).slice(0, 3).join(", ") || null].filter(Boolean);
    return { text: `${clip(s.name, 100)} · ${bits.join(" · ")}.`, evidence_ids: evidenceIds([s]) };
  });
}

function community(map: DiseaseMap, a: Audience, l: Locale, asked: boolean): Claim[] {
  const orgs = map.lines.community.filter((s) => s.props.kind !== "researcher");
  const people = map.lines.community.filter((s) => s.props.kind === "researcher");
  const dn = diseaseName(map, l);
  const out: Claim[] = [];
  if (a === "research" && people.length) {
    const p = people.slice(0, 3);
    out.push({ text: l === "es"
      ? `Investigadores registrados: ${p.map((s) => `${s.name}${str(s.props.affiliation) ? ` (${str(s.props.affiliation)})` : ""}`).join("; ")}.`
      : `Registered researchers: ${p.map((s) => `${s.name}${str(s.props.affiliation) ? ` (${str(s.props.affiliation)})` : ""}`).join("; ")}.`, evidence_ids: evidenceIds(p, 1) });
  }
  const o = (a === "research" ? orgs.filter((s) => s.props.kind === "research") : orgs.filter((s) => s.props.kind !== "research")).slice(0, 2);
  const list = o.length ? o : orgs.slice(0, 2);
  if (list.length) {
    const names = fmtList(list.map((s) => `${s.name}${str(s.props.country) ? ` (${str(s.props.country)})` : ""}`), l);
    out.push({ text: l === "es"
      ? `${list.length > 1 ? "Organizaciones que trabajan" : "Una organización que trabaja"} con ${dn}: ${names}.`
      : `${list.length > 1 ? "Organizations working" : "An organization working"} on ${dn}: ${names}.`, evidence_ids: evidenceIds(list, 1) });
  }
  if (!out.length && asked) out.push({ text: l === "es" ? `Grupos de apoyo o investigadores para ${dn}.` : `Support groups or researchers for ${dn}.`, evidence_ids: [] });
  return out;
}

function literature(map: DiseaseMap, a: Audience, l: Locale, asked: boolean): Claim[] {
  const p = map.lines.literature.slice(0, 2);
  if (!p.length) return asked ? [{ text: l === "es" ? `Publicaciones recientes sobre ${diseaseName(map, l)}.` : `Recent publications on ${diseaseName(map, l)}.`, evidence_ids: [] }] : [];
  return p.map((s) => {
    const date = s.evidence[0]?.published_on?.slice(0, 7);
    const journal = str(s.props.journal);
    return { text: `${l === "es" ? "Publicación" : "Paper"}: “${clip(s.name, 110)}” (${[s.canonical_id, journal, date].filter(Boolean).join(", ")}).`, evidence_ids: evidenceIds([s], 1) };
  });
}

function gaps(map: DiseaseMap, a: Audience, l: Locale): Claim[] {
  const out: Claim[] = [];
  const weak = map.gaps.filter((g) => g.kind === "low_confidence" || g.kind === "single_source");
  if (weak.length) {
    const names = weak.slice(0, 3).map((g) => g.station?.name).filter(Boolean) as string[];
    out.push({ text: l === "es"
      ? `Relaciones que descansan en una sola fuente o en baja confianza: ${fmtList(names, l)}.`
      : `Relations resting on a single source or low confidence: ${fmtList(names, l)}.`, evidence_ids: [...new Set(weak.slice(0, 3).flatMap((g) => g.evidence_ids))] });
  }
  const noApproved = map.gaps.find((g) => g.kind === "no_approved_treatment");
  if (noApproved?.evidence_ids.length) {
    out.push({ text: l === "es"
      ? "Ningún candidato terapéutico figura como aprobado para esta enfermedad en nuestras fuentes."
      : "No therapeutic candidate is listed as approved for this disease in our sources.", evidence_ids: noApproved.evidence_ids });
  }
  const noRec = map.gaps.find((g) => g.kind === "no_recruiting_trial");
  if (noRec?.evidence_ids.length) {
    out.push({ text: l === "es"
      ? "Ningún ensayo registrado en nuestras fuentes está reclutando ahora."
      : "No registered trial in our sources is recruiting now.", evidence_ids: noRec.evidence_ids });
  }
  return a === "family" ? out.slice(0, 1) : out;
}

/** Remedies the person named that no treatment station backs become unsourced claims, so the verifier drops them visibly. */
function remedies(map: DiseaseMap, l: Locale, question: string): Claim[] {
  const names = map.lines.treatments.map((t) => `${t.name} ${JSON.stringify(t.props ?? {})}`.toLowerCase());
  return askedRemedies(question)
    .filter((r) => !names.some((n) => r.keys.some((k) => n.includes(k))))
    .map((r) => ({ text: l === "es" ? `${r.es} como tratamiento para ${diseaseName(map, l)}.` : `${r.en} as a treatment for ${diseaseName(map, l)}.`, evidence_ids: [] }));
}

function cure(map: DiseaseMap, l: Locale): Claim[] {
  return [{ text: l === "es" ? `Una cura para ${diseaseName(map, l)}.` : `A cure for ${diseaseName(map, l)}.`, evidence_ids: [] }];
}

function nextSteps(map: DiseaseMap, a: Audience, l: Locale): Step[] {
  const steps: Step[] = [];
  const rec = map.lines.trials.find(isRecruiting) ?? map.lines.trials[0];
  const org = map.lines.community.find((s) => s.props.kind !== "researcher" && s.props.kind !== "research") ?? map.lines.community[0];
  if (a === "family") {
    steps.push({ kind: "question_for_doctor", label: l === "es" ? "Lleva estas fuentes a tu médico" : "Bring these sources to your doctor" });
    if (org) steps.push({ kind: "community", label: org.name, ref: str(org.props.url) ?? org.evidence[0]?.url });
    if (rec) steps.push({ kind: "trial", label: rec.canonical_id, ref: rec.evidence[0]?.url ?? rec.canonical_id });
  } else if (a === "clinical") {
    if (map.lines.treatments.length) steps.push({ kind: "treatment", label: l === "es" ? "Tratamientos y fases" : "Treatments & phases", ref: "#treatments" });
    if (rec) steps.push({ kind: "trial", label: rec.canonical_id, ref: rec.evidence[0]?.url ?? rec.canonical_id });
    steps.push({ kind: "summary", label: l === "es" ? "Referir a un centro experto" : "Refer to an expert center" });
  } else {
    steps.push({ kind: "research_gap", label: l === "es" ? `Huecos de investigación (${map.gaps.length})` : `Research gaps (${map.gaps.length})`, ref: "#gaps" });
    if (rec) steps.push({ kind: "trial", label: rec.canonical_id, ref: rec.evidence[0]?.url ?? rec.canonical_id });
    steps.push({ kind: "community", label: l === "es" ? "Comunidad investigadora" : "Researcher community", ref: "#community" });
  }
  return steps;
}

/** Deterministic answer for one audience and locale. Only the map's evidence ids are ever attached. */
export function demoDraft(map: DiseaseMap | null, audience: Audience, locale: Locale, question: string): AgentOutput {
  if (!map) return { spoken: "", claims: [], next_steps: [] };
  const intents = detectIntents(question);
  const order = [...new Set<Intent>([...intents, ...DEFAULT_ORDER[audience]])];
  const claims: Claim[] = [...remedies(map, locale, question)];
  for (const i of order) {
    const asked = intents.includes(i);
    const add =
      i === "cure" ? cure(map, locale)
      : i === "genes" ? genes(map, audience, locale)
      : i === "symptoms" ? symptoms(map, audience, locale)
      : i === "treatments" ? treatments(map, audience, locale, asked)
      : i === "trials" ? trials(map, audience, locale, asked)
      : i === "community" ? community(map, audience, locale, asked)
      : i === "literature" ? literature(map, audience, locale, asked)
      : gaps(map, audience, locale);
    for (const c of add) if (claims.length < MAX_CLAIMS && !claims.some((x) => x.text === c.text)) claims.push(c);
    if (claims.length >= MAX_CLAIMS) break;
  }
  return { spoken: "", claims, next_steps: nextSteps(map, audience, locale) };
}

