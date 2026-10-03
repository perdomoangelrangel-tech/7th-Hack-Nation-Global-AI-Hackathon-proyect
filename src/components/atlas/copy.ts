/** /atlas copy, EN (default) + ES. Read with useCopy(atlasCopy). `{d}` = short disease name. */
import type { LineKey, GapKind } from "@/lib/atlas-data";

type Aud = "family" | "clinical" | "research";

export interface AtlasCopy {
  home: string;
  disease: string;
  audience: string;
  audiences: Record<Aud, { label: string; agent: string }>;
  lines: Record<LineKey, string>;
  lineShort: Record<LineKey, string>;
  legend: { title: string; gap: string; weak: string };
  map: { label: string; hint: string; more: (n: number) => string; empty: string; inGraph: (n: number) => string; showing: (a: number, b: number) => string; sources: (n: number) => string; back: string; close: string; open: string; select: string };
  status: { live: string; snapshot: (d: string) => string; prevalence: string };
  props: Record<string, string> & { patientOrg: string; researchOrg: string; sites: string };
  ask: { title: string; placeholder: string; submit: string; examples: Record<Aud, string[]>; empty: string; loading: string; error: string; retry: string; tooShort: string; spoken: string; readAloud: string; stop: string; more: string; less: string; route: string; allSourced: (n: number) => string; someDropped: (k: number, d: number) => string; noEvidence: string; notSaid: string; next: string; about: (d: string) => string; meta: (mode: string, source: string, date: string) => string; pickDisease: string };
  voice: { title: (agent: string) => string; start: string; end: string; offline: string; offlineHint: string; connecting: string; listening: string; speaking: string; error: string; micDenied: string; you: string; agent: string; idle: string };
  tabs: { treatments: string; trials: string; community: string; gaps: string; label: string };
  treat: { approved: string; investigational: string; phase: (p: number) => string; none: string };
  trials: { title: string; status: string; phase: string; countries: string; id: string; none: string; recruiting: (n: number) => string };
  comm: { orgs: string; researchers: string; join: string; noResearchers: string; openToContact: string; none: string };
  gaps: Record<GapKind, (x: string) => string> & { intro: string; none: string };
  disclaimer: string;
  footer: string;
}

export const atlasCopy: { en: AtlasCopy; es: AtlasCopy } = {
  en: {
    home: "Nedamex home",
    disease: "Disease",
    audience: "Who is asking",
    audiences: {
      family: { label: "Family", agent: "Family Guide" },
      clinical: { label: "Clinician", agent: "Clinical Analyst" },
      research: { label: "Research", agent: "Research Analyst" },
    },
    lines: { genes: "Genes", phenotypes: "Symptoms", treatments: "Treatments & care", trials: "Clinical trials", literature: "Literature", community: "Community" },
    lineShort: { genes: "Genes", phenotypes: "Symptoms", treatments: "Treatments", trials: "Trials", literature: "Papers", community: "Community" },
    legend: { title: "Lines", gap: "No evidence", weak: "Low confidence" },
    map: {
      label: "Evidence map",
      hint: "Select a station to read its plaque: source, ID and date.",
      more: (n) => `+${n} more`,
      empty: "No evidence in our sources",
      inGraph: (n) => `${n} in the graph`,
      showing: (a, b) => `Showing ${a} of ${b}`,
      sources: (n) => `${n} source${n === 1 ? "" : "s"}`,
      back: "All stations",
      close: "Close plaque",
      open: "Open source",
      select: "Stations",
    },
    status: { live: "Live graph", snapshot: (d) => `Snapshot · ${d}`, prevalence: "Prevalence" },
    props: { frequency: "Frequency", phase: "Phase", status: "Status", approved: "Approved", mechanism: "Mechanism", journal: "Journal", country: "Country", countries: "Countries", sponsor: "Sponsor", association: "Association", affiliation: "Affiliation", focus: "Focus", role: "Role", type: "Type", yes: "Yes", no: "No", patientOrg: "Patient organization", researchOrg: "Research foundation", sites: "Sites" },
    ask: {
      title: "Ask the atlas",
      placeholder: "Ask in your own words",
      submit: "Ask",
      examples: {
        family: ["What treatments exist for {d}?", "Is there a cure for {d}?", "Where can families find support?"],
        clinical: ["Which genes cause {d}?", "Which HPO features define {d}?", "Approved drugs and phases for {d}?"],
        research: ["What are the research gaps in {d}?", "Which trials are recruiting for {d}?", "Who researches {d}?"],
      },
      empty: "Every sentence you get carries its source. What has none is not said.",
      loading: "Checking the sources…",
      error: "The atlas could not answer. Your question is still here.",
      retry: "Try again",
      tooShort: "Write a few more words.",
      spoken: "What the guide says",
      readAloud: "Read aloud",
      stop: "Stop",
      more: "Show all",
      less: "Show less",
      route: "Evidence route",
      allSourced: (n) => `${n} sourced statement${n === 1 ? "" : "s"}`,
      someDropped: (k, d) => `${k} sourced · ${d} dropped`,
      noEvidence: "No evidence in our sources",
      notSaid: "Not said",
      next: "Transfers",
      about: (d) => `About ${d}`,
      meta: (mode, source, date) => `${mode === "llm" ? "Model draft" : "Deterministic draft"} · ${source === "live" ? "live graph" : source === "snapshot" ? "snapshot" : "no data"} · retrieved ${date}`,
      pickDisease: "Pick a disease above, or name one in your question.",
    },
    voice: {
      title: (a) => `Talk to the ${a}`,
      start: "Start voice",
      end: "End",
      offline: "Voice agent coming online",
      offlineHint: "Text answers below use the same sources.",
      connecting: "Connecting…",
      listening: "Listening",
      speaking: "Speaking",
      error: "Voice is unavailable right now.",
      micDenied: "Microphone blocked. Allow it in your browser to talk.",
      you: "You",
      agent: "Agent",
      idle: "Speaks only from the sources on this map.",
    },
    tabs: { treatments: "Treatments & care", trials: "Trials", community: "Community", gaps: "Research gaps", label: "Details" },
    treat: { approved: "Approved", investigational: "Investigational", phase: (p) => `Phase ${p}`, none: "No treatments in our sources" },
    trials: { title: "Study", status: "Status", phase: "Phase", countries: "Countries", id: "ID", none: "No trials in our sources", recruiting: (n) => `${n} recruiting` },
    comm: { orgs: "Patient organizations", researchers: "Researchers", join: "Join as a researcher", noResearchers: "No researchers registered yet", openToContact: "Open to contact", none: "No organizations in our sources" },
    gaps: {
      intro: "Where the map is dashed: what our sources do not back yet.",
      none: "No gaps detected in the loaded evidence.",
      empty_line: (x) => `No evidence in our sources for ${x.toLowerCase()}.`,
      no_approved_treatment: () => "No treatment in our sources is listed as approved.",
      no_recruiting_trial: () => "No registered trial is recruiting now.",
      no_researchers: () => "No researchers registered in the community yet.",
      low_confidence: (x) => `Low-confidence relation: ${x}`,
      single_source: (x) => `Backed by a single source: ${x}`,
    },
    disclaimer: "This is sourced information, not a diagnosis. Take it to your doctor or a center of expertise.",
    footer: "Information with sources, not a diagnosis. Take it to your doctor or an expert center.",
  },
  es: {
    home: "Inicio de Nedamex",
    disease: "Enfermedad",
    audience: "Quién pregunta",
    audiences: {
      family: { label: "Familia", agent: "Guía de familias" },
      clinical: { label: "Clínico", agent: "Analista clínico" },
      research: { label: "Investigación", agent: "Analista de investigación" },
    },
    lines: { genes: "Genes", phenotypes: "Síntomas", treatments: "Tratamientos y cuidados", trials: "Ensayos clínicos", literature: "Literatura", community: "Comunidad" },
    lineShort: { genes: "Genes", phenotypes: "Síntomas", treatments: "Tratamientos", trials: "Ensayos", literature: "Artículos", community: "Comunidad" },
    legend: { title: "Líneas", gap: "Sin evidencia", weak: "Confianza baja" },
    map: {
      label: "Mapa de evidencia",
      hint: "Elige una estación para leer su placa: fuente, ID y fecha.",
      more: (n) => `+${n} más`,
      empty: "Sin evidencia en nuestras fuentes",
      inGraph: (n) => `${n} en el grafo`,
      showing: (a, b) => `Mostrando ${a} de ${b}`,
      sources: (n) => `${n} fuente${n === 1 ? "" : "s"}`,
      back: "Todas las estaciones",
      close: "Cerrar placa",
      open: "Abrir fuente",
      select: "Estaciones",
    },
    status: { live: "Grafo en vivo", snapshot: (d) => `Instantánea · ${d}`, prevalence: "Prevalencia" },
    props: { frequency: "Frecuencia", phase: "Fase", status: "Estado", approved: "Aprobado", mechanism: "Mecanismo", journal: "Revista", country: "País", countries: "Países", sponsor: "Patrocinador", association: "Asociación", affiliation: "Afiliación", focus: "Enfoque", role: "Rol", type: "Tipo", yes: "Sí", no: "No", patientOrg: "Organización de pacientes", researchOrg: "Fundación de investigación", sites: "Sedes" },
    ask: {
      title: "Pregunta al atlas",
      placeholder: "Pregunta con tus palabras",
      submit: "Preguntar",
      examples: {
        family: ["¿Qué tratamientos hay para {d}?", "¿Hay cura para {d}?", "¿Dónde encuentran apoyo las familias?"],
        clinical: ["¿Qué genes causan {d}?", "¿Qué rasgos HPO definen {d}?", "¿Fármacos aprobados y fases para {d}?"],
        research: ["¿Qué huecos de investigación hay en {d}?", "¿Qué ensayos reclutan para {d}?", "¿Quién investiga {d}?"],
      },
      empty: "Cada frase que recibas lleva su fuente. Lo que no la tiene, no se dice.",
      loading: "Revisando las fuentes…",
      error: "El atlas no pudo responder. Tu pregunta sigue aquí.",
      retry: "Reintentar",
      tooShort: "Escribe unas palabras más.",
      spoken: "Lo que dice la guía",
      readAloud: "Leer en voz alta",
      stop: "Detener",
      more: "Ver todo",
      less: "Ver menos",
      route: "Ruta de evidencia",
      allSourced: (n) => `${n} afirmaci${n === 1 ? "ón" : "ones"} con fuente`,
      someDropped: (k, d) => `${k} con fuente · ${d} eliminada${d === 1 ? "" : "s"}`,
      noEvidence: "Sin evidencia en nuestras fuentes",
      notSaid: "No se dijo",
      next: "Transbordos",
      about: (d) => `Sobre ${d}`,
      meta: (mode, source, date) => `${mode === "llm" ? "Redacción con modelo" : "Redacción determinista"} · ${source === "live" ? "grafo en vivo" : source === "snapshot" ? "instantánea" : "sin datos"} · consultado ${date}`,
      pickDisease: "Elige una enfermedad arriba o nómbrala en tu pregunta.",
    },
    voice: {
      title: (a) => `Habla con ${a === "Guía de familias" ? "la" : "el"} ${a}`,
      start: "Iniciar voz",
      end: "Terminar",
      offline: "El agente de voz llega pronto",
      offlineHint: "Las respuestas escritas usan las mismas fuentes.",
      connecting: "Conectando…",
      listening: "Escuchando",
      speaking: "Hablando",
      error: "La voz no está disponible ahora.",
      micDenied: "Micrófono bloqueado. Permítelo en tu navegador para hablar.",
      you: "Tú",
      agent: "Agente",
      idle: "Solo habla con las fuentes de este mapa.",
    },
    tabs: { treatments: "Tratamientos y cuidados", trials: "Ensayos", community: "Comunidad", gaps: "Huecos de investigación", label: "Detalle" },
    treat: { approved: "Aprobados", investigational: "En investigación", phase: (p) => `Fase ${p}`, none: "Sin tratamientos en nuestras fuentes" },
    trials: { title: "Estudio", status: "Estado", phase: "Fase", countries: "Países", id: "ID", none: "Sin ensayos en nuestras fuentes", recruiting: (n) => `${n} reclutando` },
    comm: { orgs: "Organizaciones de pacientes", researchers: "Investigadores", join: "Únete como investigador", noResearchers: "Aún no hay investigadores registrados", openToContact: "Acepta contacto", none: "Sin organizaciones en nuestras fuentes" },
    gaps: {
      intro: "Donde el mapa es punteado: lo que nuestras fuentes aún no respaldan.",
      none: "No se detectan huecos en la evidencia cargada.",
      empty_line: (x) => `Sin evidencia en nuestras fuentes para ${x.toLowerCase()}.`,
      no_approved_treatment: () => "Ningún tratamiento en nuestras fuentes figura como aprobado.",
      no_recruiting_trial: () => "Ningún ensayo registrado está reclutando ahora.",
      no_researchers: () => "Aún no hay investigadores registrados en la comunidad.",
      low_confidence: (x) => `Relación con confianza baja: ${x}`,
      single_source: (x) => `Respaldada por una sola fuente: ${x}`,
    },
    disclaimer: "Esto es información con fuentes, no un diagnóstico. Llévalo a tu médico o a un centro experto.",
    footer: "Información con fuentes, no un diagnóstico. Llévala a tu médico o a un centro experto.",
  },
};
