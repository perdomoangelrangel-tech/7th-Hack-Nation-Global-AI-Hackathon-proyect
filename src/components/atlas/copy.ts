/** /atlas copy, EN (default) + ES. Read with useCopy(atlasCopy). `{d}` = short disease name. */
import type { LineKey, GapKind } from "@/lib/atlas-data";
import { trialStatusText, type LinkKind, type StepKind, type Validate } from "@/lib/agents/connections";

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
  treat: { approved: string; investigational: string; phase: (p: number) => string; none: string; approvedBy: (agencyYear: string) => string };
  trials: { title: string; status: string; phase: string; countries: string; id: string; none: string; recruiting: (n: number) => string };
  comm: { orgs: string; researchers: string; join: string; noResearchers: string; openToContact: string; none: string };
  gaps: Record<GapKind, (x: string) => string> & { intro: string; none: string };
  conn: {
    title: string;
    intro: (d: string) => string;
    how: string;
    formula: string;
    match: string;
    kinds: Record<LinkKind, (n: number) => string>;
    group: Record<LinkKind, string>;
    open: string;
    close: string;
    approvedFor: (d: string, phase: number | null) => string;
    phaseFor: (d: string, phase: number) => string;
    studiedFor: (d: string) => string;
    paper: (d: string) => string;
    next: string;
    validate: string;
    steps: Record<StepKind, (p: { item?: string; nct?: string; neighbor: string; here: string; np?: number | null; hp?: number | null; label?: string; status?: string }) => string>;
    trialStatus: (status: string | null | undefined) => string;
    validateText: Record<Validate, (neighbor: string) => string>;
    gapTitle: string;
    gapBody: (d: string) => string;
    umbrella: (names: string) => string;
    explain: string;
    explaining: string;
    explainError: string;
    more: (n: number) => string;
    empty: string;
    breakdown: { phenotypes: string; treatments: string; trials: string; researchers: string };
  };
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
        family: ["What treatments exist for {d}?", "Which diseases share {d}'s characteristics?", "Is there a cure for {d}?"],
        clinical: ["Which genes cause {d}?", "Which diseases are similar to {d}?", "Approved drugs and phases for {d}?"],
        research: ["What are the research gaps in {d}?", "Who could we collaborate with on {d}?", "Which trials are recruiting for {d}?"],
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
    treat: { approved: "Approved", investigational: "Investigational", phase: (p) => `Phase ${p}`, none: "No treatments in our sources", approvedBy: (a) => `Approved · ${a}` },
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
    conn: {
      title: "Connections",
      intro: (d) => `Who shares ${d}'s characteristics, what already exists, and what to do together next.`,
      how: "How we rank",
      formula: "Match = 0.5 × shared symptoms ÷ all symptoms of both diseases + 0.2 × shared treatments (up to 2) + 0.15 × shared trials (up to 2) + 0.15 × shared researchers (up to 2). Umbrella organizations are shown, not scored. A high match is a lead for expert review, not proof of a shared cause.",
      match: "match",
      kinds: {
        treatment: (n) => `${n} treatment${n === 1 ? "" : "s"}`, trial: (n) => `${n} trial${n === 1 ? "" : "s"}`, researcher: (n) => `${n} researcher${n === 1 ? "" : "s"}`,
        gene: (n) => `${n} gene${n === 1 ? "" : "s"}`, phenotype: (n) => `${n} symptom${n === 1 ? "" : "s"}`, organization: (n) => `${n} organization${n === 1 ? "" : "s"}`,
      },
      group: { treatment: "Shared treatments", trial: "Shared trials", researcher: "Researchers on both", gene: "Shared genes", phenotype: "Shared symptoms", organization: "Shared organizations" },
      open: "Shared evidence",
      close: "Hide evidence",
      approvedFor: (d, p) => `approved for ${d}${p != null ? ` (phase ${p})` : ""}`,
      phaseFor: (d, p) => `phase ${p} for ${d}`,
      studiedFor: (d) => `studied for ${d}`,
      paper: (d) => `${d} paper`,
      next: "Next step",
      validate: "To validate",
      steps: {
        ask_sponsor: ({ item, neighbor, np, hp }) => `${item} is approved for ${neighbor}${np != null ? ` (phase ${np})` : ""} and${hp != null ? ` in phase ${hp}` : " studied"} here: ask the sponsor whether that evidence applies.`,
        trial_eligibility: ({ label, nct, status, here }) => status === "ENROLLING_BY_INVITATION" ? `Ask the ${label ?? nct} team (enrolling by invitation) how ${here} families can be invited.`
          : status === "NOT_YET_RECRUITING" ? `Ask the ${label ?? nct} team (not yet recruiting) whether ${here} families can join when it opens.`
          : `Ask the ${label ?? nct} team (recruiting) whether ${here} families can join.`,
        trial_results: ({ label, nct, status, here }) => status ? `${label ?? nct} covers both diseases but is not enrolling (${trialStatusText(status, "en")}): ask the team for results that apply to ${here}.`
          : `Ask the ${label ?? nct} team about its current status and any results for ${here}.`,
        compare_programs: ({ item }) => `Compare the ${item} trial results across both diseases.`,
        joint_call: ({ item, here, neighbor }) => `Invite ${item}, published on ${here} and ${neighbor}, to a joint call.`,
        gene_review: ({ item }) => `Ask a geneticist to review the shared gene ${item}.`,
        phenotype_review: () => "Compare symptom profiles with an expert center.",
        investigate: ({ neighbor }) => `Plan: compare full symptom profiles with ${neighbor} and search papers that mention both.`,
      },
      trialStatus: (st) => trialStatusText(st, "en"),
      validateText: {
        mechanism: () => "Whether shared symptoms come from the same mechanism (expert review).",
        transfer: (n) => `Whether results in ${n} apply to this population (clinicians and regulators).`,
      },
      gapTitle: "No shared evidence yet",
      gapBody: (d) => `Beyond umbrella organizations, our sources show nothing shared with ${d}.`,
      umbrella: (names) => `${names} support every disease in the atlas: shown, not scored.`,
      explain: "Explain this connection",
      explaining: "Checking the sources…",
      explainError: "Could not explain right now. Try again.",
      more: (n) => `+${n} more`,
      empty: "No connections in our sources yet.",
      breakdown: { phenotypes: "Symptoms", treatments: "Treatments", trials: "Trials", researchers: "Researchers" },
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
        family: ["¿Qué tratamientos hay para {d}?", "¿Qué enfermedades comparten características con {d}?", "¿Hay cura para {d}?"],
        clinical: ["¿Qué genes causan {d}?", "¿Qué enfermedades son parecidas a {d}?", "¿Fármacos aprobados y fases para {d}?"],
        research: ["¿Qué huecos de investigación hay en {d}?", "¿Con quién podemos colaborar en {d}?", "¿Qué ensayos reclutan para {d}?"],
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
    treat: { approved: "Aprobados", investigational: "En investigación", phase: (p) => `Fase ${p}`, none: "Sin tratamientos en nuestras fuentes", approvedBy: (a) => `Aprobado · ${a}` },
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
    conn: {
      title: "Conexiones",
      intro: (d) => `Quién comparte las características de ${d}, qué existe ya y qué hacer juntos después.`,
      how: "Cómo ordenamos",
      formula: "Coincidencia = 0,5 × síntomas compartidos ÷ todos los síntomas de ambas + 0,2 × tratamientos compartidos (hasta 2) + 0,15 × ensayos compartidos (hasta 2) + 0,15 × investigadores compartidos (hasta 2). Las organizaciones paraguas se muestran, no puntúan. Una coincidencia alta es una pista para revisión experta, no prueba de una causa común.",
      match: "coincidencia",
      kinds: {
        treatment: (n) => `${n} tratamiento${n === 1 ? "" : "s"}`, trial: (n) => `${n} ensayo${n === 1 ? "" : "s"}`, researcher: (n) => `${n} investigador${n === 1 ? "" : "es"}`,
        gene: (n) => `${n} gen${n === 1 ? "" : "es"}`, phenotype: (n) => `${n} síntoma${n === 1 ? "" : "s"}`, organization: (n) => `${n} organización${n === 1 ? "" : "es"}`,
      },
      group: { treatment: "Tratamientos compartidos", trial: "Ensayos compartidos", researcher: "Investigadores en ambas", gene: "Genes compartidos", phenotype: "Síntomas compartidos", organization: "Organizaciones compartidas" },
      open: "Evidencia compartida",
      close: "Ocultar evidencia",
      approvedFor: (d, p) => `aprobado para ${d}${p != null ? ` (fase ${p})` : ""}`,
      phaseFor: (d, p) => `fase ${p} para ${d}`,
      studiedFor: (d) => `en estudio para ${d}`,
      paper: (d) => `artículo de ${d}`,
      next: "Siguiente paso",
      validate: "Por validar",
      steps: {
        ask_sponsor: ({ item, neighbor, np, hp }) => `${item} está aprobado para ${neighbor}${np != null ? ` (fase ${np})` : ""} y${hp != null ? ` en fase ${hp}` : " en estudio"} aquí: pregunta al patrocinador si esa evidencia aplica.`,
        trial_eligibility: ({ label, nct, status, here }) => status === "ENROLLING_BY_INVITATION" ? `Pregunta al equipo de ${label ?? nct} (inscripción por invitación) cómo pueden ser invitadas las familias con ${here}.`
          : status === "NOT_YET_RECRUITING" ? `Pregunta al equipo de ${label ?? nct} (aún no recluta) si las familias con ${here} podrán participar cuando abra.`
          : `Pregunta al equipo de ${label ?? nct} (reclutando) si las familias con ${here} pueden participar.`,
        trial_results: ({ label, nct, status, here }) => status ? `${label ?? nct} incluye ambas enfermedades pero no está inscribiendo (${trialStatusText(status, "es")}): pide al equipo los resultados que apliquen a ${here}.`
          : `Pregunta al equipo de ${label ?? nct} por su estado actual y los resultados para ${here}.`,
        compare_programs: ({ item }) => `Compara los resultados de ${item} en ambas enfermedades.`,
        joint_call: ({ item, here, neighbor }) => `Invita a ${item}, con publicaciones en ${here} y ${neighbor}, a una llamada conjunta.`,
        gene_review: ({ item }) => `Pide a un genetista revisar el gen compartido ${item}.`,
        phenotype_review: () => "Compara los perfiles de síntomas con un centro experto.",
        investigate: ({ neighbor }) => `Plan: comparar los perfiles completos de síntomas con ${neighbor} y buscar artículos que mencionen ambas.`,
      },
      trialStatus: (st) => trialStatusText(st, "es"),
      validateText: {
        mechanism: () => "Si los síntomas compartidos vienen del mismo mecanismo (revisión experta).",
        transfer: (n) => `Si los resultados en ${n} aplican a esta población (clínicos y reguladores).`,
      },
      gapTitle: "Aún sin evidencia compartida",
      gapBody: (d) => `Más allá de organizaciones paraguas, nuestras fuentes no muestran nada compartido con ${d}.`,
      umbrella: (names) => `${names} apoyan a todas las enfermedades del atlas: se muestran, no puntúan.`,
      explain: "Explicar esta conexión",
      explaining: "Revisando las fuentes…",
      explainError: "No se pudo explicar ahora. Reintenta.",
      more: (n) => `+${n} más`,
      empty: "Aún no hay conexiones en nuestras fuentes.",
      breakdown: { phenotypes: "Síntomas", treatments: "Tratamientos", trials: "Ensayos", researchers: "Investigadores" },
    },
    disclaimer: "Esto es información con fuentes, no un diagnóstico. Llévalo a tu médico o a un centro experto.",
    footer: "Información con fuentes, no un diagnóstico. Llévala a tu médico o a un centro experto.",
  },
};
