/**
 * Landing copy, EN (default) + ES. Short on purpose: headlines ≤ 4 words, one support line per section.
 * Every number carries its source. Sample content is labelled as sample / example.
 */

export const SRC = {
  eurordis: "https://devel.eurordis.org/wp-content/uploads/2024/05/Diagnosis-printer-.pdf",
  solve: "https://solve.mit.edu/solutions/92088",
  emmes: "https://www.theemmesgroup.com/system/files/Emmes%20-%20Infographic%20-%20Patient%20Recruitment%20in%20Rare%20Disease.pdf",
};

const en = {
  nav: {
    skip: "Skip to content",
    home: "Nedamex, home",
    sections: "Sections",
    how: "How it works",
    riders: "For whom",
    fares: "Model",
    videos: "Videos",
    open: "Open the map",
  },
  hero: {
    ctaMap: "Open the map",
    ctaDemo: "Watch the demo",
    mapLabel:
      "Sample transit map of Dravet syndrome, ORPHA:33069. Gene line: SCN1A. Symptom line: seizure, HP:0001250, and febrile seizure, HP:0002373. Treatment line: stiripentol, fenfluramine and cannabidiol, all approved. Trial line: active trials on ClinicalTrials.gov. Community line: Dravet Syndrome Foundation. A dashed segment marks a claim with no source: we say so.",
    hub: ["Dravet syndrome"],
    hubShort: ["Dravet", "syndrome"],
    gene: "gene · Orphanet",
    geneShort: "gene",
    seizure: "Seizure",
    febrile: "Febrile seizure",
    treatments: ["Stiripentol", "Fenfluramine", "Cannabidiol"],
    approved: "approved · FDA, EMA",
    approvedShort: "approved",
    trials: "Active trials",
    community: ["Dravet Syndrome Foundation"],
    communityShort: ["Dravet Syndrome", "Foundation"],
    org: "patient org",
    gap: ["No source →", "we say so"],
    sample: "sample · live data in the atlas",
  },
  odyssey: {
    title: "A route with no map.",
    lead: "Years between specialists before anyone names the disease.",
    mapLabel: "A tangled route with wrong turns and a dead end: the diagnostic odyssey.",
    stats: [
      { n: "300M+", t: "people live with a rare disease", s: "MIT Solve · Buffalo Initiative", href: SRC.solve },
      { n: "4.7 years", t: "to a confirmed diagnosis, on average", s: "EURORDIS Rare Barometer · 10,453 patients", href: SRC.eurordis },
      { n: "95%", t: "of rare diseases have no approved treatment", s: "MIT Solve · Buffalo Initiative", href: SRC.solve },
    ],
  },
  how: {
    title: "No source, no station.",
    lead: "Seven public databases, one graph. The voice can only say what the graph can cite.",
    sources: "7 sources",
    graph: ["Evidence graph", "every edge: source + date"],
    tools: ["Agent tools", "read the graph, nothing else"],
    gate: ["Verifier", "no evidence_id → dropped"],
    answer: ["Voice answer", "with citations"],
    none: ["No evidence", "in our sources"],
    steps: [
      "Seven sources: Orphanet, HPO, Monarch, ClinVar, ClinicalTrials.gov, Open Targets and PubMed.",
      "They become one evidence graph. Every edge carries a source and a date.",
      "Agent tools can only read the graph.",
      "A deterministic verifier drops any sentence without an evidence_id.",
      "What passes becomes a voice answer with citations.",
      "If nothing passes, the agent says: no evidence in our sources.",
    ],
  },
  ask: {
    title: "Ask in your voice.",
    lead: "Each sentence lands on a sourced station, or it is dropped.",
    example: "example",
    asker: "A parent asks",
    question: "Is there an approved treatment for Rett syndrome?",
    claims: [
      { text: "Trofinetide is FDA-approved for Rett syndrome.", source: "Open Targets", id: "ORPHA:778", date: "2026-10-03", line: "treat" },
      { text: "Rett syndrome is linked to the MECP2 gene.", source: "Orphanet", id: "ORPHA:778", date: "2026-10-03", line: "gene" },
    ],
    dropped: { text: "“A special diet cures it.”", reason: "dropped: no source" },
    disclaimer: "Information with sources, not medical advice.",
  },
  riders: {
    title: "Three riders, one map.",
    lead: "Same graph, same sources. A different voice for each rider.",
    graph: "one graph",
    list: [
      { key: "families", name: "Families", fare: "Free", stops: ["Plain-language explanation", "Treatments & care, documented", "Nearby trials", "Support groups"] },
      { key: "clinicians", name: "Clinicians", fare: "B2B", stops: ["Differential by symptoms (HPO)", "Variants", "Citations with codes"] },
      { key: "research", name: "Research & pharma", fare: "B2B", stops: ["Evidence map", "Research gaps", "Researcher community", "Consented trial contact"] },
    ],
  },
  fares: {
    title: "The fare board.",
    lead: "Families ride free. Clinics and research pay for the map.",
    board: "Fares",
    hypothesis: "pricing hypothesis · validating",
    rows: [
      { who: "Families", fare: "Free", line: "treat" },
      { who: "Patient organizations", fare: "US$100–500 / mo", line: "pheno" },
      { who: "Clinics", fare: "US$200 / specialist / mo", line: "trial" },
      { who: "Pharma & CROs", fare: "US$50–250k / program / yr", line: "comm" },
    ],
    whyTitle: "Why they pay",
    why: [
      { n: ">80%", t: "of trials are delayed or closed by recruitment" },
      { n: "US$600k–8M", t: "lost per day of delay" },
    ],
    whySource: "Emmes, 2024",
    ethics: ["We never sell patient data.", "Trial contact only with explicit consent."],
  },
  scale: {
    title: "Any Orphanet code.",
    lead: "The same ingestion runs for every disease. Five today, thousands next.",
    from: "demo diseases",
    to: "monogenic rare diseases",
    mapLabel: "A network that multiplies: five highlighted demo diseases among thousands of small stations.",
    diseases: ["Dravet syndrome", "Rett syndrome", "CDKL5 deficiency disorder", "Angelman syndrome", "CLN2 disease"],
    live: "Live graph",
    counters: { entities: "entities", edges: "active edges", evidence: "evidence rows", diseases: "diseases", trials: "trials", treatments: "treatments", sources_used: "sources" },
    updated: "last retrieved",
  },
  videos: {
    title: "Watch it work.",
    lead: "Product, technology and team, in three short videos.",
    soon: "Coming soon",
    items: {
      demo: { title: "Demo", purpose: "The product, end to end" },
      tech: { title: "Technical", purpose: "Graph, verifier, agents, scale" },
      team: { title: "Team", purpose: "Who we are and why" },
    },
  },
  team: {
    title: "The crew.",
    lead: "Names and roles arrive with the team video.",
    slot: "[Name] · [Role]",
  },
  footer: {
    github: "Code on GitHub",
    notAdvice: "Information with sources, not medical advice.",
    noSell: "We never sell patient data.",
  },
};

export type LandingCopy = typeof en;

const es: LandingCopy = {
  nav: {
    skip: "Saltar al contenido",
    home: "Nedamex, inicio",
    sections: "Secciones",
    how: "Cómo funciona",
    riders: "Para quién",
    fares: "Modelo",
    videos: "Videos",
    open: "Abrir el mapa",
  },
  hero: {
    ctaMap: "Abrir el mapa",
    ctaDemo: "Ver el demo",
    mapLabel:
      "Mapa de transporte de muestra del síndrome de Dravet, ORPHA:33069. Línea de genes: SCN1A. Línea de síntomas: convulsión, HP:0001250, y crisis febril, HP:0002373. Línea de tratamientos: estiripentol, fenfluramina y cannabidiol, todos aprobados. Línea de ensayos: ensayos activos en ClinicalTrials.gov. Línea de comunidad: Dravet Syndrome Foundation. Un tramo punteado marca una afirmación sin fuente: lo decimos.",
    hub: ["Síndrome de Dravet"],
    hubShort: ["Síndrome", "de Dravet"],
    gene: "gen · Orphanet",
    geneShort: "gen",
    seizure: "Convulsión",
    febrile: "Crisis febril",
    treatments: ["Estiripentol", "Fenfluramina", "Cannabidiol"],
    approved: "aprobado · FDA, EMA",
    approvedShort: "aprobado",
    trials: "Ensayos activos",
    community: ["Dravet Syndrome Foundation"],
    communityShort: ["Dravet Syndrome", "Foundation"],
    org: "org. de pacientes",
    gap: ["Sin fuente →", "lo decimos"],
    sample: "muestra · datos reales en el atlas",
  },
  odyssey: {
    title: "Una ruta sin mapa.",
    lead: "Años entre especialistas antes de que alguien nombre la enfermedad.",
    mapLabel: "Una ruta enredada, con vueltas equivocadas y un callejón sin salida: la odisea diagnóstica.",
    stats: [
      { n: "300M+", t: "personas viven con una enfermedad rara", s: "MIT Solve · Buffalo Initiative", href: SRC.solve },
      { n: "4.7 años", t: "en promedio hasta un diagnóstico confirmado", s: "EURORDIS Rare Barometer · 10,453 pacientes", href: SRC.eurordis },
      { n: "95%", t: "de las enfermedades raras no tiene tratamiento aprobado", s: "MIT Solve · Buffalo Initiative", href: SRC.solve },
    ],
  },
  how: {
    title: "Sin fuente, sin estación.",
    lead: "Siete bases de datos públicas, un grafo. La voz solo dice lo que el grafo puede citar.",
    sources: "7 fuentes",
    graph: ["Grafo de evidencia", "cada arista: fuente + fecha"],
    tools: ["Herramientas", "solo leen el grafo"],
    gate: ["Verificador", "sin evidence_id → fuera"],
    answer: ["Respuesta por voz", "con citas"],
    none: ["Sin evidencia", "en nuestras fuentes"],
    steps: [
      "Siete fuentes: Orphanet, HPO, Monarch, ClinVar, ClinicalTrials.gov, Open Targets y PubMed.",
      "Se vuelven un grafo de evidencia. Cada arista lleva fuente y fecha.",
      "Las herramientas del agente solo pueden leer el grafo.",
      "Un verificador determinista elimina toda frase sin evidence_id.",
      "Lo que pasa se convierte en una respuesta por voz con citas.",
      "Si nada pasa, el agente dice: no hay evidencia en nuestras fuentes.",
    ],
  },
  ask: {
    title: "Pregunta con tu voz.",
    lead: "Cada frase llega a una estación con fuente, o se elimina.",
    example: "ejemplo",
    asker: "Una madre pregunta",
    question: "¿Hay un tratamiento aprobado para el síndrome de Rett?",
    claims: [
      { text: "Trofinetide está aprobado por la FDA para el síndrome de Rett.", source: "Open Targets", id: "ORPHA:778", date: "2026-10-03", line: "treat" },
      { text: "El síndrome de Rett está ligado al gen MECP2.", source: "Orphanet", id: "ORPHA:778", date: "2026-10-03", line: "gene" },
    ],
    dropped: { text: "“Una dieta especial lo cura.”", reason: "eliminado: sin fuente" },
    disclaimer: "Información con fuentes, no consejo médico.",
  },
  riders: {
    title: "Tres viajeros, un mapa.",
    lead: "Mismo grafo, mismas fuentes. Una voz distinta para cada viajero.",
    graph: "un grafo",
    list: [
      { key: "families", name: "Familias", fare: "Gratis", stops: ["Explicación en lenguaje claro", "Tratamientos y cuidados documentados", "Ensayos cercanos", "Grupos de apoyo"] },
      { key: "clinicians", name: "Clínicos", fare: "B2B", stops: ["Diferencial por síntomas (HPO)", "Variantes", "Citas con códigos"] },
      { key: "research", name: "Investigación y farma", fare: "B2B", stops: ["Mapa de evidencia", "Huecos de investigación", "Comunidad de investigadores", "Contacto a ensayos con consentimiento"] },
    ],
  },
  fares: {
    title: "Tablero de tarifas.",
    lead: "Las familias viajan gratis. Clínicas e investigación pagan el mapa.",
    board: "Tarifas",
    hypothesis: "hipótesis de precios · validando",
    rows: [
      { who: "Familias", fare: "Gratis", line: "treat" },
      { who: "Organizaciones de pacientes", fare: "US$100–500 / mes", line: "pheno" },
      { who: "Clínicas", fare: "US$200 / especialista / mes", line: "trial" },
      { who: "Farma y CROs", fare: "US$50–250k / programa / año", line: "comm" },
    ],
    whyTitle: "Por qué pagan",
    why: [
      { n: ">80%", t: "de los ensayos se retrasa o cierra por reclutamiento" },
      { n: "US$600k–8M", t: "perdidos por cada día de retraso" },
    ],
    whySource: "Emmes, 2024",
    ethics: ["Nunca vendemos datos de pacientes.", "Contacto a ensayos solo con consentimiento explícito."],
  },
  scale: {
    title: "Cualquier código Orphanet.",
    lead: "La misma ingesta corre para cada enfermedad. Hoy cinco, después miles.",
    from: "enfermedades demo",
    to: "enfermedades raras monogénicas",
    mapLabel: "Una red que se multiplica: cinco enfermedades demo resaltadas entre miles de estaciones pequeñas.",
    diseases: ["Síndrome de Dravet", "Síndrome de Rett", "Trastorno por deficiencia de CDKL5", "Síndrome de Angelman", "Enfermedad CLN2"],
    live: "Grafo en vivo",
    counters: { entities: "entidades", edges: "aristas activas", evidence: "filas de evidencia", diseases: "enfermedades", trials: "ensayos", treatments: "tratamientos", sources_used: "fuentes" },
    updated: "última consulta",
  },
  videos: {
    title: "Míralo funcionar.",
    lead: "Producto, tecnología y equipo, en tres videos cortos.",
    soon: "Muy pronto",
    items: {
      demo: { title: "Demo", purpose: "El producto, de principio a fin" },
      tech: { title: "Técnico", purpose: "Grafo, verificador, agentes, escala" },
      team: { title: "Equipo", purpose: "Quiénes somos y por qué" },
    },
  },
  team: {
    title: "El equipo.",
    lead: "Nombres y roles llegan con el video del equipo.",
    slot: "[Nombre] · [Rol]",
  },
  footer: {
    github: "Código en GitHub",
    notAdvice: "Información con fuentes, no consejo médico.",
    noSell: "Nunca vendemos datos de pacientes.",
  },
};

export const copy = { en, es };

/** Line color tokens (CSS variables from globals.css), keyed by evidence type. */
export const LINE = {
  gene: "var(--l-gene)",
  pheno: "var(--l-pheno)",
  treat: "var(--l-treat)",
  trial: "var(--l-trial)",
  comm: "var(--l-comm)",
  lit: "var(--l-lit)",
} as const;
export type LineKey = keyof typeof LINE;
