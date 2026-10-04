/**
 * Guide chat (text) → POST /api/ask. OWNER: voice lane. Pure helpers + the fetch, no React.
 * Every answer shown is the verified /api/ask output (claims with evidence); nothing is invented client-side.
 */
import type { PersonaId } from "../agents/profiles";
import type { Locale } from "../i18n";
import type { AskAnswer, AskClaim } from "../ai/contract";

export const MAX_TURNS = 10;

export interface ChatTurn {
  id: number;
  role: "user" | "guide";
  text: string;
  claims?: AskClaim[];
  notice?: string | null;
  empty?: boolean;      // the graph had nothing for this question
  error?: boolean;
  via?: "text" | "voice";
}

/** Keep the last MAX_TURNS turns (a turn = one message). */
export function trimTurns<T extends ChatTurn>(turns: T[], max = MAX_TURNS): T[] {
  return turns.length > max ? turns.slice(-max) : turns;
}

/** History sent to /api/ask (ai lane accepts it from WAVE 6; older servers ignore the field). */
export function toHistory(turns: ChatTurn[]): { role: "user" | "assistant"; content: string }[] {
  return trimTurns(turns).filter((t) => !t.error).map((t) => ({ role: t.role === "user" ? "user" : "assistant", content: t.text }));
}

/** Three starter questions per mode (questions only; answers always come from the graph). */
export const SUGGESTIONS: Record<PersonaId, { en: string[]; es: string[] }> = {
  devon: {
    en: ["Is there a patient group for this disease?", "What does this diagnosis mean in plain words?", "Are there studies near me?"],
    es: ["¿Hay un grupo de pacientes para esta enfermedad?", "¿Qué significa este diagnóstico en palabras sencillas?", "¿Hay estudios cerca de mí?"],
  },
  maria: {
    en: ["Which diseases share a mechanism with this one?", "What already exists that we could reuse?", "Who should we contact this week?"],
    es: ["¿Qué enfermedades comparten mecanismo con esta?", "¿Qué existe ya que podamos reutilizar?", "¿A quién deberíamos contactar esta semana?"],
  },
  osei: {
    en: ["What is the evidence behind the closest neighbor disease?", "Which papers does the atlas cite for this gene?", "Who already works on the neighbor disease?"],
    es: ["¿Qué evidencia hay detrás de la enfermedad vecina más cercana?", "¿Qué artículos cita el atlas para este gen?", "¿Quién trabaja ya en la enfermedad vecina?"],
  },
  priya: {
    en: ["Which approved medicines are linked to this mechanism?", "What trials are active for this disease?", "What is the unmet need here?"],
    es: ["¿Qué medicamentos aprobados se vinculan a este mecanismo?", "¿Qué ensayos están activos para esta enfermedad?", "¿Cuál es la necesidad no cubierta aquí?"],
  },
};

export function suggestions(persona: PersonaId, locale: Locale): string[] {
  return SUGGESTIONS[persona][locale === "es" ? "es" : "en"];
}

/** Turn a verified /api/ask answer into a guide turn. Empty claims = "not in the graph". */
export function answerToTurn(a: AskAnswer, id: number, notFoundText: string): ChatTurn {
  if (!a.claims.length) return { id, role: "guide", text: notFoundText, empty: true, notice: a.notice };
  return { id, role: "guide", text: a.claims.map((c) => c.text).join(" "), claims: a.claims, notice: a.notice };
}

export async function askGraph(
  o: { question: string; persona: PersonaId; locale: Locale; focus?: string | null; history: ChatTurn[]; simple?: boolean },
  signal?: AbortSignal,
): Promise<AskAnswer> {
  const r = await fetch("/api/ask", {
    method: "POST", headers: { "content-type": "application/json" }, signal,
    body: JSON.stringify({
      question: o.question, persona: o.persona, locale: o.locale, simple: o.simple,
      ...(o.focus ? { focus: o.focus } : {}), history: toHistory(o.history),
    }),
  });
  if (!r.ok) throw new Error(`ask ${r.status}`);
  return (await r.json()) as AskAnswer;
}
