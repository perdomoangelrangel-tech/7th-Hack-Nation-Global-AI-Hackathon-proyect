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

/** S7 · no supported route (UX_WAVE4 §2 S7): what we searched, what is missing, closest leads, how to help. */
export const noRouteCopy = {
  en: {
    title: (q: string) => `We don't have a supported route for “${q}” yet.`,
    searched: "What we searched", searched_tail: (n: number) => `${n} open sources · 0 links for this search`,
    missing: "What's missing",
    missing_items: (q: string) => [`No disease, gene, symptom or patient group in the atlas matches “${q}”`, "No gene–disease link", "No verified patient group"],
    leads: "Closest leads", leads_note: "Matched by name only — a starting point, not evidence of shared biology.",
    lead_label: "Weak lead", lead_line: (word: string, hit: string, disease: string) => hit === disease ? `“${word}” matches ${disease}` : `“${word}” matches ${hit} · in ${disease}`,
    open_lead: "Open this route", no_leads: "No partial matches either.",
    change: "What would change it",
    add_evidence: "Add missing evidence", tell_group: "Tell us about your patient group", opens_github: "opens GitHub in a new tab",
    back: "Back to search", synced: "Read on",
    issue_evidence: (q: string) => ({ title: `Missing evidence: ${q}`, body: `What I searched: ${q}\n\nSource (Orphanet / OMIM / PubMed / ClinicalTrials.gov id or URL):\n\nWhat it shows:\n` }),
    issue_group: (q: string) => ({ title: `Patient group: ${q}`, body: `Disease: ${q}\n\nPatient group name:\n\nOfficial website:\n` }),
  },
  es: {
    title: (q: string) => `Aún no tenemos una ruta respaldada para «${q}».`,
    searched: "Qué buscamos", searched_tail: (n: number) => `${n} fuentes abiertas · 0 enlaces para esta búsqueda`,
    missing: "Qué falta",
    missing_items: (q: string) => [`Ninguna enfermedad, gen, síntoma o grupo de pacientes del atlas coincide con «${q}»`, "Sin enlace gen–enfermedad", "Sin grupo de pacientes verificado"],
    leads: "Pistas más cercanas", leads_note: "Coinciden solo por nombre — un punto de partida, no evidencia de biología compartida.",
    lead_label: "Pista débil", lead_line: (word: string, hit: string, disease: string) => hit === disease ? `«${word}» coincide con ${disease}` : `«${word}» coincide con ${hit} · en ${disease}`,
    open_lead: "Abrir esta ruta", no_leads: "Tampoco hay coincidencias parciales.",
    change: "Qué lo cambiaría",
    add_evidence: "Agregar evidencia que falta", tell_group: "Cuéntanos de tu grupo de pacientes", opens_github: "abre GitHub en una pestaña nueva",
    back: "Volver a buscar", synced: "Leído el",
    issue_evidence: (q: string) => ({ title: `Evidencia faltante: ${q}`, body: `Lo que busqué: ${q}\n\nFuente (id o URL de Orphanet / OMIM / PubMed / ClinicalTrials.gov):\n\nQué muestra:\n` }),
    issue_group: (q: string) => ({ title: `Grupo de pacientes: ${q}`, body: `Enfermedad: ${q}\n\nNombre del grupo:\n\nSitio oficial:\n` }),
  },
} satisfies Record<Locale, unknown>;

/** 3-stop tour (UX_WAVE4 §4.6): Next / Skip, reopened from Help, "?" or the `nedamex:tour` event. */
export const tourCopy = {
  en: {
    label: "Quick tour", of: (i: number, n: number) => `${i} of ${n}`, next: "Next", back: "Back", skip: "Skip", done: "Got it",
    stops: [
      { title: "This is your route — one question at a time.", body: "Four questions take you from your disease to a next step: who shares its biology, what already exists, who could help, what to do together." },
      { title: "The map shows why.", body: "Solid = a source says it. Dashed = our analysis — a hypothesis for experts to check." },
      { title: "Tap any line to see its sources.", body: "Every link opens its evidence: the source, the date we read it and how sure we are." },
    ],
    observed: "Observed · a source states it", inferred: "Inferred · needs expert review", sources: "Sources",
  },
  es: {
    label: "Recorrido rápido", of: (i: number, n: number) => `${i} de ${n}`, next: "Siguiente", back: "Atrás", skip: "Saltar", done: "Entendido",
    stops: [
      { title: "Esta es tu ruta — una pregunta a la vez.", body: "Cuatro preguntas te llevan de tu enfermedad a un siguiente paso: quién comparte su biología, qué existe ya, quién podría ayudar y qué hacer juntos." },
      { title: "El mapa muestra por qué.", body: "Sólida = lo dice una fuente. Rayada = nuestro análisis — una hipótesis que un experto debe revisar." },
      { title: "Toca cualquier línea para ver sus fuentes.", body: "Cada enlace abre su evidencia: la fuente, la fecha en que la leímos y qué tan seguros estamos." },
    ],
    observed: "Observada · lo dice una fuente", inferred: "Inferida · requiere revisión experta", sources: "Fuentes",
  },
} satisfies Record<Locale, unknown>;
