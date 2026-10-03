/**
 * Deterministic question parsing for /api/ask: which disease (EN/ES names + graph aliases) and which
 * topics (intents) the question is about. No model involved.
 */
import type { DiseaseSummary } from "../atlas-data";

export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const STOP = new Set(["syndrome", "sindrome", "disease", "enfermedad", "disorder", "trastorno", "deficiency", "deficiencia", "late", "infantile", "the", "por", "de", "del", "la", "el"]);

/** Search keys for a disease: ORPHA code, number, names, aliases and their distinctive tokens (≥ 4 chars). */
export function diseaseKeys(d: DiseaseSummary): string[] {
  const names = [d.name, d.name_es ?? "", d.short, ...d.aliases].filter(Boolean).map(norm);
  const tokens = names.flatMap((n) => n.split(/[\s(),/-]+/)).filter((t) => t.length >= 4 && !STOP.has(t));
  const code = norm(d.orpha);
  return [...new Set([code, code.replace("orpha:", "orpha "), ...names, ...tokens])].filter((k) => k.length >= 3);
}

/** First disease mentioned in the question; longest key wins when several match. */
export function detectDisease(question: string, diseases: DiseaseSummary[]): DiseaseSummary | null {
  const q = ` ${norm(question).replace(/[¿?¡!.,;:"']/g, " ")} `;
  let best: { d: DiseaseSummary; len: number } | null = null;
  for (const d of diseases) {
    for (const k of diseaseKeys(d)) {
      const hit = k.includes(" ") || k.includes(":") ? q.includes(k) : new RegExp(`[^a-z0-9]${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z0-9]`).test(q);
      if (hit && (!best || k.length > best.len)) best = { d, len: k.length };
    }
  }
  return best?.d ?? null;
}

/** Resolve a disease reference coming from the UI or a tool call (ORPHA code, name or alias). */
export function resolveDisease(ref: string | null | undefined, diseases: DiseaseSummary[]): DiseaseSummary | null {
  if (!ref?.trim()) return null;
  const r = norm(ref);
  const code = r.replace(/^orpha\s*:?\s*/, "orpha:");
  return diseases.find((d) => norm(d.orpha) === code || norm(d.orpha) === `orpha:${r}`)
    ?? diseases.find((d) => [d.name, d.name_es ?? "", d.short, ...d.aliases].some((n) => n && norm(n) === r))
    ?? detectDisease(ref, diseases);
}

export type Intent = "cure" | "genes" | "symptoms" | "treatments" | "trials" | "community" | "literature" | "gaps";

const INTENTS: [Intent, RegExp][] = [
  ["cure", /\b(cures?|cured|curing|curable|cura|curas|curar\w*|curacion\w*|heal\w*|sanar\w*)\b/],
  ["gaps", /\b(gaps?|huecos?|lagunas?|missing|falta|faltan|unknowns?|desconoc\w*|unmet|weak|debil\w*|unsourced)\b/],
  ["trials", /\b(trials?|ensayos?|recruit\w*|reclut\w*|nct\d*|enrol\w*|inscrib\w*)\b/],
  ["treatments", /\b(treat\w*|tratamient\w*|tratar|therap\w*|terapi\w*|drugs?|farmacos?|medic\w*|approved|aprobad\w*|care|cuidados?|manage\w*|manejo)\b/],
  ["genes", /\b(genes?|genetic\w*|genetic|genetica|genetico|mutation\w*|mutacion\w*|variants?|variantes?|causes?|caused|causa\w*|hgnc)\b/],
  ["symptoms", /\b(symptoms?|sintomas?|signs?|senales|signos?|phenotypes?|fenotipos?|hpo|features?|manifest\w*|seizures?|crisis|convuls\w*|look like|presenta\w*)\b/],
  ["community", /\b(support\w*|apoyo|famil\w*|groups?|grupos?|organi[sz]ation\w*|organizacion\w*|foundation\w*|fundacion\w*|associations?|asociacion\w*|communit\w*|comunidad\w*|researchers?|investigador\w*|who (studies|researches)|quien investiga|contact\w*)\b/],
  ["literature", /\b(papers?|articles?|articulos?|literature|literatura|publication\w*|publicacion\w*|pubmed|pmid\w*|latest research|ultima investigacion)\b/],
];

export function detectIntents(question: string): Intent[] {
  const q = norm(question);
  return INTENTS.filter(([, re]) => re.test(q)).map(([i]) => i);
}

/** Remedies people ask about that the graph may not back. Matched against the question, then checked against the map's treatments. */
export const ASKED_REMEDIES: { re: RegExp; keys: string[]; en: string; es: string }[] = [
  { re: /\b(diets?|dieta\w*|keto\w*|cetogen\w*|food|comida|alimenta\w*)\b/, keys: ["diet", "keto", "cetogen"], en: "A special diet", es: "Una dieta especial" },
  { re: /\b(supplements?|suplement\w*|vitamin\w*)\b/, keys: ["vitamin", "supplement"], en: "Supplements or vitamins", es: "Suplementos o vitaminas" },
  { re: /\b(homeopath\w*|homeopat\w*|herbs?|herbal|hierbas?|natural remed\w*|remedios? natural\w*)\b/, keys: ["homeopath", "herb"], en: "Homeopathy or herbal remedies", es: "Homeopatía o remedios herbales" },
  { re: /\b(stem cells?|celulas madre)\b/, keys: ["stem cell"], en: "Stem-cell therapy", es: "La terapia con células madre" },
];

export function askedRemedies(question: string) {
  const q = norm(question);
  return ASKED_REMEDIES.filter((r) => r.re.test(q));
}
