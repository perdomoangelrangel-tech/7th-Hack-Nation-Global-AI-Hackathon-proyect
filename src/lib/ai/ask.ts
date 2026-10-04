/**
 * Free-text questions (POST /api/ask). Resolve the disease strictly (focus → mention in the question),
 * then answer from that disease's verified narration, ordered by what the question asks about.
 * Unknown disease → an honest "not in the atlas" with zero claims. Requests for doses, prognosis,
 * outcome promises or personal data get a fixed safety notice (never model-written).
 */
import type { PersonaId } from "../agents/profiles";
import { disclaimer } from "../verifier";
import { diseaseFor, findDiseaseInText } from "./reconcile";
import type { AtlasIndex, Locale } from "./types";
import type { AskAnswer, AskClaim, SafetyFlag } from "./contract";

export type { AskAnswer, AskClaim, SafetyFlag };


const FLAGS: [SafetyFlag, RegExp][] = [
  ["dose", /\b(doses?|dosage|dosing|how much .*(?:give|take)|mg\b|mg\/kg|dosis|cu[aá]ntos? mg|cu[aá]nto .*(?:doy|dar|tomar))/i],
  ["prognosis", /\b(how long .*live|life expectancy|survival|prognosis|will (?:she|he|they|my \w+) (?:live|die)|cu[aá]ntos años .*vivir|esperanza de vida|pron[oó]stico|va a vivir)/i],
  ["promise", /\b(cure|cures|cured|promise|guarantee|definitive|cura\b|curar|prometas?|garantiza|definitiva)/i],
  ["personal_data", /\b(phone|telephone|e-?mail|address|home|tel[eé]fono|correo|direcci[oó]n|name of (?:a|the) patient|nombre .*paciente|paciente .*nombre)/i],
];

export function safetyFlags(question: string): SafetyFlag[] {
  return FLAGS.filter(([, re]) => re.test(question)).map(([f]) => f);
}

/** Fixed text, never drafted by a model. Deliberately free of dose units and cure vocabulary. */
export function safetyNotice(flags: SafetyFlag[], l: Locale): string | null {
  if (!flags.length) return null;
  return l === "es"
    ? "No puedo dar dosis, pronósticos para una persona, promesas de resultados ni datos personales de pacientes; eso le corresponde a tu equipo médico. Esto es lo que sí dicen nuestras fuentes."
    : "I can't give doses, predictions for one person, promises about outcomes or personal details about patients; that belongs with your care team. Here is what our sources do say.";
}


/** focus (entity id) wins; otherwise the strict resolver over the question text. */
/**
 * Which disease a chat turn is about: a disease/gene named in the question wins (the user changed topic), then the
 * entity on screen (`focus`), then the most recent turn of the conversation that named one ("and trials?").
 */
export function resolveQuestion(idx: AtlasIndex, question: string, focus?: string | null, history: { role: string; text: string }[] = []): { disease: string; via: AskAnswer["resolved_via"] } | null {
  const r = findDiseaseInText(idx, question);
  if (r) return { disease: r.disease, via: r.via };
  if (focus) {
    const d = diseaseFor(idx, focus);
    if (d) return { disease: d, via: { mention: focus, entity_id: focus, type: idx.byId.get(focus)?.type ?? "disease", method: "focus", matched_synonym: null } };
  }
  for (const turn of [...history].reverse().slice(0, 10)) {
    const h = findDiseaseInText(idx, turn.text);
    if (h) return { disease: h.disease, via: { ...h.via, method: "history" as const } };
  }
  return null;
}

export function notFound(idx: AtlasIndex, question: string, persona: PersonaId, l: Locale, simple: boolean): AskAnswer {
  const names = idx.snap.entities.filter((e) => e.type === "disease").map((e) => (typeof e.props.short_name === "string" ? e.props.short_name : e.name)).sort();
  const flags = safetyFlags(question);
  const msg = l === "es"
    ? `No encontré esa enfermedad, gen o sinónimo en el atlas, así que no voy a adivinar. Hoy el atlas cubre ${names.length} enfermedades raras: ${names.join(", ")}.`
    : `I could not find that disease, gene or synonym in the atlas, so I won't guess. The atlas currently covers ${names.length} rare diseases: ${names.join(", ")}.`;
  const notice = safetyNotice(flags, l);
  return {
    question, persona, disease: null, disease_name: null, resolved_via: null, claims: [], dropped: [], mode: "deterministic", model: null, simple,
    notice, safety_flags: flags, spoken: [notice, msg, disclaimer(l)].filter(Boolean).join(" "), verified: true, disclaimer: disclaimer(l),
  };
}
