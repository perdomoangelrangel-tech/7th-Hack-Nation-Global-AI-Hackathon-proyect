/**
 * Home (S0) copy, EN + ES. OWNER: mvp-builder. Exact UI strings from UX_WAVE4 §2 S0 / §4.6.
 * Kept here (not in lib/i18n.ts) so the Home lane never conflicts with the atlas dictionary.
 */
import type { PersonaId } from "@/lib/agents/profiles";
import type { Locale } from "@/lib/i18n";

export interface RoleCopy { title: string; persona: string; get: string; example: string; greeting: string }

interface HomeCopy {
  title: string; lead: string;
  try_label: string;
  who: string; who_hint: string; greeting_default: string;
  maria_cta: string; maria_aria: string;
  explore_as: (name: string) => string;
  steps: [string, string, string];
  steps_label: string;
  footer: (d: number, s: number) => string;
  welcome_back: string; continue_with: (name: string) => string; dismiss: string;
  help: string; lang_aria: string; example_label: string;
  example_none: (q: string) => string;
  roles: Record<PersonaId, RoleCopy>;
}

export const ROLE_ORDER: PersonaId[] = ["devon", "maria", "osei", "priya"];

/** Example searches under the box — each verified to resolve to a disease (gene · name · symptom · synonym). */
export const EXAMPLES = ["STXBP1", "Dravet", "hand wringing", "SMEI"];

export const homeCopy: Record<Locale, HomeCopy> = {
  en: {
    title: "Every rare disease is a point of light.",
    lead: "Find who shares your disease's biology, what already exists and what to do next — every link with its source.",
    try_label: "Try:",
    who: "Who are you?", who_hint: "You can switch anytime.",
    greeting_default: "Pick the one closest to you — the atlas changes what it shows first.",
    maria_cta: "Try Maria's case: STXBP1 — 60 seconds",
    maria_aria: "Try Maria's case: open the STXBP1 route as a patient group leader",
    explore_as: (name) => `Explore the atlas as ${name}`,
    steps: ["Search", "Follow your route", "Tap any line to see the proof"],
    steps_label: "How it works",
    footer: (d, s) => `Not medical advice · ${d} diseases · ${s} open sources`,
    welcome_back: "Welcome back", continue_with: (name) => `Continue with ${name}`, dismiss: "Dismiss",
    help: "Help", lang_aria: "Cambiar a español", example_label: "Example searches",
    example_none: (q) => `No match for “${q}” yet.`,
    roles: {
      devon: { title: "Patient or caregiver", persona: "e.g. Devon", get: "Understand it in plain words and find people like you", example: "“Is there a community for my exact diagnosis?”", greeting: "Take your time. We'll start with plain words and people like you." },
      maria: { title: "Family & patient group", persona: "e.g. Maria", get: "Partners, a reusable asset and a next step", example: "“Which disease shares our mechanism, and who do we call?”", greeting: "Let's find your next step — and who could take it with you." },
      osei: { title: "Researcher", persona: "e.g. Dr. Osei", get: "Who else works on my mechanism — with counterexamples", example: "“Which diseases share my mechanism under another gene name?”", greeting: "Shared mechanisms first, each with its sources and counterexamples." },
      priya: { title: "Pharma & biotech", persona: "e.g. Priya", get: "Rank clusters for your mechanism by unmet need", example: "“Where else could this mechanism apply?”", greeting: "Mechanism clusters first, ranked by unmet need." },
    },
  },
  es: {
    title: "Cada enfermedad rara es un punto de luz.",
    lead: "Encuentra quién comparte la biología de tu enfermedad, qué existe ya y qué hacer después — cada enlace con su fuente.",
    try_label: "Prueba:",
    who: "¿Quién eres?", who_hint: "Puedes cambiarlo cuando quieras.",
    greeting_default: "Elige el más cercano a ti — el atlas cambia lo que muestra primero.",
    maria_cta: "Prueba el caso de Maria: STXBP1 — 60 segundos",
    maria_aria: "Prueba el caso de Maria: abre la ruta de STXBP1 como líder de un grupo de pacientes",
    explore_as: (name) => `Explorar el atlas como ${name}`,
    steps: ["Busca", "Sigue tu ruta", "Toca cualquier línea para ver la prueba"],
    steps_label: "Cómo funciona",
    footer: (d, s) => `No es consejo médico · ${d} enfermedades · ${s} fuentes abiertas`,
    welcome_back: "Bienvenido de nuevo", continue_with: (name) => `Continuar con ${name}`, dismiss: "Descartar",
    help: "Ayuda", lang_aria: "Switch to English", example_label: "Búsquedas de ejemplo",
    example_none: (q) => `Aún no hay resultados para «${q}».`,
    roles: {
      devon: { title: "Paciente o cuidador", persona: "p. ej. Devon", get: "Entenderla en palabras simples y encontrar personas como tú", example: "«¿Hay una comunidad para mi diagnóstico exacto?»", greeting: "Tómate tu tiempo. Empezamos con palabras simples y personas como tú." },
      maria: { title: "Familia y grupo de pacientes", persona: "p. ej. Maria", get: "Aliados, un recurso reutilizable y un siguiente paso", example: "«¿Qué enfermedad comparte nuestro mecanismo y a quién llamamos?»", greeting: "Encontremos tu siguiente paso — y quién podría darlo contigo." },
      osei: { title: "Investigador", persona: "p. ej. Dr. Osei", get: "Quién más trabaja en mi mecanismo — con contraejemplos", example: "«¿Qué enfermedades comparten mi mecanismo con otro gen?»", greeting: "Primero los mecanismos compartidos, cada uno con sus fuentes y contraejemplos." },
      priya: { title: "Farma y biotech", persona: "p. ej. Priya", get: "Clusters para tu mecanismo, ordenados por necesidad no cubierta", example: "«¿Dónde más podría aplicar este mecanismo?»", greeting: "Primero los clusters de mecanismo, ordenados por necesidad no cubierta." },
    },
  },
};
